<?php

require_once __DIR__ . '/polyfills/polyfills.php';

/**
 * Applies the application's “provided” rule, treating null, empty strings, zero-like values, and empty arrays as absent.
 *
 * @param mixed $var The variable to check for presence and non-emptiness.
 */
function check(mixed $var): bool {
    return isset($var) && !empty($var);
}

/**
 * Sends a final JSON response and terminates execution so endpoint code cannot emit a second response.
 *
 * @param string $body JSON payload body to send.
 * @param int $code HTTP response status code.
 * @return never
 */
function http_response(string $body, int $code = 200): never {
    header('Content-Type: application/json');
    http_response_code($code);
    echo $body;

    exit();
}

/**
 * Encodes an arbitrary value as JSON and falls back to a stable error document when encoding fails.
 *
 * @param mixed $json Data payload to encode as JSON.
 * @param int $code HTTP response status code.
 * @return never
 */
function http_json_response(mixed $json, int $code = 200): never {
    $encoded = json_encode($json);
    http_response($encoded === false ? '{"error":"JSON encoding failed"}' : $encoded, $code);
}

/**
 * Wraps a successful or error payload under a caller-selected response key before JSON encoding it.
 *
 * @param string|array<mixed> $message Message string or payload array.
 * @param string $key JSON root envelope key name.
 * @param int $code HTTP response status code.
 * @return never
 */
function http_message(string|array $message, string $key = 'message', int $code = 200): never {
    $arr = [$key => $message];
    http_json_response($arr, $code);
}

/**
 * Sends a JSON error envelope and stops the current request with the supplied HTTP status.
 *
 * @param int $code HTTP error status code.
 * @param string $message Error message string.
 * @return never
 */
function http_error(int $code, string $message): never {
    http_message($message, 'error', $code);
}

/**
 * Identifies scalar and null values that the collection API must reject where object-like data is required.
 *
 * @param mixed $value Value to evaluate.
 */
function is_primitive(mixed $value): bool {
    return $value === null ||
        is_bool($value) ||
        is_int($value) ||
        is_float($value) ||
        is_string($value);
}

/**
 * Distinguishes integer and floating-point values for numeric edit and search operations.
 *
 * @param mixed $value Value to evaluate.
 */
function is_number_like(mixed $value): bool {
    return is_int($value) || is_float($value);
}

/**
 * Accepts only values that PHP can safely use as collection keys without implicit object or array conversion.
 *
 * @param mixed $value Value to evaluate.
 */
function is_keyable(mixed $value): bool {
    return is_int($value) || is_string($value);
}

/**
 * Sends the standard success envelope while allowing string messages or structured result data.
 *
 * @param string|array<mixed> $message Success message or structured result payload.
 * @return never
 */
function http_success(string|array $message): never {
    http_message($message, 'message', 200);
}

/**
 * Retrieves a JSON member; missing members use false as the endpoint sentinel.
 *
 * @param int|string $key Key name or index to lookup.
 * @param array<mixed> $arr Source array to retrieve key from.
 * @return mixed
 */
function check_key_json(int|string $key, array $arr): mixed {
    if (array_key_exists($key, $arr))
        return $arr[$key];
    return false;
}

/**
 * Detects non-zero-based or non-consecutive keys so callers can distinguish JSON objects from JSON lists.
 *
 * @param mixed $arr Array or value to inspect.
 */
function array_assoc(mixed $arr): bool {
    return is_array($arr) && !array_is_list($arr);
}

/**
 * Treats arrays without associative keys as lists, including the empty list used by bulk commands.
 *
 * @param mixed $arr Array or value to inspect.
 */
function array_sequential(mixed $arr): bool {
    return is_array($arr) && array_is_list($arr);
}

/**
 * Serializes nested collection data while preserving string keys as JSON object keys at the requested depth.
 *
 * This custom stringifier is required because native `json_encode` in PHP converts arrays with
 * sequential numeric indices or mixed integer/string keys to JSON arrays instead of JSON objects.
 * Firestorm collections require top-level associative object formatting `{ "key": ... }` regardless
 * of numeric key patterns.
 *
 * @param mixed $obj Data structure to serialize.
 * @param int $depth Nesting depth where associative array keys should be formatted as JSON objects.
 * @return string|false JSON-encoded string representation, or false on error.
 */
