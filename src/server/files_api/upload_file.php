<?php

/**
 * post is creation
 * You need a token
 * You need a path
 * You need to be able to overwrite
 */

/**
 * Uploads a file.
 *
 * @param mixed $path
 * @param mixed $data
 * @param mixed $overwrite
 * @param mixed $token
 * @return string
 */
function upload_file($path, $data, $overwrite, $token): string {
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
    if ($token === false || !is_string($token) || $token === '')
        http_error(400, 'No token provided');
    if (!verify_token($token, $db_tokens))
        http_error(403, 'Invalid token');

    if ($path === false || !is_string($path) || trim($path) === '')
        http_error(400, 'No path provided');

    $relativePath = remove_dots($path);
    $absolutePath = resolve_safe_path($STORAGE_LOCATION, $path);
    if ($absolutePath === false)
        http_error(403, 'Path not authorized');

    // no php script allowed
    if (str_ends_with(strtolower($absolutePath), '.php'))
        http_error(403, 'Cannot write PHP scripts');

    check_file_extension($absolutePath, $authorized_file_extension);

    if (!is_array($data) || !check($data) || !check($data['name'] ?? null))
        http_error(400, 'No file provided or the provided file did not contain an original name');

    // overwrite parameter
    $overwriteBool = !empty($overwrite);

    if (!$overwriteBool && file_exists($absolutePath))
        http_error(403, 'File already exists');

    $uploadDir = dirname($absolutePath);

    // Make sure you can write to this folder.
    // php default user is www-data
    // you can give rights to a folder with the following command
    // sudo chown -R www-data "/path/to/folder/"

    // mkdir(path, rw-r--r--, recursive=true)
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0766, true)) {
        http_error(500, "PHP script can't create folder $uploadDir. Check permission, group and owner.");
    }

    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => "File exceeds allowed size.",
        UPLOAD_ERR_FORM_SIZE => "File too large.",
        UPLOAD_ERR_PARTIAL => "File only partially uploaded.",
        UPLOAD_ERR_NO_FILE => "No file uploaded.",
        UPLOAD_ERR_NO_TMP_DIR => "Missing temp folder.",
        UPLOAD_ERR_CANT_WRITE => "Cannot write file to disk.",
        UPLOAD_ERR_EXTENSION => "File upload blocked by extension.",
    ];

    $errorCode = $data['error'] ?? UPLOAD_ERR_OK;
    if ($errorCode !== UPLOAD_ERR_OK)
        http_error(500, $errorMessages[$errorCode] ?? "Unknown error.");

    $tmpName = $data['tmp_name'] ?? '';

    if (!is_string($tmpName) || !is_uploaded_file($tmpName))
        http_error(403, "Possible file upload attack.");

    // eventually write the file
    if (!move_uploaded_file($tmpName, $absolutePath)) {
        http_error(500, "PHP script can't write to file. Check permission, group and owner.");
    }

    return "Written file successfully to $relativePath";
}
