#include "engine.hpp"
#include <algorithm>
#include <chrono>
#include <iostream>
#include <memory>
#include <string>
#include <vector>
using Clock = std::chrono::steady_clock;
int main() {
    auto e = std::make_unique<lob::Engine>(2048);
    constexpr int N = 20000;
    std::cout << "{\"clock\":\"std::chrono::steady_clock\",\"unit\":\"ns\",\"samplesPerWorkload\":"
              << N << ",\"workloads\":[";
    for (int mode = 0; mode < 4; mode++) {
        e->reset(2048);
        std::vector<double> v;
        v.reserve(N);
        for (int i = 0; i < N + 2000; i++) {
            if (mode == 1)
                e->submit(1, 0, 10000, 10);
            if (mode == 2)
                e->submit(1, 1, 10000, 10);
            if (mode == 3)
                for (int j = 0; j < 8; j++)
                    e->submit(j + 1, 1, 10000 + j, 10);
            auto t = Clock::now();
            if (mode == 0)
                e->submit(1, 0, 10000, 10);
            if (mode == 1)
                e->cancel(1);
            if (mode == 2)
                e->submit(2, 0, 10000, 10);
            if (mode == 3)
                e->submit(20, 0, 10007, 80);
            auto end = Clock::now();
            if (i >= 2000)
                v.push_back(std::chrono::duration<double, std::nano>(end - t).count());
            if (mode == 0)
                e->cancel(1);
        }
        std::sort(v.begin(), v.end());
        auto q = [&](double x) { return v[std::size_t((v.size() - 1) * x)]; };
        std::cout << (mode ? "," : "") << "{\"name\":\""
                  << std::vector<std::string>{"insert-empty-level", "cancel-known-order",
                                              "match-one-maker", "sweep-eight-levels"}[mode]
                  << "\",\"p50\":" << q(.5) << ",\"p95\":" << q(.95) << ",\"p99\":" << q(.99)
                  << ",\"samples\":[";
        for (std::size_t i = 0; i < v.size(); i++)
            std::cout << (i ? "," : "") << v[i];
        std::cout << "]}";
    }
    auto start = Clock::now();
    for (int i = 0; i < 100000; i++) {
        e->submit(1, 0, 10000, 10);
        e->cancel(1);
    }
    double secs = std::chrono::duration<double>(Clock::now() - start).count();
    std::cout << "],\"pairedInsertCancelCommands\":200000,\"pairedInsertCancelSeconds\":" << secs
              << ",\"pairedInsertCancelCommandsPerSecond\":" << 200000 / secs << "}\n";
}
