<?php

class FileAccess {
    public static function read($filepath, $waitLock = false, $default = null) {
        $fileObj = array('filepath' => $filepath, 'content' => '');
        // open file as binary
        $file = fopen($filepath, 'rb');

        // exit if couldn't find file
        if ($file === false) {
            if ($default == null)
                throw new Exception("Could not open file: $filepath");

            // set default value
            $fileObj['content'] = $default;
        }

        // if no file, puts default value inside
        if ($file === false) {
            file_put_contents($fileObj['filepath'], $fileObj['content'], LOCK_EX);
            $file = fopen($filepath, 'rb');
        }

        $fileObj['fd'] = $file;

        // if want the lock, we wait for the shared lock
        if ($waitLock) {
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

        $fileObj['content'] = $string;

        // if no wait you can close the file
        if (!$waitLock)
            fclose($file);

        return $fileObj;
    }
    public static function write($fileObj) {
        // lock and close
        flock($fileObj['fd'], LOCK_UN);
        fclose($fileObj['fd']);

        if (!is_writable($fileObj['filepath'])) {
            throw new HTTPException("PHP script can't write to file. Check permission, group and owner.", 400);
        }

        $ret = file_put_contents($fileObj['filepath'], $fileObj['content'], LOCK_EX);
	return $ret;
    }
}