#!/bin/sh
# Prints a markdown table with the coverage of every file found in the given lcov tracefiles.
# The PR comment of the report action only lists the files changed by the PR, and the client is recorded as compiled dist/ files.
# usage: sh scripts/lcov-table.sh <lcov file>...
set -e

[ "$#" -gt 0 ] || { echo "usage: sh scripts/lcov-table.sh <lcov file>..." >&2; exit 2; }

MERGED="$(mktemp)"
trap 'rm -f "$MERGED"' EXIT

# same leniency as the report action: c8 reports hit lines without branch data
IGNORE="inconsistent,corrupt,empty"

set --  $(for f in "$@"; do printf -- '--add-tracefile %s ' "$f"; done)
lcov "$@" --output-file "$MERGED" --rc branch_coverage=1 --ignore-errors "$IGNORE" > /dev/null 2>&1

echo '| File | Lines | Branches |'
echo '|---|---|---|'
lcov --list "$MERGED" --list-full-path --rc branch_coverage=1 --ignore-errors "$IGNORE" 2>/dev/null | awk -F'|' '
function cell(raw,    n, parts, pct) {
    n = split(raw, parts, " ")
    if (n < 2 || parts[1] == "-") return "⚪ –"
    pct = parts[1] + 0
    return (pct >= 90 ? "🟢" : pct >= 70 ? "🟡" : "🔴") " " sprintf("%.1f%%", pct) " (" parts[2] ")"
}
NF >= 4 && $1 !~ /^ *Filename/ && $1 !~ /^=+$/ && $1 !~ /Total:/ {
    name = $1; gsub(/^ +| +$/, "", name)
    if (name == "") next
    printf "| `%s` | %s | %s |\n", name, cell($2), cell($4)
}
NF >= 4 && $1 ~ /Total:/ { total = sprintf("| **Total** | %s | %s |", cell($2), cell($4)) }
END { if (total != "") print total }
'
