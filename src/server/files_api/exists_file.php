<?php

/**
 * Checks if a file path exists.
 *
 * @param mixed $path File path to check.
 * @return bool True if path exists, false otherwise.
 */
function exists_file($path): bool {
    /** @var string|null $STORAGE_LOCATION */
    global $STORAGE_LOCATION;

    if (!$STORAGE_LOCATION)
        http_error(501, 'Developer forgot the $STORAGE_LOCATION');

    if ($path === false || $path === null || !is_string($path) || trim($path) === '')
        http_error(400, 'No path provided');

    $path = trim($path);

    $absolutePath = resolve_safe_path($STORAGE_LOCATION, $path);

    if ($absolutePath === false)
        http_error(403, 'Path not authorized');

    if (str_ends_with(strtolower($absolutePath), '.php'))
        http_error(403, 'Cannot access PHP scripts');

    return file_exists($absolutePath);
}