function stringifier(mixed $obj, int $depth = 1): string|false {
    if ($depth === 0 || !is_array($obj) || !array_assoc($obj))
        return json_encode($obj);

    $formed = [];
    foreach (array_keys($obj) as $key) {
        $formed[] = '"' . strval($key) . '":' . stringifier($obj[$key], $depth - 1);
    }

    return '{' . implode(',', $formed) . '}';
}

/** Configures cross-origin headers and completes browser preflight requests before endpoint routing begins. */
function cors(): void {
    // Allow from any origin
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');    // cache for 1 day
    }

    // Access-Control headers are received during OPTIONS requests
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {

        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
            header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");

        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

        exit(0);
    }
}

/** Normalizes dot segments without resolving symlinks, allowing endpoints to enforce their configured storage root. */
function remove_dots(string $path): string {
    $root = ($path !== '' && $path[0] === '/') ? '/' : '';

    $segments = explode('/', trim($path, '/'));
    $ret = [];
    foreach ($segments as $segment) {
        if ($segment === '.' || strlen($segment) === 0)
            continue;
        if ($segment === '..')
            array_pop($ret);
        else
            $ret[] = $segment;
    }
    return $root . implode('/', $ret);
}

/**
 * Resolves and validates that a relative or absolute path stays strictly within the base directory boundary.
 *
 * @param string $basePath Base storage directory
 * @param string $path Requested file path
 * @return string|false Safe absolute path, or false if not authorized
 */
function resolve_safe_path(string $basePath, string $path): string|false {
    $normalizedBase = rtrim(remove_dots($basePath), '/') . '/';
    $absolutePath = remove_dots($normalizedBase . $path);

    if (!str_starts_with($absolutePath . '/', $normalizedBase) && $absolutePath !== rtrim($normalizedBase, '/')) {
        return false;
    }

    return $absolutePath;
}

/**
 * Constant-time verification of an authentication token against authorized tokens.
 *
 * @param mixed $token The provided token to verify.
 * @param array<string>|null $validTokens List of valid tokens.
 * @return bool True if the token matches an authorized token in constant time.
 */
function verify_token(mixed $token, ?array $validTokens): bool {
    if (!is_string($token) || $token === '' || empty($validTokens)) {
        return false;
    }

    foreach ($validTokens as $validToken) {
        if (is_string($validToken) && hash_equals($validToken, $token)) {
            return true;
        }
    }

    return false;
}

/**
 * Read a value from the POST payload and return it as a string.
 *
 * Returns false when the key is missing or the value is empty.
 *
 * @param string $var POST key to read
 * @return string|false Sanitized value, or false when unavailable
 */
function p(string $var): string|false {
    try {
        // Access can emit notices for missing indexes depending on runtime settings.
        if (!isset($_POST[$var]) || !check($_POST[$var])) return false;
    } catch (Throwable) {
        return false;
    }

    return (string) $_POST[$var];
}

/**
 * Read a value from the query string and return it as a string.
 *
 * Returns false when the key is missing or the value is empty.
 *
 * @param string $var Query parameter key to read
 * @return string|false Sanitized value, or false when unavailable
 */
function g(string $var): string|false {
    try {
        // Access can emit notices for missing indexes depending on runtime settings.
        if (!isset($_GET[$var]) || !check($_GET[$var])) return false;
    } catch (Throwable) {
        return false;
    }

    return (string) $_GET[$var];
}

/**
 * Verifies that the file path ends with one of the authorized extensions.
 *
 * @param string $path The file path to validate.
 * @param array<string> $authorized_extensions Allowed file extensions (e.g. ['.png', '.jpg']).
 * @return void
 * @throws HTTPException If the file extension is not authorized.
 */
function check_file_extension(string $path, array $authorized_extensions): void {
    if (empty($authorized_extensions)) {
        return;
    }

    $lowerPath = strtolower($path);
    foreach ($authorized_extensions as $ext) {
        if ($ext === '' || str_ends_with($lowerPath, strtolower($ext))) {
            return;
        }
    }

    http_error(403, 'Extension not allowed');
}

/**
 * Serializes successful read results and turns JSON encoding failures into a consistent server error response.
 *
 * @param mixed $data Data to serialize and send.
 * @return never
 */
function http_response_stringified(mixed $data): never {
    if (is_array($data) && array_assoc($data)) {
        $stringified = stringifier($data);
    } else {
        $stringified = json_encode($data);
    }
    if ($stringified === false)
        http_error(500, 'Failed to stringify response data');

    http_response($stringified);
}
