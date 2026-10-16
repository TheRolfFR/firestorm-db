<?php

// Merges the per-request pcov dumps written by coverage_prepend.php into a summary and an lcov file.
// usage: php tests/php/coverage_report.php <raw dir> <lcov output> [minimum line coverage percent]

[, $rawDir, $lcovPath] = $argv + [null, null, null];
$minimum = isset($argv[3]) ? (float) $argv[3] : 0.0;

if (!$rawDir || !$lcovPath) {
    fwrite(STDERR, "usage: php coverage_report.php <raw dir> <lcov output> [minimum percent]\n");
    exit(2);
}

$srcRoot = realpath(__DIR__ . '/../../src/server');

// pcov line states: 1 = executed, -1 = executable but not executed, -2 = dead code
$merged = [];
foreach (glob($rawDir . '/*.json') ?: [] as $dump) {
    $data = json_decode((string) file_get_contents($dump), true);
    foreach (is_array($data) ? $data : [] as $file => $lines) {
        foreach ($lines as $line => $state) {
            if ($state === -2)
                continue;
            $merged[$file][$line] = max($merged[$file][$line] ?? -1, $state);
        }
    }
}

if ($merged === []) {
    fwrite(STDERR, "No coverage data found in $rawDir, is pcov installed and enabled?\n");
    exit(1);
}

ksort($merged);

$totalHit = 0;
$totalLines = 0;
$lcov = '';
$rows = [];

foreach ($merged as $file => $lines) {
    if (!str_starts_with($file, $srcRoot . '/'))
        continue;

    // polyfills only run on PHP versions older than the ones they backport, so their coverage depends on the runtime
    if (str_starts_with($file, $srcRoot . '/polyfills/'))
        continue;

    // pcov reports the implicit return past the last line, which lcov tools reject
    $lineCount = count(file($file));
    $lines = array_filter($lines, fn($line) => $line <= $lineCount, ARRAY_FILTER_USE_KEY);

    ksort($lines);
    $hit = count(array_filter($lines, fn($state) => $state === 1));
    $total = count($lines);
    $totalHit += $hit;
    $totalLines += $total;

    $relative = substr($file, strlen($srcRoot) + 1);
    $rows[] = [$relative, $total === 0 ? 100.0 : $hit / $total * 100, $total, $hit];

    // paths relative to the repository root so lcov consumers can resolve them from there
    $lcov .= "SF:src/server/$relative\n";
    foreach ($lines as $line => $state)
        $lcov .= "DA:$line," . ($state === 1 ? 1 : 0) . "\n";
    $lcov .= "LF:$total\nLH:$hit\nend_of_record\n";
}

@mkdir(dirname($lcovPath), 0777, true);
file_put_contents($lcovPath, $lcov);

printf("%-40s | %7s | %6s | %5s\n", 'File', '% Lines', 'Lines', 'Hit');
echo str_repeat('-', 66) . "\n";
foreach ($rows as [$name, $percent, $total, $hit])
    printf("%-40s | %7.2f | %6d | %5d\n", $name, $percent, $total, $hit);

$overall = $totalLines === 0 ? 100.0 : $totalHit / $totalLines * 100;
echo str_repeat('-', 66) . "\n";
printf("%-40s | %7.2f | %6d | %5d\n", 'All files', $overall, $totalLines, $totalHit);

if ($overall < $minimum) {
    fprintf(STDERR, "\nPHP line coverage %.2f%% is below the required %.2f%%\n", $overall, $minimum);
    exit(1);
}
