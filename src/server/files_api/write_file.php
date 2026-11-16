<?php

/**
 * Writes or replaces content of a file directly.
 *
 * @param mixed $path Target file path to write to.
 * @param mixed $content Content to write.
 * @param mixed $overwrite Whether to overwrite the file if it already exists.
 * @param mixed $token Authentication token.
 * @return string Confirmation message on success.
 */
function write_file(mixed $path, mixed $content, mixed $overwrite, mixed $token): string {
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
    if (!is_string($token) || $token === '')
        http_error(400, 'No token provided');
    if (!verify_token($token, $db_tokens))
        http_error(403, 'Invalid token');

    if (!is_string($path) || mb_trim($path) === '')
        http_error(400, 'No path provided');

    if (!is_string($content))
        http_error(400, 'No content provided');

    $relativePath = remove_dots($path);
    $absolutePath = resolve_safe_path($STORAGE_LOCATION, $path);

    if ($absolutePath === false)
        http_error(403, 'Path not authorized');

    if (str_ends_with(strtolower($absolutePath), '.php'))
        http_error(403, 'Cannot write PHP scripts');

    check_file_extension($absolutePath, $authorized_file_extension);

    $overwriteBool = !empty($overwrite);

    if (!$overwriteBool && file_exists($absolutePath))
        http_error(403, 'File already exists');

    $uploadDir = dirname($absolutePath);
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0766, true)) {
        http_error(500, "PHP script can't create folder $uploadDir. Check permission, group and owner.");
    }

    if (file_put_contents($absolutePath, $content, LOCK_EX) === false) {
        http_error(500, "Failed to write content to file $relativePath");
    }

    return "Written file successfully to $relativePath";
}
