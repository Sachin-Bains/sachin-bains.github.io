#include "engine.hpp"
#include <algorithm>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <new>
#include <random>
#include <stdexcept>
#include <vector>
static bool count_allocations = false;
static std::size_t allocations = 0;
void *operator new(std::size_t n) {
    if (count_allocations)
        allocations++;
    if (auto p = std::malloc(n ? n : 1))
        return p;
    throw std::bad_alloc();
}
void operator delete(void *p) noexcept {
    std::free(p);
}
void operator delete(void *p, std::size_t) noexcept {
    std::free(p);
}
void *operator new[](std::size_t n) {
    return ::operator new(n);
}
void operator delete[](void *p) noexcept {
    std::free(p);
}
void operator delete[](void *p, std::size_t) noexcept {
    std::free(p);
}
static int checks = 0;
static void check(bool b, const char *msg) {
    checks++;
    if (!b)
        throw std::runtime_error(msg);
}
struct RefOrder {
    unsigned id;
    int side, price, qty;
};
struct Ref {
    std::vector<RefOrder> orders;
    std::vector<RefOrder> fills;
    int capacity = 32;
    bool add(unsigned id, int side, int price, int qty) {
        fills.clear();
        if (!id || id > 2147483647U || side < 0 || side > 1 || price < 1 || price > lob::max_tick ||
            qty < 1 || qty > 1000000 || orders.size() >= std::size_t(capacity) ||
            std::any_of(orders.begin(), orders.end(), [&](auto o) { return o.id == id; }))
            return false;
        while (qty) {
            int best = -1;
            for (int i = 0; i < int(orders.size()); i++) {
                auto o = orders[i];
                if (o.side == side || (side == 0 ? o.price > price : o.price < price))
                    continue;
                if (best < 0 ||
                    (side == 0 ? o.price < orders[best].price : o.price > orders[best].price))
                    best = i;
            }
            if (best < 0)
                break;
            auto &o = orders[best];
            int q = std::min(qty, o.qty);
            fills.push_back({o.id, side, o.price, q});
            qty -= q;
            o.qty -= q;
            if (!o.qty)
                orders.erase(orders.begin() + best);
        }
        if (qty)
            orders.push_back({id, side, price, qty});
        return true;
    }
    bool cancel(unsigned id) {
        auto it = std::find_if(orders.begin(), orders.end(), [&](auto o) { return o.id == id; });
        if (it == orders.end())
            return false;
        orders.erase(it);
        return true;
    }
};
int main() {
    try {
        auto p = std::make_unique<lob::Engine>(32);
        auto &e = *p;
        e.submit(1, 1, 10100, 50);
        e.submit(2, 1, 10100, 70);
        e.submit(3, 1, 10150, 100);
        check(e.submit(4, 0, 10100, 100), "example accepted");
        check(e.event_count == 3 && e.events[1].maker == 1 && e.events[1].qty == 50 &&
                  e.events[2].maker == 2 && e.events[2].qty == 50,
              "FIFO example trades");
        check(e.orders[e.find(2)].qty == 20 && e.orders[e.find(3)].qty == 100, "example residual");
        check(e.events[1].price == 10100, "resting price");
        check(e.invariant(), "example invariants");
        e.reset();
        e.submit(1, 0, 9900, 10);
        e.submit(2, 0, 10000, 20);
        e.submit(3, 0, 10000, 10);
        e.submit(4, 1, 9800, 35);
        check(e.events[1].maker == 2 && e.events[2].maker == 3 && e.events[3].maker == 1,
              "price before time and sell sweep");
        check(e.orders[e.find(1)].qty == 5, "sweep residual");
        check(e.invariant(), "sell invariants");
        e.reset();
        for (int i = 1; i <= 4; i++)
            e.submit(i, 0, 100, 10);
        check(e.cancel(2) && e.cancel(1) && e.cancel(4) && e.cancel(3),
              "middle/head/tail/only cancel");
        check(e.best(0) == -1 && e.invariant(), "empty level removed");
        check(!e.cancel(99) && e.events[0].reason == lob::unknown, "unknown cancel");
        check(!e.submit(0, 0, 100, 10) && !e.submit(1, 2, 100, 10) && !e.submit(1, 0, 0, 10) &&
                  !e.submit(1, 0, 20001, 10) && !e.submit(1, 0, 100, 0) &&
                  !e.submit(1, 0, 100, 1000001),
              "invalid values");
        e.submit(1, 0, 100, 10);
        check(!e.submit(1, 1, 100, 20) && e.orders[e.find(1)].qty == 10, "duplicate no mutation");
        e.reset(1);
        e.submit(1, 1, 100, 10);
        check(!e.submit(2, 0, 100, 10) && e.find(1) >= 0, "full pool rejects before matching");
        e.cancel(1);
        check(e.submit(2, 1, 100, 10) && e.orders[e.find(2)].prev == -1 && e.invariant(),
              "pool recycled cleanly");
        e.reset();
        e.submit(1, 1, 1, 1);
        e.submit(2, 0, 20000, 1);
        check(e.events[1].price == 1 && e.active_count == 0, "boundary ticks");
        check(e.submit(1, 0, 20000, 1), "inactive ID reused");
        e.reset(32);
        unsigned home = 1;
        while (((std::uint64_t(home) * 2654435761U) & 8191) < 8190)
            home++;
        for (unsigned i = 0; i < 16; i++)
            check(e.submit(home + i * 8192, 0, 10000, 10), "collision insert");
        for (unsigned removed : {7U, 0U, 15U, 3U}) {
            check(e.cancel(home + removed * 8192), "collision cancel");
            check(e.invariant(), "wrapped backward-shift deletion");
        }
        for (unsigned i = 0; i < 16; i++)
            check((e.find(home + i * 8192) >= 0) == (i != 7 && i != 0 && i != 15 && i != 3),
                  "collision lookup retained");
        for (unsigned seed = 1; seed <= 5; seed++) {
            e.reset(32);
            Ref ref;
            std::mt19937 random(seed);
            for (int k = 0; k < 10000; k++) {
                unsigned id = random() % 200 + 1;
                if (random() % 4 == 0) {
                    check(e.cancel(id) == ref.cancel(id), "reference cancel");
                } else {
                    int side = int(random() % 2), price = 9900 + int(random() % 21),
                        qty = int(random() % 100) + 1;
                    check(e.submit(id, side, price, qty) == ref.add(id, side, price, qty),
                          "reference accept");
                    std::vector<RefOrder> actual;
                    for (int j = 0; j < e.event_count; j++) {
                        auto v = e.events[j];
                        if (v.kind == lob::trade)
                            actual.push_back({v.maker, side, v.price, v.qty});
                    }
                    check(actual.size() == ref.fills.size(), "reference fill count");
                    for (std::size_t j = 0; j < actual.size(); j++)
                        check(actual[j].id == ref.fills[j].id &&
                                  actual[j].price == ref.fills[j].price &&
                                  actual[j].qty == ref.fills[j].qty,
                              "reference execution order");
                }
                check(e.active_count == int(ref.orders.size()), "reference active count");
                for (auto o : ref.orders) {
                    int s = e.find(o.id);
                    check(s >= 0 && e.orders[s].qty == o.qty && e.orders[s].side == o.side &&
                              e.orders[s].price == o.price,
                          "reference book equality");
                }
                if (k % 25 == 0)
                    check(e.invariant(), "random invariant");
            }
        }
        e.reset(64);
        allocations = 0;
        count_allocations = true;
        for (int i = 0; i < 10000; i++) {
            e.submit(1, 1, 10000, 20);
            e.submit(2, 1, 10000, 30);
            e.submit(3, 0, 10000, 25);
            e.cancel(2);
        }
        count_allocations = false;
        check(allocations == 0, "no heap allocations in command path");
        check(e.invariant(), "allocation workload invariant");
        std::cout << "{\"passed\":true,\"assertions\":" << checks
                  << ",\"randomCommands\":50000,\"seeds\":5,\"allocationWorkloadCommands\":40000,"
                     "\"observedAllocations\":"
                  << allocations << "}\n";
        return 0;
    } catch (const std::exception &ex) {
        std::cerr << ex.what() << '\n';
        return 1;
    }
}
