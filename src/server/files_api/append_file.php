<?php

/**
 * Appends content to a file directly.
 *
 * @param mixed $path Target file path to append to.
 * @param mixed $content Content to append.
 * @param mixed $create Whether to create the file if it does not exist.
 * @param mixed $token Authentication token.
 * @return string Confirmation message on success.
 */
function append_file($path, $content, $create, $token): string {
    /** @var string|null $STORAGE_LOCATION */
    global $STORAGE_LOCATION;

    /** @var array<string>|null $db_tokens */
    global $db_tokens;

    /** @var array<string>|null $authorized_file_extension */
    global $authorized_file_extension;

    if (!$STORAGE_LOCATION)
        http_error(501, 'Developer forgot the $STORAGE_LOCATION');

    if (!$db_tokens)
        http_error(501, 'Developer is dumb and forgot to create tokens');

    if (!$authorized_file_extension)
        http_error(501, 'Developer is dumb and forgot to create $authorized_file_extension');

    // verifying token
    if ($token === false || $token === null || !is_string($token) || $token === '')
        http_error(400, 'No token provided');
    if (!verify_token($token, $db_tokens))
        http_error(403, 'Invalid token');

    if ($path === false || $path === null || !is_string($path) || trim($path) === '')
        http_error(400, 'No path provided');

    if ($content === false || $content === null || !is_string($content))
        http_error(400, 'No content provided');

    $relativePath = remove_dots($path);
    $absolutePath = resolve_safe_path($STORAGE_LOCATION, $path);

    if ($absolutePath === false)
        http_error(403, 'Path not authorized');

    if (str_ends_with(strtolower($absolutePath), '.php'))
        http_error(403, 'Cannot write PHP scripts');

    check_file_extension($absolutePath, $authorized_file_extension);

    $createBool = !empty($create);

    if (!file_exists($absolutePath) && !$createBool)
        http_error(404, 'File not found');

    $uploadDir = dirname($absolutePath);
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0766, true)) {
        http_error(500, "PHP script can't create folder $uploadDir. Check permission, group and owner.");
    }

    if (file_put_contents($absolutePath, $content, FILE_APPEND | LOCK_EX) === false) {
        http_error(500, "Failed to append content to file $relativePath");
    }

    return "Successfully appended content to $relativePath";
}
