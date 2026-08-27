<?php

/**
 * Retrieves file content or streams file.
 *
 * @param mixed $path
 * @return void
 */
function get_file(mixed $path): void {
    /** @var string|null $STORAGE_LOCATION */
    global $STORAGE_LOCATION;

    if (!$STORAGE_LOCATION)
        http_error(501, 'Developer forgot the $STORAGE_LOCATION');

    if (!is_string($path) || mb_trim($path) === '')
        http_error(400, 'No path provided');
    $path = mb_trim($path);

    // check path lower than me
    $absolutePath = resolve_safe_path($STORAGE_LOCATION, $path);
    if ($absolutePath === false)
        http_error(403, 'Path not authorized');

    // no php script allowed
    if (str_ends_with(strtolower($absolutePath), ".php"))
        http_error(403, 'Cannot read PHP scripts');

    if (!file_exists($absolutePath))
        http_error(404, 'File not found');

    try {
        // try to read the image
        $imgInfo = getimagesize($absolutePath);
        if ($imgInfo === false)
            throw new Exception('Not an image');

        header("Content-Type: {$imgInfo['mime']}");
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($absolutePath));
        ob_clean();
        flush();
        readfile($absolutePath);
        die();
    } catch (Throwable) {
        $ext = strtolower(pathinfo($absolutePath, PATHINFO_EXTENSION));
        $mimeTypes = [
            'json' => 'application/json',
            'txt' => 'text/plain',
            'html' => 'text/html',
            'css' => 'text/css',
            'js' => 'application/javascript',
            'xml' => 'application/xml',
            'csv' => 'text/csv',
        ];
        $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';

        header('Content-Description: File Transfer');
        header("Content-Type: {$contentType}");
        header('Content-Disposition: attachment; filename=' . basename($absolutePath));
        header('Content-Transfer-Encoding: binary');
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($absolutePath));
        ob_clean();
        flush();
        readfile($absolutePath);
        die();
    }
}
