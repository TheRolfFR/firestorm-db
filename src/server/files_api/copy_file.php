<?php

/**
 * Copies a file directly from source path to target path.
 *
 * @param mixed $oldPath Source file path.
 * @param mixed $newPath Destination file path.
 * @param mixed $overwrite Whether to overwrite the destination file if it exists.
 * @param mixed $token Authentication token.
 * @return string Confirmation message on success.
 */
function copy_file($oldPath, $newPath, $overwrite, $token): string {
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

    if ($oldPath === false || $oldPath === null || !is_string($oldPath) || trim($oldPath) === '')
        http_error(400, 'No oldPath provided');

    if ($newPath === false || $newPath === null || !is_string($newPath) || trim($newPath) === '')
        http_error(400, 'No newPath provided');

    $relativeOld = remove_dots($oldPath);
    $relativeNew = remove_dots($newPath);

    $absoluteOld = resolve_safe_path($STORAGE_LOCATION, $oldPath);
    $absoluteNew = resolve_safe_path($STORAGE_LOCATION, $newPath);

    if ($absoluteOld === false || $absoluteNew === false)
        http_error(403, 'Path not authorized');

    if (str_ends_with(strtolower($absoluteOld), '.php') || str_ends_with(strtolower($absoluteNew), '.php'))
        http_error(403, 'Cannot write PHP scripts');

    check_file_extension($absoluteNew, $authorized_file_extension);

    if (!file_exists($absoluteOld))
        http_error(404, 'Source file not found');

    $overwriteBool = !empty($overwrite);

    if (!$overwriteBool && file_exists($absoluteNew))
        http_error(403, 'File already exists');

    $uploadDir = dirname($absoluteNew);
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0766, true)) {
        http_error(500, "PHP script can't create folder $uploadDir. Check permission, group and owner.");
    }

    if (!copy($absoluteOld, $absoluteNew)) {
        http_error(500, "Failed to copy file from $relativeOld to $relativeNew");
    }

    return "Successfully copied file from $relativeOld to $relativeNew";
}
