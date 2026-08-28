<?php

// require a token for checking the version to prevent being able to search for vulnerable versions
require_once __DIR__ . '/utils.php';

cors();

/**
 * Reads the deployed version marker so authenticated clients can compare their protocol version.
 *
 * @return string|false
 */
function load_version(): string|false {
    if (file_exists("./version.ini")) {
        return file_get_contents("./version.ini");
    }
    return file_get_contents(__DIR__ . "/version.ini");
}

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
	http_error(400, "Incorrect request type, expected GET or POST, not $method");
}

$rawInput = file_get_contents('php://input') ?: "";
if ($rawInput === '' || !json_validate($rawInput)) {
	http_error(400, 'No JSON body provided');
}

$inputJSON = json_decode($rawInput, true);

if (!is_array($inputJSON))
	http_error(400, 'No JSON body provided');

$token = check_key_json('token', $inputJSON);
if (!$token || !is_string($token))
	http_error(400, 'No token provided');

if (!file_exists('./tokens.php'))
	http_error(501, 'Developer didn\'t implement a tokens.php file');

// add tokens
require_once './tokens.php';

/** @var array<string>|null $db_tokens */
if (!isset($db_tokens))
	http_error(500, 'Developer is dumb and forgot to create tokens');

// verifying token
if (!verify_token($token, $db_tokens))
	http_error(403, 'Invalid token');

$version_found = load_version();

if ($version_found === false)
    http_error(500, 'Firestorm version not found');

http_response($version_found);
