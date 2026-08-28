<?php

require_once __DIR__ . '/utils.php';
cors();

// hide error display from client responses
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL & ~E_NOTICE);

if (!file_exists('./config.php'))
    http_error(501, 'Developer didn\'t implement a config.php file');
require_once './config.php';

if (!file_exists('./tokens.php'))
    http_error(501, 'Developer didn\'t implement a tokens.php file');
require_once './tokens.php';

/** @var string|null $STORAGE_LOCATION */
if (!$STORAGE_LOCATION)
    http_error(501, 'Developer forgot the $STORAGE_LOCATION');

require_once __DIR__ . '/log.php';

require_once __DIR__ . '/files_api/get_file.php';
require_once __DIR__ . '/files_api/upload_file.php';
require_once __DIR__ . '/files_api/delete_file.php';
require_once __DIR__ . '/files_api/copy_file.php';
require_once __DIR__ . '/files_api/move_file.php';
require_once __DIR__ . '/files_api/exists_file.php';
require_once __DIR__ . '/files_api/append_file.php';
require_once __DIR__ . '/files_api/write_file.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';

switch ($method) {
    case 'GET':
        $action = g('action');
        $path = g('path');

        if ($action === 'exists') {
            $exists = exists_file($path);
            http_json_response(['exists' => $exists]);
        } else {
            get_file($path);
        }
        break;

    case 'PUT':
        $rawInput = file_get_contents('php://input') ?: "";
        $json = ($rawInput !== '' && json_validate($rawInput)) ? json_decode($rawInput, true) : null;

        $token = is_array($json) ? ($json['token'] ?? null) : p('token');
        $path = is_array($json) ? ($json['path'] ?? null) : p('path');
        $content = is_array($json) ? ($json['content'] ?? null) : p('content');
        $overwrite = is_array($json) ? ($json['overwrite'] ?? null) : p('overwrite');

        $msg = write_file($path, $content, $overwrite, $token);
        http_success($msg);
        break;

    case 'PATCH':
        $rawInput = file_get_contents('php://input') ?: "";
        $json = ($rawInput !== '' && json_validate($rawInput)) ? json_decode($rawInput, true) : null;

        $token = is_array($json) ? ($json['token'] ?? null) : p('token');
        $path = is_array($json) ? ($json['path'] ?? null) : p('path');
        $content = is_array($json) ? ($json['content'] ?? null) : p('content');
        $create = is_array($json) ? ($json['create'] ?? null) : p('create');

        $msg = append_file($path, $content, $create, $token);
        http_success($msg);
        break;

    case 'POST':
        $rawInput = file_get_contents('php://input') ?: "";
        $json = ($rawInput !== '' && json_validate($rawInput)) ? json_decode($rawInput, true) : null;

        $action = is_array($json) ? ($json['action'] ?? null) : p('action');

        switch ($action) {
            case 'copy':
            case 'move':
                $token = is_array($json) ? ($json['token'] ?? null) : p('token');
                $oldPath = is_array($json) ? ($json['oldPath'] ?? null) : p('oldPath');
                $newPath = is_array($json) ? ($json['newPath'] ?? null) : p('newPath');
                $overwrite = is_array($json) ? ($json['overwrite'] ?? null) : p('overwrite');

                $msg = $action === 'copy'
                    ? copy_file($oldPath, $newPath, $overwrite, $token)
                    : move_file($oldPath, $newPath, $overwrite, $token);

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

            case 'write':
            case 'put':
                $token = is_array($json) ? ($json['token'] ?? null) : p('token');
                $path = is_array($json) ? ($json['path'] ?? null) : p('path');
                $content = is_array($json) ? ($json['content'] ?? null) : p('content');
                $overwrite = is_array($json) ? ($json['overwrite'] ?? null) : p('overwrite');

                $msg = write_file($path, $content, $overwrite, $token);
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
        $rawInput = file_get_contents('php://input') ?: "";
        $inputData = ($rawInput !== '' && json_validate($rawInput)) ? json_decode($rawInput, true) : null;

        $path = is_array($inputData) ? ($inputData['path'] ?? false) : false;
        $token = is_array($inputData) ? ($inputData['token'] ?? false) : false;

        delete_file($path, $token);
        http_success("Successfully deleted file");
        break;

    default:
        http_error(400, "Incorrect request type, expected GET, POST, PUT, PATCH or DELETE, not $method");
        break;
}
