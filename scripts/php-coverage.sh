#!/bin/sh
# Merges the raw pcov dumps into a Cobertura report (coverage/php/cobertura-coverage.xml) and checks the minimum.
# usage: sh scripts/php-coverage.sh <min line coverage percent>
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$ROOT" || exit 1

exec php tests/php/coverage_report.php coverage/php-raw coverage/php/cobertura-coverage.xml "${1:-0}"
