#include "engine.hpp"
#include <algorithm>
namespace lob {
void Engine::reset(int cap) {
    capacity = std::clamp(cap, 1, max_orders);
    free_count_ = capacity;
    active_count = event_count = 0;
    command_sequence = event_sequence = 0;
    ids_.fill(-1);
    for (auto &b : bits_)
        b.fill(0);
    for (auto &side : levels)
        for (auto &l : side)
            l = Level{};
    for (auto &o : orders)
        o = Order{};
    for (int i = 0; i < capacity; i++)
        free_[i] = capacity - 1 - i;
}
int Engine::find(std::uint32_t id) const {
    auto h = bucket(id);
    for (int n = 0; n < index_size; n++, h = (h + 1) & (index_size - 1)) {
        int s = ids_[h];
        if (s < 0)
            return -1;
        if (orders[s].id == id)
            return s;
    }
    return -1;
}
void Engine::insert_id(int slot) {
    auto h = bucket(orders[slot].id);
    while (ids_[h] >= 0)
        h = (h + 1) & (index_size - 1);
    ids_[h] = slot;
}
void Engine::erase_id(std::uint32_t id) {
    // Move a displaced bucket back only if its probe path crosses the hole.
    // Distances are modulo a power-of-two capacity, including wrapped clusters.
    auto hole = bucket(id);
    while (ids_[hole] >= 0 && orders[ids_[hole]].id != id)
        hole = (hole + 1) & (index_size - 1);
    if (ids_[hole] < 0)
        return;
    auto scan = (hole + 1) & (index_size - 1);
    while (ids_[scan] >= 0) {
        auto home = bucket(orders[ids_[scan]].id);
        if (((scan - home) & (index_size - 1)) >= ((hole - home) & (index_size - 1))) {
            ids_[hole] = ids_[scan];
            hole = scan;
        }
        scan = (scan + 1) & (index_size - 1);
    }
    ids_[hole] = -1;
}
int Engine::best(int side) const {
    if (side == sell) {
        for (int w = 0; w < words; w++)
            if (bits_[side][w])
                return w * 64 + std::countr_zero(bits_[side][w]);
    } else {
        for (int w = words - 1; w >= 0; w--)
            if (bits_[side][w])
                return w * 64 + 63 - std::countl_zero(bits_[side][w]);
    }
    return -1;
}
void Engine::emit(int kind, std::uint32_t maker, std::uint32_t taker, int price, int qty, int slot,
                  int reason) {
    events[event_count++] = {kind, maker, taker, price, qty, slot, reason, ++event_sequence};
}
void Engine::unlink(int slot) {
    auto &o = orders[slot];
    auto &l = levels[o.side][o.price];
    if (o.prev >= 0)
        orders[o.prev].next = o.next;
    else
        l.head = o.next;
    if (o.next >= 0)
        orders[o.next].prev = o.prev;
    else
        l.tail = o.prev;
    l.count--;
    l.volume -= o.qty;
    if (l.count == 0)
        bits_[o.side][o.price / 64] &= ~(std::uint64_t(1) << (o.price % 64));
    o.prev = o.next = -1;
}
void Engine::release(int slot) {
    erase_id(orders[slot].id);
    orders[slot].active = false;
    free_[free_count_++] = slot;
    active_count--;
}
bool Engine::submit(std::uint32_t id, int side, int price, int qty) {
    event_count = 0;
    command_sequence++;
    if (!id || id > 2147483647U || (side != buy && side != sell) || price < 1 || price > max_tick ||
        qty < 1 || qty > 1000000) {
        emit(rejected, 0, id, price, qty, -1, invalid);
        if (observer)
            observer(*this, 5, -1, -1);
        return false;
    }
    if (find(id) >= 0) {
        emit(rejected, 0, id, price, qty, -1, duplicate);
        if (observer)
            observer(*this, 5, -1, -1);
        return false;
    }
    // Capacity is checked before matching: rejection cannot partially execute.
    if (!free_count_) {
        emit(rejected, 0, id, price, qty, -1, exhausted);
        if (observer)
            observer(*this, 5, -1, -1);
        return false;
    }
    int slot = free_[--free_count_];
    orders[slot] = {id, side, price, qty, qty, -1, -1, command_sequence, true};
    insert_id(slot);
    active_count++;
    emit(accepted, 0, id, price, qty, slot);
    if (observer)
        observer(*this, 0, slot, -1);
    while (orders[slot].qty > 0) {
        int p = best(1 - side);
        if (p < 0 || (side == buy ? p > price : p < price))
            break;
        int maker = levels[1 - side][p].head;
        auto &m = orders[maker];
        if (observer)
            observer(*this, 1, slot, maker);
        int q = std::min(orders[slot].qty, m.qty);
        orders[slot].qty -= q;
        m.qty -= q;
        levels[1 - side][p].volume -= q;
        emit(trade, m.id, id, p, q, maker);
        if (m.qty == 0) {
            // Its remaining quantity is zero; traded volume was already removed.
            unlink(maker);
            release(maker);
        }
        if (observer)
            observer(*this, 2, slot, maker);
    }
    if (orders[slot].qty == 0)
        release(slot);
    else {
        auto &o = orders[slot];
        auto &l = levels[side][price];
        o.prev = l.tail;
        if (l.tail >= 0)
            orders[l.tail].next = slot;
        else
            l.head = slot;
        l.tail = slot;
        l.count++;
        l.volume += o.qty;
        bits_[side][price / 64] |= std::uint64_t(1) << (price % 64);
        emit(resting, 0, id, price, o.qty, slot);
    }
    if (observer)
        observer(*this, 3, -1, -1);
    return true;
}
bool Engine::cancel(std::uint32_t id) {
    event_count = 0;
    command_sequence++;
    int slot = find(id);
    if (slot < 0) {
        emit(rejected, 0, id, 0, 0, -1, unknown);
        if (observer)
            observer(*this, 5, -1, -1);
        return false;
    }
    auto o = orders[slot];
    unlink(slot);
    release(slot);
    emit(cancelled, id, 0, o.price, o.qty, slot);
    if (observer)
        observer(*this, 4, -1, slot);
    return true;
}
bool Engine::invariant() const {
    if (active_count + free_count_ != capacity)
        return false;
    std::array<bool, max_orders> seen{};
    int count = 0;
    for (int s = 0; s < 2; s++)
        for (int p = 1; p <= max_tick; p++) {
            const auto &l = levels[s][p];
            int prev = -1, n = 0;
            std::uint64_t vol = 0, seq = 0;
            for (int i = l.head; i >= 0; i = orders[i].next) {
                if (i >= capacity || seen[i] || ++n > capacity)
                    return false;
                seen[i] = true;
                const auto &o = orders[i];
                if (!o.active || o.side != s || o.price != p || o.prev != prev || o.qty <= 0 ||
                    o.sequence <= seq || find(o.id) != i)
                    return false;
                prev = i;
                seq = o.sequence;
                vol += o.qty;
            }
            if (prev != l.tail || n != l.count || vol != l.volume ||
                bool(bits_[s][p / 64] & (std::uint64_t(1) << (p % 64))) != (n > 0))
                return false;
            count += n;
        }
    for (int i = 0; i < free_count_; i++) {
        int s = free_[i];
        if (s < 0 || s >= capacity || seen[s] || orders[s].active)
            return false;
        seen[s] = true;
    }
    for (int i = 0; i < capacity; i++)
        if (!seen[i])
            return false;
    int indexed = 0;
    for (auto s : ids_)
        if (s >= 0) {
            if (s >= capacity || !orders[s].active)
                return false;
            indexed++;
        }
    return count == active_count && indexed == count &&
           (best(buy) < 0 || best(sell) < 0 || best(buy) < best(sell));
}
} // namespace lob
