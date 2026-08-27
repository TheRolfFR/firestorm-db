<?php

/**
 * Applies the application's “provided” rule, treating null, empty strings, zero-like values, and empty arrays as absent.
 *
 * @param mixed $var
 */
function check($var): bool {
    return isset($var) && !empty($var);
}

/**
 * Sends a final JSON response and terminates execution so endpoint code cannot emit a second response.
 *
 * @param string $body
 * @param int $code
 * @return void
 */
function http_response($body, $code = 200) {
    header('Content-Type: application/json');
    http_response_code($code);
    echo $body;

    exit();
}

/**
 * Encodes an arbitrary value as JSON and falls back to a stable error document when encoding fails.
 *
 * @param mixed $json
 * @param int $code
 * @return void
 */
function http_json_response($json, $code = 200) {
    $encoded = json_encode($json);
    http_response($encoded === false ? '{"error":"JSON encoding failed"}' : $encoded, $code);
}

/**
 * Wraps a successful or error payload under a caller-selected response key before JSON encoding it.
 *
 * @param string|array<mixed> $message
 * @param string $key
 * @param int $code
 * @return void
 */
function http_message($message, $key = 'message', $code = 200) {
    $arr = [$key => $message];
    http_json_response($arr, $code);
}

/**
 * Sends a JSON error envelope and stops the current request with the supplied HTTP status.
 *
 * @param int $code
 * @param string $message
 * @return never
 */
function http_error($code, $message) {
    http_message($message, 'error', $code);
    exit(); // Explicitly call exit() to satisfy PHPStan that http_error returns never
}

/**
 * Identifies scalar and null values that the collection API must reject where object-like data is required.
 *
 * @param mixed $value
 */
function is_primitive($value): bool {
    $value_type = gettype($value);
    return $value_type == 'NULL' ||
        $value_type == 'boolean' ||
        $value_type == 'integer' ||
        $value_type == 'double' ||
        $value_type == 'string';
}

/**
 * Distinguishes integer and floating-point values for numeric edit and search operations.
 *
 * @param mixed $value
 */
function is_number_like($value): bool {
    $value_type = gettype($value);
    return in_array($value_type, ['integer', 'double']);
}

/**
 * Accepts only values that PHP can safely use as collection keys without implicit object or array conversion.
 *
 * @param mixed $value
 */
function is_keyable($value): bool {
    return in_array(gettype($value), ['integer', 'string']);
}

/**
 * Sends the standard success envelope while allowing string messages or structured result data.
 *
 * @param string|array<mixed> $message
 */
function http_success($message): void {
    http_message($message, 'message', 200);
}

/**
 * Retrieves a JSON member; missing members use false as the endpoint sentinel.
 *
 * @param int|string $key
 * @param array<mixed> $arr
 * @return mixed
 */
function check_key_json($key, array $arr) {
    if (array_key_exists($key, $arr))
        return $arr[$key];
    return false;
}

/**
 * Detects non-zero-based or non-consecutive keys so callers can distinguish JSON objects from JSON lists.
 *
 * @param mixed $arr
 */
function array_assoc($arr): bool {
    if ($arr === [] || !is_array($arr))
        return false;
    return array_keys($arr) !== range(0, count($arr) - 1);
}

/**
 * Treats arrays without associative keys as lists, including the empty list used by bulk commands.
 *
 * @param mixed $arr
 */
function array_sequential($arr): bool {
    return !array_assoc($arr);
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
function stringifier($obj, int $depth = 1) {
    if ($depth == 0 || !is_array($obj) || !array_assoc($obj))
        return json_encode($obj);

    $res = "{";

    $formed = [];
    foreach (array_keys($obj) as $key) {
        array_push($formed, '"' . strval($key) . '":' . stringifier($obj[$key], $depth - 1));
    }
    $res .= implode(",", $formed);

    $res .= "}";

    return $res;
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
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {

        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
            header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");

        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
            header("Access-Control-Allow-Headers:        {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

        exit(0);
    }
}

/** Normalizes dot segments without resolving symlinks, allowing endpoints to enforce their configured storage root. */
function remove_dots(string $path): string {
    $root = ($path[0] === '/') ? '/' : '';

    $segments = explode('/', trim($path, '/'));
    $ret = [];
    foreach ($segments as $segment) {
        if ($segment == '.' || strlen($segment) === 0)
            continue;
        if ($segment == '..')
            array_pop($ret);
        else
            array_push($ret, $segment);
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
function resolve_safe_path(string $basePath, string $path) {
    $normalizedBase = rtrim(remove_dots($basePath), '/') . '/';
    $absolutePath = remove_dots($normalizedBase . $path);

    if (strpos($absolutePath . '/', $normalizedBase) !== 0 && $absolutePath !== rtrim($normalizedBase, '/')) {
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
function verify_token($token, ?array $validTokens): bool {
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
function p($var) {
    try {
        // Access can emit notices for missing indexes depending on runtime settings.
        if (!isset($_POST[$var]) || !check($_POST[$var])) return false;
    } catch (Throwable $th) {
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
function g($var) {
    try {
        // Access can emit notices for missing indexes depending on runtime settings.
        if (!isset($_GET[$var]) || !check($_GET[$var])) return false;
    } catch (Throwable $th) {
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
 * @return void
 */
function http_response_stringified($data) {
    if (is_array($data) && array_assoc($data)) {
        $stringified = stringifier($data);
    } else {
        $stringified = json_encode($data);
    }
    if ($stringified === false)
        http_error(500, 'Failed to stringify response data');

    http_response($stringified);
}
