<?php

// hide error display from client responses
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL - E_NOTICE);

require_once './config.php';

/** @var string|null $STORAGE_LOCATION */
if (!$STORAGE_LOCATION)
    http_error(501, 'Developer forgot the $STORAGE_LOCATION');

// import useful functions
require_once './utils.php';
require_once './log.php';
require_once './tokens.php';

require_once './files_api/get_file.php';
require_once './files_api/upload_file.php';
require_once './files_api/delete_file.php';
require_once './files_api/copy_file.php';
require_once './files_api/move_file.php';
require_once './files_api/exists_file.php';
require_once './files_api/append_file.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';

switch ($method) {
    case 'GET':
        $action = g('action');
        $path = g('path');

        switch ($action) {
            case 'exists':
                $exists = exists_file($path);
                http_json_response(['exists' => $exists]);
                break;
            default:
                get_file($path);
                break;
        }
        break;
    case 'POST':
    case 'PATCH':
        $rawInput = file_get_contents('php://input') ?: "";
        $json = json_decode($rawInput, true);

        $action = is_array($json) ? ($json['action'] ?? null) : p('action');

        switch ($action) {
            case 'copy':
            case 'move':
                $token = is_array($json) ? ($json['token'] ?? null) : p('token');
                $oldPath = is_array($json) ? ($json['oldPath'] ?? null) : p('oldPath');
                $newPath = is_array($json) ? ($json['newPath'] ?? null) : p('newPath');
                $overwrite = is_array($json) ? ($json['overwrite'] ?? null) : p('overwrite');

                if ($action === 'copy') $msg = copy_file($oldPath, $newPath, $overwrite, $token);
                else $msg = move_file($oldPath, $newPath, $overwrite, $token);

                http_success($msg);
                break;
            case 'append':
                $token = is_array($json) ? ($json['token'] ?? null) : p('token');
                $path = is_array($json) ? ($json['path'] ?? null) : p('path');
                $content = is_array($json) ? ($json['content'] ?? null) : p('content');
                $create = is_array($json) ? ($json['create'] ?? null) : p('create');

                $msg = append_file($path, $content, $create, $token);
                http_success($msg);
                break;
            default:
                $path = p('path');
                $data = $_FILES['file'] ?? null;
                $token = p('token');
                $overwrite = p('overwrite');

                $msg = upload_file($path, $data, $overwrite, $token);
                http_success($msg);
                break;
        }
        break;
    case 'DELETE':
        $inputData = json_decode(file_get_contents('php://input') ?: "", true);

        if (is_array($inputData)) {
            $path = $inputData['path'] ?? false;
            $token = $inputData['token'] ?? false;
        } else {
            $path = false;
            $token = false;
        }

        delete_file($path, $token);
        http_success("Successfully deleted file");
        break;
    default:
        http_error(400, "Incorrect request type, expected GET, POST, PATCH or DELETE, not $method");
}
