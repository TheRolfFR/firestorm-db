<?php

// Merges the per-request pcov dumps written by coverage_prepend.php into a summary, a Cobertura XML file and an Istanbul JSON file (coverage-final.json next to it, mergeable with the c8 one).
// usage: php tests/php/coverage_report.php <raw dir> <cobertura output> [minimum line coverage percent]

$args = $_SERVER['argv'] ?? [];
[, $rawDir, $xmlPath] = $args + [null, null, null];
$minimum = isset($args[3]) ? (float) $args[3] : 0.0;

if (!$rawDir || !$xmlPath) {
    fwrite(STDERR, "usage: php coverage_report.php <raw dir> <cobertura output> [minimum percent]\n");
    exit(2);
}

$srcRoot = realpath(__DIR__ . '/../../src/server');
if ($srcRoot === false) {
    fwrite(STDERR, "Could not resolve src/server\n");
    exit(2);
}

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
$packages = [];
$istanbul = [];
$rows = [];

foreach ($merged as $file => $lines) {
    if (!str_starts_with($file, $srcRoot . '/'))
        continue;

    // polyfills only run on PHP versions older than the ones they backport, so their coverage depends on the runtime
    if (str_starts_with($file, $srcRoot . '/polyfills/'))
        continue;

    // pcov reports the implicit return past the last line, which coverage tools reject
    $lineCount = count(file($file) ?: []);
    $lines = array_filter($lines, fn($line) => $line <= $lineCount, ARRAY_FILTER_USE_KEY);

    ksort($lines);
    $hit = count(array_filter($lines, fn($state) => $state === 1));
    $total = count($lines);
    $totalHit += $hit;
    $totalLines += $total;

    $relative = substr($file, strlen($srcRoot) + 1);
    $rows[] = [$relative, $total === 0 ? 100.0 : $hit / $total * 100, $total, $hit];

    // paths relative to the repository root (the <source>) so consumers can resolve them from there
    // one Istanbul statement per executable line, so nyc can merge it with the client report and render the PHP source
    $source = file($file) ?: [];
    $statements = [];
    $hits = [];
    foreach ($lines as $line => $state) {
        $text = rtrim($source[$line - 1] ?? '', "\r\n");
        $statements[$line] = [
            'start' => ['line' => $line, 'column' => strlen($text) - strlen(ltrim($text))],
            'end' => ['line' => $line, 'column' => strlen($text)],
        ];
        $hits[$line] = $state === 1 ? 1 : 0;
    }
    $istanbul[$file] = [
        'path' => $file,
        'statementMap' => (object) $statements,
        's' => (object) $hits,
        'fnMap' => new stdClass(),
        'f' => new stdClass(),
        'branchMap' => new stdClass(),
        'b' => new stdClass(),
    ];

    $path = "src/server/$relative";
    $rate = $total === 0 ? 1 : $hit / $total;
    $xmlLines = '';
    foreach ($lines as $line => $state)
        $xmlLines .= '<line number="' . $line . '" hits="' . ($state === 1 ? 1 : 0) . '" branch="false"/>';

    $packages[dirname($path)][] = [
        'rate' => $rate,
        'xml' => '<class name="' . htmlspecialchars($path, ENT_XML1) . '" filename="' . htmlspecialchars($path, ENT_XML1)
            . '" line-rate="' . round($rate, 4) . '" branch-rate="0" complexity="0"><methods/><lines>' . $xmlLines . '</lines></class>',
    ];
}

$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<coverage line-rate="' . round($totalLines === 0 ? 1 : $totalHit / $totalLines, 4) . '" branch-rate="0" lines-covered="' . $totalHit
    . '" lines-valid="' . $totalLines . '" branches-covered="0" branches-valid="0" complexity="0" version="1" timestamp="' . time() . '">';
$xml .= '<sources><source>.</source></sources><packages>';
foreach ($packages as $name => $classes) {
    $rate = array_sum(array_column($classes, 'rate')) / count($classes);
    $xml .= '<package name="' . htmlspecialchars($name, ENT_XML1) . '" line-rate="' . round($rate, 4) . '" branch-rate="0" complexity="0"><classes>'
        . implode('', array_column($classes, 'xml')) . '</classes></package>';
}
$xml .= '</packages></coverage>' . "\n";

@mkdir(dirname($xmlPath), 0777, true);
file_put_contents($xmlPath, $xml);
file_put_contents(dirname($xmlPath) . '/coverage-final.json', json_encode((object) $istanbul));

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
