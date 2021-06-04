<?php

class FileAccess {
    public static function read($filepath, $waitLock = false, $default = null) {
            $fileobj = array('filepath' => $filepath, 'content' => '');
            // open file as binary
            $file = fopen($filepath, 'rb');
            
            // exit if couldn't find file
            if ($file === false) {
                if($default == null)
                    throw new Exception('Could not open file: ' . $filepath);
                
                // set default value
                $fileobj['content'] = $default;
            }
            
            // if no file, puts default value inside
            if($file === false) {
                file_put_contents($fileobj['filepath'], $fileobj['content'], LOCK_EX);
                $file = fopen($filepath, 'rb');
            }
            
            $fileobj['fd'] = $file;
            
            // if want the lock, we wait for the shared lock
            if($waitLock) {
                $lock = flock($file, LOCK_SH);
                if (!$lock) {
                    fclose($file);
                    throw new Exception('Failed to lock file');
                }
            }
            
            // read file content
            $string = '';
            while (!feof($file)) {
                $string .= fread($file, 8192);
            }
            
            $fileobj['content'] = $string;
            
            // if no wait you can close the file
            if(!$waitLock)
                fclose($file);
            
            return $fileobj;
    }
    public static function write($fileobj) {
        // unlock and close
        flock($fileobj['fd'], LOCK_UN);
        fclose($fileobj['fd']);
        
        return file_put_contents($fileobj['filepath'], $fileobj['content'], LOCK_EX);
    }
}