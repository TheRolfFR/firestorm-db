<?php

include_once('./config.php');

$path = isset($log_path) ? $log_path : "out.log";

class Log {
    public static function addLog($message) {
        $now = new DateTime();
        $fp = fopen($path, 'a');
        fwrite($fp, $now->format('Y-m-d H:i:s'));
        fwrite($fp, $message);
        fwrite($fp, '\n');  
        fclose($fp);  
    }
}