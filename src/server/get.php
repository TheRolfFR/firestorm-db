<?php

require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/enums/ApiCommand.php';

cors();

// hide error display from client responses
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);

// import useful functions
require_once __DIR__ . '/log.php';

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method !== 'GET' && $method !== 'POST') {
    http_error(400, "Incorrect request type, expected GET or POST, not $method");
}

$rawInput = file_get_contents('php://input') ?: "";
if ($rawInput === '' || !json_validate($rawInput)) {
    http_error(400, 'No JSON body provided');
}

$inputJSON = json_decode($rawInput, true);

if (!is_array($inputJSON))
    http_error(400, 'No JSON body provided');

$collection = check_key_json('collection', $inputJSON);
if (!$collection || !is_string($collection))
    http_error(400, 'No collection provided');

if (!file_exists('./config.php'))
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
     * @var JSONDatabase $db
     */
    $db = $database_list[$collection];

    $commandStr = check_key_json('command', $inputJSON);
    if (!$commandStr || !is_string($commandStr))
        http_error(400, 'No command provided');

    $command = ReadCommand::tryFrom($commandStr);
    if ($command === null) {
        $available_commands = array_map(fn(ReadCommand $c) => $c->value, ReadCommand::cases());
        http_error(404, "Command not found: $commandStr. Available commands: " . implode(', ', $available_commands));
    }

    switch ($command) {
        case ReadCommand::Sha1:
            $res = $db->sha1();
            http_response($res);
        case ReadCommand::ReadRaw:
            $res = $db->readRaw();
            http_response($res->content);
        case ReadCommand::Get:
            if (!array_key_exists('id', $inputJSON))
                http_error(400, 'No id provided');

            $id = $inputJSON['id'];

            $result = $db->get($id);
            if ($result === null)
                http_error(404, "get failed on collection $collection with key $id");

            http_response_stringified($result);
        case ReadCommand::Search:
            $search = check_key_json('search', $inputJSON);
            $random = check_key_json('random', $inputJSON);
            $limit = check_key_json('limit', $inputJSON);

            if (!is_array($search))
                http_error(400, 'No search provided');

            $result = $db->search($search, $random, $limit);

            http_response_stringified($result);
        case ReadCommand::SearchKeys:
            $search = check_key_json('search', $inputJSON);

            if (!$search)
                http_error(400, 'No search provided');

            $result = $db->searchKeys($search);

            http_response_stringified($result);
        case ReadCommand::Select:
            $select = check_key_json('select', $inputJSON);

            if ($select === false || !is_array($select))
                http_error(400, 'No select provided');

            $result = $db->select($select);
            http_response_stringified($result);
        case ReadCommand::Values:
            $values = check_key_json('values', $inputJSON);

            if ($values === false || !is_array($values))
                http_error(400, 'No key provided');

            $result = $db->values($values);
            http_response_stringified($result);
        case ReadCommand::Random:
            $params = check_key_json('random', $inputJSON);
            if ($params === false || !is_array($params))
                http_error(400, 'No random object provided');

            http_response_stringified($db->random($params));
    }

} catch (HTTPException $e) {
    http_error($e->getCode(), $e->getMessage());
} catch (Exception $e) {
    http_error(400, $e->getMessage());
}
