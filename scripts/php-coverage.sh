#!/bin/sh
# Merges the raw pcov dumps, then renders one HTML report (client + server) with genhtml when it is installed.
# usage: sh scripts/php-coverage.sh <min line coverage percent>
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT" || exit 1

# tsx injects helper functions (__name, __export, ...) at line 1 of every file, c8 records them as functions
# that collide with the real ones and make lcov tools warn, so keep only the line and branch records
if [ -f coverage/lcov.info ]; then
    grep -v -E '^(FN|FNDA|FNF|FNH):' coverage/lcov.info > coverage/lcov.info.tmp && mv coverage/lcov.info.tmp coverage/lcov.info
fi

php tests/php/coverage_report.php coverage/php-raw coverage/php/lcov.info "${1:-0}"
STATUS=$?

if [ -f coverage/php/lcov.info ]; then
    if command -v genhtml > /dev/null 2>&1; then
        # coverage/lcov.info is the client report written by c8, paths are relative to the repository root
        INPUTS="coverage/php/lcov.info"
        [ -f coverage/lcov.info ] && INPUTS="coverage/lcov.info $INPUTS"

        rm -rf coverage/html
        genhtml $INPUTS --output-directory coverage/html --quiet \
            && echo "HTML report: coverage/html/index.html"
    else
        echo "genhtml not found, skipping the HTML report (install the 'lcov' package: brew install lcov / apt install lcov)." >&2
    fi
fi

exit $STATUS
