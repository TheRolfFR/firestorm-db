<?php

require_once './config.php';

const LOG_PATH_ENV = "FIRESTORM_LOG_PATH";
const LOG_PATH_DEFAULT = "out.log";

/** Appends timestamped operational messages to the configured log destination. */
class Log {
    /** Resolves the log path from the environment or config and appends one complete timestamped record. */
    public static function addLog(string $message): void {
        global $log_path;

        $path = LOG_PATH_DEFAULT;

        $env_log_path = getenv(LOG_PATH_ENV);
        if($env_log_path !== false and strlen(trim($env_log_path)) > 0)
        {
            $path = trim($env_log_path);
        } else if($log_path and is_string($log_path) and strlen(trim($log_path)) > 0) {
            $path = $log_path;
        }

        $now = new DateTime();
        $fp = fopen($path, 'a');
        if ($fp === false)
            throw new Exception("Could not open log path $path");

        fwrite($fp, $now->format('Y-m-d H:i:s'));
        fwrite($fp, $message);
        fwrite($fp, '\n');
        fclose($fp);
    }
}
