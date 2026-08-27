<?php

// Check if Composer vendor autoload is present and load it
foreach ([__DIR__ . '/../../vendor/autoload.php', __DIR__ . '/../vendor/autoload.php', './vendor/autoload.php'] as $autoload) {
    if (file_exists($autoload)) {
        require_once $autoload;
        break;
    }
}

/**
 * PHP 8.3 Polyfills
 */

// #[\Override] attribute class
if (!class_exists('Override')) {
    #[Attribute(Attribute::TARGET_METHOD)]
    final class Override
    {
        public function __construct()
        {
        }
    }
}

// json_validate()
if (!function_exists('json_validate')) {
    /**
     * Validates whether a string contains valid JSON without decoding it into memory.
     */
    function json_validate(string $json, int $depth = 512, int $flags = 0): bool
    {
        if ($flags !== 0 && $flags !== JSON_INVALID_UTF8_IGNORE) {
            throw new ValueError('json_validate(): Argument #3 ($flags) must be a valid flag');
        }
        if ($depth <= 0) {
            throw new ValueError('json_validate(): Argument #2 ($depth) must be greater than 0');
        }
        if ($depth > 0x7FFFFFFF) {
            throw new ValueError(sprintf('json_validate(): Argument #2 ($depth) must be less than %d', 0x7FFFFFFF));
        }

        if ($json === '') {
            return false;
        }

        json_decode($json, null, $depth, $flags);
        return json_last_error() === JSON_ERROR_NONE;
    }
}

/**
 * PHP 8.4 Polyfills
 */

// array_find()
if (!function_exists('array_find')) {
    /**
     * Returns the value of the first element in the array that satisfies the callback.
     *
     * @param array<mixed> $array
     * @param callable(mixed, int|string): bool $callback
     */
    function array_find(array $array, callable $callback): mixed
    {
        foreach ($array as $key => $value) {
            if ($callback($value, $key)) {
                return $value;
            }
        }
        return null;
    }
}

// array_find_key()
if (!function_exists('array_find_key')) {
    /**
     * Returns the key of the first element in the array that satisfies the callback.
     *
     * @param array<mixed> $array
     * @param callable(mixed, int|string): bool $callback
     */
    function array_find_key(array $array, callable $callback): int|string|null
    {
        foreach ($array as $key => $value) {
            if ($callback($value, $key)) {
                return $key;
            }
        }
        return null;
    }
}

// array_any()
if (!function_exists('array_any')) {
    /**
     * Checks whether any element in the array satisfies the callback.
     *
     * @param array<mixed> $array
     * @param callable(mixed, int|string): bool $callback
     */
    function array_any(array $array, callable $callback): bool
    {
        foreach ($array as $key => $value) {
            if ($callback($value, $key)) {
                return true;
            }
        }
        return false;
    }
}

// array_all()
if (!function_exists('array_all')) {
    /**
     * Checks whether all elements in the array satisfy the callback.
     *
     * @param array<mixed> $array
     * @param callable(mixed, int|string): bool $callback
     */
    function array_all(array $array, callable $callback): bool
    {
        foreach ($array as $key => $value) {
            if (!$callback($value, $key)) {
                return false;
            }
        }
        return true;
    }
}

// mb_trim()
if (!function_exists('mb_trim')) {
    /**
     * Strips whitespace (or other characters) from the beginning and end of a string with multibyte support.
     */
    function mb_trim(string $string, string $characters = " \f\n\r\t\v\x00\u{00A0}\u{1680}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{0085}\u{180E}", ?string $encoding = null): string
    {
        $encoding = $encoding ?? mb_internal_encoding();
        if ($characters === '') {
            return $string;
        }
        $quotedChars = preg_quote($characters, '/');
        $result = preg_replace("/^[$quotedChars]+|[$quotedChars]+\$/u", '', $string);
        return $result ?? $string;
    }
}

/**
 * PHP 8.5 Polyfills
 */

// array_first()
if (!function_exists('array_first')) {
    /**
     * Returns the first value of an array, or null if the array is empty.
     *
     * @param array<mixed> $array
     */
    function array_first(array $array): mixed
    {
        if ($array === []) {
            return null;
        }
        $firstKey = array_key_first($array);
        return $firstKey !== null ? $array[$firstKey] : null;
    }
}

// array_last()
if (!function_exists('array_last')) {
    /**
     * Returns the last value of an array, or null if the array is empty.
     *
     * @param array<mixed> $array
     */
    function array_last(array $array): mixed
    {
        if ($array === []) {
            return null;
        }
        $lastKey = array_key_last($array);
        return $lastKey !== null ? $array[$lastKey] : null;
    }
}
