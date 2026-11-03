#include "engine.hpp"
#include <algorithm>
#include <chrono>
#include <iostream>
#include <memory>
#include <vector>
using Clock = std::chrono::steady_clock;
static void report(std::vector<double> &samples) {
    std::sort(samples.begin(), samples.end());
    auto q = [&](double x) { return samples[std::size_t((samples.size() - 1) * x)]; };
    std::cout << "\"p50\":" << q(.5) << ",\"p95\":" << q(.95) << ",\"p99\":" << q(.99);
}
int main() {
    auto e = std::make_unique<lob::Engine>(2048);
    constexpr int N = 5000;
    std::cout << "{\"samplesPerFixture\":" << N
              << ",\"warmups\":500,\"unit\":\"ns\",\"inspection\":\"disabled\",\"sweeps\":[";
    bool comma = false;
    for (int makers : {1, 4, 16, 64}) {
        std::vector<double> times;
        times.reserve(N);
        e->reset(2048);
        for (int n = 0; n < N + 500; n++) {
            for (int j = 0; j < makers; j++)
                e->submit(j + 1, 1, 10000 + j, 10);
            auto start = Clock::now();
            e->submit(1000, 0, 10000 + makers, makers * 10);
            auto stop = Clock::now();
            if (n >= 500)
                times.push_back(std::chrono::duration<double, std::nano>(stop - start).count());
        }
        std::cout << (comma ? "," : "") << "{\"makers\":" << makers << ",";
        report(times);
        std::cout << "}";
        comma = true;
    }
    std::cout << "],\"cancellations\":[";
    comma = false;
    for (int count : {16, 128, 512, 1024})
        for (int levels : {1, 8, 16}) {
            e->reset(2048);
            for (int j = 1; j <= count; j++)
                e->submit(j, 0, 9000 + j % levels, 10);
            std::vector<double> times;
            times.reserve(N);
            int id = count / 2, price = 9000 + id % levels;
            for (int n = 0; n < N + 500; n++) {
                auto start = Clock::now();
                e->cancel(id);
                auto stop = Clock::now();
                e->submit(id, 0, price, 10);
                if (n >= 500)
                    times.push_back(std::chrono::duration<double, std::nano>(stop - start).count());
            }
            std::cout << (comma ? "," : "") << "{\"orders\":" << count << ",\"levels\":" << levels
                      << ",";
            report(times);
            std::cout << "}";
            comma = true;
        }
    std::cout << "],\"layout\":{\"engineBytes\":" << sizeof(lob::Engine)
              << ",\"orderBytes\":" << sizeof(lob::Order)
              << ",\"levelBytes\":" << sizeof(lob::Level)
              << ",\"eventBytes\":" << sizeof(lob::Event) << ",\"maxOrders\":" << lob::max_orders
              << ",\"tickCount\":" << lob::max_tick + 1 << ",\"indexBuckets\":" << lob::index_size
              << ",\"bitmapWordsPerSide\":" << lob::words << "}}\n";
}
