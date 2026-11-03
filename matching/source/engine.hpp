#pragma once
#include <array>
#include <bit>
#include <cstddef>
#include <cstdint>

namespace lob {
constexpr int max_orders = 4096, max_tick = 20000, index_size = 8192, words = (max_tick + 64) / 64;
enum Side { buy = 0, sell = 1 };
enum Kind { accepted = 0, trade = 1, resting = 2, cancelled = 3, rejected = 4 };
enum Reason { none = 0, invalid = 1, duplicate = 2, exhausted = 3, unknown = 4 };
struct Order {
    std::uint32_t id = 0;
    int side = 0, price = 0, qty = 0, initial = 0, prev = -1, next = -1;
    std::uint64_t sequence = 0;
    bool active = false;
};
struct Level {
    int head = -1, tail = -1, count = 0;
    std::uint64_t volume = 0;
};
struct Event {
    int kind = 0;
    std::uint32_t maker = 0, taker = 0;
    int price = 0, qty = 0, slot = -1, reason = 0;
    std::uint64_t sequence = 0;
};
class Engine {
    std::array<int, max_orders> free_{};
    std::array<int, index_size> ids_{};
    std::array<std::array<std::uint64_t, words>, 2> bits_{};
    int free_count_ = 0;
    std::size_t bucket(std::uint32_t id) const {
        return (std::uint64_t(id) * 2654435761U) & (index_size - 1);
    }
    void insert_id(int slot);
    void erase_id(std::uint32_t id);
    void unlink(int slot);
    void release(int slot);
    void emit(int kind, std::uint32_t maker, std::uint32_t taker, int price, int qty, int slot,
              int reason = 0);

  public:
    // Optional inspection hook. Native timing leaves this null.
    using Observer = void (*)(const Engine &, int phase, int incoming, int maker);
    Observer observer = nullptr;
    std::array<Order, max_orders> orders{};
    std::array<std::array<Level, max_tick + 1>, 2> levels{};
    std::array<Event, max_orders + 4> events{};
    int event_count = 0, capacity = 128, active_count = 0;
    std::uint64_t command_sequence = 0, event_sequence = 0;
    explicit Engine(int cap = 128) {
        reset(cap);
    }
    void reset(int cap = 128);
    int find(std::uint32_t id) const;
    int best(int side) const;
    bool submit(std::uint32_t id, int side, int price, int qty);
    bool cancel(std::uint32_t id);
    bool invariant() const;
    int free_count() const {
        return free_count_;
    }
    int index_slot(int bucket_number) const {
        return bucket_number >= 0 && bucket_number < index_size ? ids_[bucket_number] : -1;
    }
    std::size_t home_bucket(std::uint32_t id) const {
        return bucket(id);
    }
};
} // namespace lob
