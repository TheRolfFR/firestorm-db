<?php

// Loaded through auto_prepend_file by tests/php/php_server_start.sh when PHP_COVERAGE_DIR is set.
// Each request records the lines pcov saw and dumps them for tests/php/coverage_report.php to merge.

$coverageDir = getenv('PHP_COVERAGE_DIR');

if ($coverageDir && function_exists('pcov\start')) {
    \pcov\start();

    register_shutdown_function(function () use ($coverageDir): void {
        \pcov\stop();

        $data = \pcov\collect(\pcov\all);
        if ($data === [])
            return;

        file_put_contents($coverageDir . '/' . uniqid('cov-', true) . '.json', json_encode($data));
    });
}
