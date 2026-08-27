<?php
require_once './utils.php';

cors();

// hide error display from client responses
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);

// import useful functions
require_once './log.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
    http_error(400, "Incorrect request type, expected GET or POST, not $method");
}

$inputJSON = json_decode(file_get_contents('php://input') ?: "", true);

if (!$inputJSON)
    http_error(400, 'No JSON body provided');

$collection = check_key_json('collection', $inputJSON);
if (!$collection)
    http_error(400, 'No collection provided');

if (file_exists('./config.php') == false)
    http_error(501, 'Developer didn\'t implement a config.php file');

// import db config
require_once './config.php';

// HTTPExceptions get properly handled in the catch
try {

    /** @var array<string, JSONDatabase> $database_list */

    // checking good collection
    if (!array_key_exists($collection, $database_list))
        http_error(404, "Collection not found: $collection");

    /**
     * @var JSONDatabase
     */
    $db = $database_list[$collection];

    $command = check_key_json('command', $inputJSON);
    if (!$command)
        http_error(400, 'No command provided');

    $available_commands = [
        'readRaw',
        'get',
        'search',
        'searchKeys',
        'select',
        'random',
        'sha1',
        'values'
    ];

    if (!in_array($command, $available_commands))
        http_error(404, "Command not found: $command. Available commands: " . join(', ', $available_commands));

    switch ($command) {
        case 'sha1':
            $res = $db->sha1();
            http_response($res);
            break;
        case 'readRaw':
            $res = $db->readRaw();
            http_response($res->content);
            break;
        case 'get':
            if (!array_key_exists('id', $inputJSON))
                http_error(400, 'No id provided');

            $id = $inputJSON['id'];

            $result = $db->get($id);
            if ($result === null)
                http_error(404, "get failed on collection $collection with key $id");

            http_response_stringified($result);
            break;
        case 'search':
            $search = check_key_json('search', $inputJSON);
            $random = check_key_json('random', $inputJSON);
            $limit = check_key_json('limit', $inputJSON);

            if (!$search)
                http_error(400, 'No search provided');

            $result = $db->search($search, $random, $limit);

            http_response_stringified($result);
            break;
        case 'searchKeys':
            $search = check_key_json('search', $inputJSON);

            if (!$search)
                http_error(400, 'No search provided');

            $result = $db->searchKeys($search);

            http_response_stringified($result);
            break;
        case 'select':
            $select = check_key_json('select', $inputJSON);

            if ($select === false)
                http_error(400, 'No select provided');

            $result = $db->select($select);
            http_response_stringified($result);
            break;
        case 'values':
            $values = check_key_json('values', $inputJSON);

            if ($values === false)
                http_error(400, 'No key provided');

            $result = $db->values($values);
            http_response_stringified($result);
            break;
        case 'random':
            $params = check_key_json('random', $inputJSON);
            if ($params === false)
                http_error(400, 'No random object provided');

            http_response_stringified($db->random($params));
            break;
        default:
            break;
    }

    http_error(400, 'Bad request');

} catch (HTTPException $e) {
    http_error($e->getCode(), $e->getMessage());
} catch (Exception $e) {
    http_error(400, $e->getMessage());
}
