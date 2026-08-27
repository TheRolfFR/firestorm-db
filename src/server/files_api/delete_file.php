<?php

/**
 * Deletes a file.
 *
 * @param mixed $path
 * @param mixed $token
 * @return void
 */
function delete_file(mixed $path, mixed $token): void {
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

    $path = mb_trim($path);

    // check path lower than me
    $absolutePath = resolve_safe_path($STORAGE_LOCATION, $path);
    if ($absolutePath === false)
        http_error(403, 'Path not authorized');

    // no php script allowed
    if (str_ends_with(strtolower($absolutePath), ".php"))
        http_error(403, 'Cannot delete PHP scripts');

    check_file_extension($absolutePath, $authorized_file_extension);

    if (!file_exists($absolutePath))
        http_error(404, 'File not found');

    $is_deleted = unlink($absolutePath);

    if (!$is_deleted)
        http_error(500, 'Deletion failed');
}
