<?php

require_once __DIR__ . '/polyfills/polyfills.php';

/** Appends timestamped operational messages to the configured log destination. */
class Log {
    public const LOG_PATH_ENV = "FIRESTORM_LOG_PATH";
    public const LOG_PATH_DEFAULT = "out.log";

    /** Resolves the log path from the environment or config and appends one complete timestamped record. */
    public static function addLog(string $message): void {
        global $log_path;

        $path = self::LOG_PATH_DEFAULT;

        $env_log_path = getenv(self::LOG_PATH_ENV);
        if ($env_log_path !== false && strlen(mb_trim($env_log_path)) > 0) {
            $path = mb_trim($env_log_path);
        } else if ($log_path && is_string($log_path) && strlen(mb_trim($log_path)) > 0) {
            $path = $log_path;
        }

        $now = new DateTime();
        $fp = fopen($path, 'a');
        if ($fp === false)
            throw new Exception("Could not open log path $path");

        fwrite($fp, $now->format('Y-m-d H:i:s') . ' ' . $message . "\n");
        fclose($fp);
    }
}
