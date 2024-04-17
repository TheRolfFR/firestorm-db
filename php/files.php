<?php

// display all errors
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL - E_NOTICE);

require_once('./config.php');

if (!$STORAGE_LOCATION) http_error(501, 'Developer forgot the $STORAGE_LOCATION');

// import useful functions
require_once('./utils.php');
require_once('./log.php');

$method = sec($_SERVER['REQUEST_METHOD']);
if ($method !== 'GET' && $method !== 'POST' && $method !== 'DELETE') {
    http_error(400, 'Incorrect request type, expected GET, POST or DELETE, not ' . $method);
}


if ($method === 'POST') {
    /**
     * post is creation
     * You need a token
     * You need a path
     * You need to be able to overwrite
     */

    // add tokens
    require_once('./tokens.php');

    if (!$db_tokens)
        http_error(501, 'Developer is dumb and forgot to create tokens');

    if (!$authorized_file_extension)
        http_error(501, 'Developer is dumb and forgot to create $authorized_file_extension');

    $token = p('token');

    // verifying token
    if ($token === false) http_error(400, 'No token provided');
    if (!in_array($token, $db_tokens)) http_error(403, 'Invalid token');

    $path = trim(p('path'));
    if ($path === false) http_error(400, 'No path provided');

    // check path lower than me
    $relativePath = removeDots($path);
    $absolutePath = removeDots($STORAGE_LOCATION . $relativePath);
    $myPath = removeDots($STORAGE_LOCATION);

    // avoid hacks to write script or files unauthorized
    if (strpos($absolutePath, $myPath) !== 0) http_error(403, 'Path not authorized');
    // no php script allowed
    if (str_ends_with($absolutePath, '.php') === 0) http_error(403, 'Cannot write PHP scripts');

    $extensionFound = false;
    $i = 0;
    while($i < count($authorized_file_extension) && !$extensionFound) {
        $extensionFound = str_ends_with($absolutePath, $authorized_file_extension[$i]);
        $i = $i + 1;
    }

    if (!$extensionFound) {
        http_error(403, 'Extension not allowed');
    }

    if (!check($_FILES) || !check($_FILES['file'])) {
        http_error(400, 'No file provided or the provided file did not contain an original name');
    }

    // overwrite parameter
    $overwrite = !!p('overwrite');

    if (!$overwrite && file_exists($absolutePath)) http_error(403, 'File already exists');

    $uploaddir = dirname($absolutePath);

    // Make sure you can write to this folder.
    // php default user is www-data
    // you can give rights to a folder with the following command
    // sudo chown -R www-data "/path/to/folder/"

    // mkdir(path, rw-r--r--, recursive=true)
    if (!is_dir($uploaddir) && !mkdir($uploaddir, 0766, true)){
        http_error(500, "PHP script can't create folder " . $uploaddir . ", check permission, group and owner.");
    }

    if (!check($_FILES) || !check($_FILES['file'])) http_error(400, 'No actual file was given');

    $tmpName = $_FILES['file']['tmp_name'];

    // eventually write the file
    if (move_uploaded_file($tmpName, $absolutePath)) {
        http_success('Written file successfully to ' . $relativePath);
    } else {
        http_error(500, "PHP script can't write to file, check permission, group and owner.");
    }

    die();
} else if ($method === 'GET') {
    $path = trim(g('path'));
    if ($path === false) http_error(400, 'No path provided');

    // check path lower than me
    $absolutePath = removeDots($STORAGE_LOCATION . $path);
    $myPath = removeDots($STORAGE_LOCATION);
    // avoid hacks to write script or files unauthorized
    if (strpos($absolutePath, $myPath) !== 0) http_error(403, 'Path not authorized');
    // no php script allowed
    if (substr_compare($absolutePath, ".php", -strlen(".php"), null, true) === 0) http_error(403, 'Cannot read PHP scripts');

    if (!file_exists($absolutePath)) http_error(404, 'File not found');

    try {
        // try to read the image
        $imginfo = getimagesize($absolutePath);
        header("Content-type: {$imginfo['mime']}");
        header('Expires: 0');
        header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
        header('Pragma: public');
        header('Content-Length: ' . filesize($absolutePath));
        ob_clean();
        flush();
        readfile($absolutePath);
        die();
    } catch (Throwable $th) {
        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename='.basename($absolutePath));
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

} else if ($method === 'DELETE') {
    /**
     * delete is deletion
     * You need a token
     * You need a path
     */

    // add tokens
    require_once('./tokens.php');

    if (!$db_tokens)
        http_error(501, 'Developer is dumb and forgot to create tokens');

    $data = json_decode(file_get_contents('php://input'), true);
    if ($data === false) http_error(400, 'Could not parse input data');

    try {
        $token = $data['token'];
    } catch(Exception $e) {
        http_error(400, 'Failed parsing input data');
    }

    // verifying token
    if ($token === false) http_error(400, 'No token provided');
    if (!in_array($token, $db_tokens)) http_error(403, 'Invalid token');

    $path = trim($data['path']);
    if ($path === false) http_error(400, 'No path provided');

    // check path lower than me
    $relativePath = removeDots($path);
    $absolutePath = removeDots($STORAGE_LOCATION . $relativePath);
    $myPath = removeDots($STORAGE_LOCATION);

    // avoid hacks to write script or files unauthorized
    if (strpos($absolutePath, $myPath) !== 0) http_error(403, 'Path not authorized');

    if (!file_exists($absolutePath)) http_error(404, 'File not found');

    $is_deleted = unlink($absolutePath);

    if ($is_deleted) http_success('File successfully deleted');

    http_error(500, 'Deletion failed');
}

http_error(501, 'Request unhandled by developer');

function p($var) {
    try {
        if (!check($_POST[$var])) return false;
    } catch (Throwable $th) {
        return false;
    }
    return sec($_POST[$var]);
}

function g($var) {
    try {
        if (!check($_GET[$var])) return false;
    } catch (Throwable $th) {
        return false;
    }

    return sec($_GET[$var]);
}