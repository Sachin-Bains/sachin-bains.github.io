#include "engine.hpp"
#include <algorithm>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
static lob::Engine engine;
static char buffer[1500000];
static std::size_t pos;
struct TraceFrame {
    int phase = 0, incoming = -1, maker = -1, capacity = 0, active = 0, free = 0;
    bool valid = false;
    std::uint64_t sequence = 0;
    std::array<lob::Order, 128> orders{};
};
static std::array<TraceFrame, 128> frames;
static int frame_count = 0;
static bool trace_truncated = false;
static char trace_buffer[4000000];
static std::size_t trace_pos = 0;
static void trace_out(const char *format, ...) {
    if (trace_pos >= sizeof(trace_buffer) - 1)
        return;
    va_list args;
    va_start(args, format);
    int n =
        std::vsnprintf(trace_buffer + trace_pos, sizeof(trace_buffer) - trace_pos, format, args);
    va_end(args);
    if (n > 0)
        trace_pos += std::min<std::size_t>(n, sizeof(trace_buffer) - trace_pos - 1);
}
static void capture(const lob::Engine &e, int phase, int incoming, int maker) {
    if (e.capacity > 128) {
        trace_truncated = true;
        return;
    }
    int at = frame_count;
    if (at >= 128) {
        trace_truncated = true;
        if (phase < 3)
            return;
        at = 127;
    } else
        frame_count++;
    auto &f = frames[at];
    f.phase = phase;
    f.incoming = incoming;
    f.maker = maker;
    f.capacity = e.capacity;
    f.active = e.active_count;
    f.free = e.free_count();
    f.valid = phase >= 3 ? e.invariant() : false;
    f.sequence = e.event_sequence;
    for (int i = 0; i < e.capacity; i++)
        f.orders[i] = e.orders[i];
}
static void out(const char *f, ...) {
    va_list args;
    va_start(args, f);
    auto n = std::vsnprintf(buffer + pos, sizeof(buffer) - pos, f, args);
    va_end(args);
    if (n > 0)
        pos += static_cast<std::size_t>(n);
}
extern "C" {
void book_reset(int cap) {
    frame_count = 0;
    trace_truncated = false;
    engine.reset(cap);
}
int book_submit(int id, int side, int price, int qty) {
    frame_count = 0;
    trace_truncated = false;
    return engine.submit(static_cast<std::uint32_t>(id), side, price, qty);
}
int book_cancel(int id) {
    frame_count = 0;
    trace_truncated = false;
    return engine.cancel(static_cast<std::uint32_t>(id));
}
const char *book_snapshot() {
    pos = 0;
    out("{\"command\":%llu,\"capacity\":%d,\"active\":%d,\"free\":%d,\"valid\":%s,\"bestBid\":%d,"
        "\"bestAsk\":%d,\"orders\":[",
        static_cast<unsigned long long>(engine.command_sequence), engine.capacity,
        engine.active_count, engine.free_count(), engine.invariant() ? "true" : "false",
        engine.best(0), engine.best(1));
    bool comma = false;
    for (int i = 0; i < engine.capacity; i++) {
        const auto &o = engine.orders[i];
        if (!o.active)
            continue;
        out("%s{\"id\":%u,\"side\":%d,\"price\":%d,\"qty\":%d,\"initial\":%d,\"slot\":%d,\"prev\":%"
            "d,\"next\":%d,\"sequence\":%llu}",
            comma ? "," : "", o.id, o.side, o.price, o.qty, o.initial, i, o.prev, o.next,
            static_cast<unsigned long long>(o.sequence));
        comma = true;
    }
    out("],\"events\":[");
    for (int i = 0; i < engine.event_count; i++) {
        auto &e = engine.events[i];
        out("%s{\"kind\":%d,\"maker\":%u,\"taker\":%u,\"price\":%d,\"qty\":%d,\"slot\":%d,"
            "\"reason\":%d,\"sequence\":%llu}",
            i ? "," : "", e.kind, e.maker, e.taker, e.price, e.qty, e.slot, e.reason,
            static_cast<unsigned long long>(e.sequence));
    }
    out("]}");
    return buffer;
}
void book_trace_enable(int enabled) {
    engine.observer = enabled ? capture : nullptr;
    frame_count = 0;
    trace_truncated = false;
}
const char *book_trace() {
    trace_pos = 0;
    trace_out("{\"truncated\":%s,\"frames\":[", trace_truncated ? "true" : "false");
    for (int j = 0; j < frame_count; j++) {
        auto &f = frames[j];
        trace_out("%s{\"phase\":%d,\"incoming\":%d,\"maker\":%d,\"capacity\":%d,\"active\":%d,"
                  "\"free\":%d,\"valid\":%s,\"sequence\":%llu,\"orders\":[",
                  j ? "," : "", f.phase, f.incoming, f.maker, f.capacity, f.active, f.free,
                  f.phase < 3 ? "null"
                  : f.valid   ? "true"
                              : "false",
                  static_cast<unsigned long long>(f.sequence));
        bool comma = false;
        for (int i = 0; i < f.capacity; i++) {
            const auto &o = f.orders[i];
            if (!o.active)
                continue;
            trace_out("%s{\"id\":%u,\"side\":%d,\"price\":%d,\"qty\":%d,\"slot\":%d,\"prev\":%d,"
                      "\"next\":%d,\"sequence\":%llu}",
                      comma ? "," : "", o.id, o.side, o.price, o.qty, i, o.prev, o.next,
                      static_cast<unsigned long long>(o.sequence));
            comma = true;
        }
        trace_out("]}");
    }
    trace_out("]}");
    return trace_buffer;
}
const char *book_index() {
    pos = 0;
    out("{\"capacity\":%d,\"entries\":[", lob::index_size);
    bool comma = false;
    for (int b = 0; b < lob::index_size; b++) {
        int s = engine.index_slot(b);
        if (s < 0)
            continue;
        auto &o = engine.orders[s];
        auto home = engine.home_bucket(o.id);
        out("%s{\"bucket\":%d,\"id\":%u,\"slot\":%d,\"home\":%u,\"distance\":%u}", comma ? "," : "",
            b, o.id, s, unsigned(home), unsigned((b - home) & (lob::index_size - 1)));
        comma = true;
    }
    out("]}");
    return buffer;
}
}
