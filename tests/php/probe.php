<?php

// Test-only endpoint reaching server code that no regular request can trigger
// (misconfiguration, corrupted files, fabricated upload metadata, log destinations).
// Always answers with a JSON document: {"result": ...} or {"thrown": {"class", "message", "code"}}.

require_once './utils.php';
require_once './classes/JSONDatabase.php';
require_once './log.php';

foreach (glob(getcwd() . '/files_api/*.php') ?: [] as $file)
    require_once $file;

ini_set('display_errors', '0');

$mode = $_GET['mode'] ?? '';

function probe_reply(mixed $result): never {
    http_json_response(['result' => $result]);
}

try {
    switch ($mode) {
        case 'collection-file':
            // prepares a collection file: action=delete|corrupt|scalar|directory
            $path = './files/' . basename((string) ($_GET['name'] ?? '')) . '.json';
            switch ($_GET['action'] ?? '') {
                case 'delete':
                    if (is_dir($path)) rmdir($path);
                    else if (file_exists($path)) unlink($path);
                    break;
                case 'corrupt':
                    file_put_contents($path, '{"broken": ');
                    break;
                case 'scalar':
                    file_put_contents($path, '5');
                    break;
                case 'directory':
                    if (file_exists($path)) unlink($path);
                    mkdir($path);
                    break;
            }
            probe_reply(true);

        case 'files-config':
            // calls a files_api function with one required global missing
            $fn = (string) ($_GET['fn'] ?? '');
            $missing = (string) ($_GET['missing'] ?? '');
            $token = 'NeverGonnaGiveYouUp';
            $STORAGE_LOCATION = $missing === 'storage' ? '' : dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';
            $db_tokens = $missing === 'tokens' ? [] : [$token];
            $authorized_file_extension = $missing === 'extensions' ? [] : ['.txt'];

            match ($fn) {
                'get_file' => get_file('a.txt'),
                'exists_file' => exists_file('a.txt'),
                'delete_file' => delete_file('a.txt', $token),
                'upload_file' => upload_file('a.txt', ['name' => 'a.txt'], false, $token),
                'copy_file' => copy_file('a.txt', 'b.txt', false, $token),
                'move_file' => move_file('a.txt', 'b.txt', false, $token),
                'append_file' => append_file('a.txt', 'x', false, $token),
                'write_file' => write_file('a.txt', 'x', false, $token),
            };
            probe_reply('unreachable');

        case 'upload':
            // fabricated $_FILES entry: error=<code>, tmp=<tmp_name>
            $STORAGE_LOCATION = dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';
            $db_tokens = ['NeverGonnaGiveYouUp'];
            $authorized_file_extension = ['.txt'];
            $data = [
                'name' => 'probe.txt',
                'error' => (int) ($_GET['error'] ?? 0),
                'tmp_name' => (string) ($_GET['tmp'] ?? ''),
            ];
            probe_reply(upload_file('probe-upload.txt', $data, true, 'NeverGonnaGiveYouUp'));

        case 'log':
            // env=1 uses the FIRESTORM_LOG_PATH variable, env=0 the $log_path config variable, none uses the default
            $log_path = $_GET['config'] ?? null;
            putenv(Log::LOG_PATH_ENV . (isset($_GET['env']) ? '=' . $_GET['env'] : ''));
            Log::addLog('probe message');
            probe_reply(true);

        case 'read-json-file':
            $obj = read_json_file('./files/does-not-exist-' . uniqid() . '.json');
            probe_reply($obj->content);

        case 'write-json-file':
            probe_reply(write_json_file(new FileObject('./files/never-written.json')));

        default:
            http_error(400, 'Unknown probe mode');
    }
} catch (Throwable $e) {
    http_json_response(['thrown' => ['class' => $e::class, 'message' => $e->getMessage(), 'code' => $e->getCode()]]);
}
