<?php

/** Carries a file's path, raw bytes, decoded collection data, and optional lock handle. */
class FileObject {
    /**
     * Raw bytes read from disk; JSONDatabase serializes decoded collections into this field before writing.
     */
    public string $content = '';
    /**
     * Decoded collection data maintained separately from raw bytes to keep file I/O and JSON manipulation distinct.
     * @var array<int|string, mixed>
     */
    public array $json = [];
    /**
     * Open stream retained only while a caller holds a shared lock and must later release it through write().
     * @var resource|null $fd
     */
    public $fd = null;

    /** Initializes a transport object before any stream is opened. */
    public function __construct(
        /** Absolute or application-relative path used for every read and write operation. */
        public readonly string $filepath
    ) {}
}

// basically a namespace
abstract class FileAccess {
    /**
     * Opens a file, optionally retains an exclusive lock for a later write, and creates missing files from a supplied default.
     *
     * @param string $filepath Path to the file to read.
     * @param bool $waitLock Whether to acquire an exclusive lock (LOCK_EX) and keep the file open.
     * @param string|null $default Default content written to the file if it doesn't exist.
     * @return FileObject The file object containing the path, content, and (optionally) an open descriptor.
     * @throws Exception If the file cannot be opened, created, or locked.
     */
    public static function read(string $filepath, bool $waitLock = false, ?string $default = null): FileObject {
        $fileObj = new FileObject($filepath);

        $mode = $waitLock ? 'c+b' : 'rb';
        $file = @fopen($filepath, $mode);

        // exit if couldn't find file
        if ($file === false) {
            if ($default === null)
                throw new Exception("Could not open file: $filepath");

            // set default value in file and try opening again
            $fileObj->content = $default;
            file_put_contents($fileObj->filepath, $fileObj->content, LOCK_EX);
            $file = fopen($filepath, $mode);
        }

        if ($file === false) {
            throw new Exception("Failed to open file: $filepath");
        } else {
            $fileObj->fd = $file;
        }

        // if want the lock, acquire exclusive lock while modifying
        if ($waitLock) {
            $lock = flock($file, LOCK_EX);
            if (!$lock) {
                fclose($file);
                throw new Exception("Failed to acquire exclusive lock on file: $filepath");
            }
        }

        // read file content
        clearstatcache(true, $filepath);
        $size = filesize($filepath);
        if ($size === false) {
            if ($waitLock) {
                flock($file, LOCK_UN);
            }
            fclose($file);
            throw new Exception("Failed to get file size for: $filepath");
        }

        $string = $size > 0 ? fread($file, $size) : '';
        if ($string === false) {
            if ($waitLock) {
                flock($file, LOCK_UN);
            }
            fclose($file);
            throw new Exception("Failed to read file content: $filepath");
        }

        $fileObj->content = $string;

        // if no wait you can close the file
        if (!$waitLock)
            fclose($file);

        return $fileObj;
    }

    /**
     * Atomically replaces the file content using the locked descriptor and releases the lock.
     *
     * @param FileObject $fileObj The file object to persist (must have a valid $fd).
     * @return int The number of bytes written.
     * @throws HTTPException If the write fails or the file descriptor is invalid.
     */
    public static function write(FileObject $fileObj): int {
        if (!is_resource($fileObj->fd)) {
            throw new HTTPException("Invalid file descriptor for {$fileObj->filepath}. Check file lock state.", 400);
        }

        ftruncate($fileObj->fd, 0);
        rewind($fileObj->fd);
        $ret = fwrite($fileObj->fd, $fileObj->content);
        fflush($fileObj->fd);

        flock($fileObj->fd, LOCK_UN);
        fclose($fileObj->fd);

        if ($ret === false) {
            throw new HTTPException("Failed to write content to file: {$fileObj->filepath}", 400);
        }

        return $ret;
    }
}
