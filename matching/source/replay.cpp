#include <iostream>
#include <sstream>
#include <string>
extern "C" {
void book_reset(int);
int book_submit(int, int, int, int);
int book_cancel(int);
const char *book_snapshot();
}
int main() {
    std::string line;
    while (std::getline(std::cin, line)) {
        std::istringstream in(line);
        std::string op;
        int a = 0, b = 0, c = 0, d = 0;
        in >> op;
        if (op == "RESET" && in >> a)
            book_reset(a);
        else if (op == "ADD" && in >> a >> b >> c >> d)
            book_submit(a, b, c, d);
        else if (op == "CANCEL" && in >> a)
            book_cancel(a);
        else
            return 2;
        std::cout << book_snapshot() << '\n';
    }
}
