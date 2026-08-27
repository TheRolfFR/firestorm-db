<?php

// import useful functions
require_once __DIR__ . '/classes/HTTPException.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/enums/ApiCommand.php';

cors();

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET') {
    http_error(400, "Incorrect request type, expected POST, not $method");
}

$rawInput = file_get_contents('php://input') ?: "";
if ($rawInput === '' || !json_validate($rawInput)) {
    http_error(400, 'No JSON body provided');
}

$inputJSON = json_decode($rawInput, true);

if (!is_array($inputJSON))
    http_error(400, 'No JSON body provided');

$token = check_key_json('token', $inputJSON);
if (!$token || !is_string($token))
    http_error(400, 'No token provided');

if (!file_exists('./tokens.php'))
    http_error(501, 'Developer didn\'t implement a tokens.php file');

// add tokens
require_once './tokens.php';

/** @var array<string>|null $db_tokens */
if (!$db_tokens)
    http_error(400, 'Developer is dumb and forgot to create tokens');

// verifying token
if (!verify_token($token, $db_tokens))
    http_error(403, 'Invalid token');

$collection = check_key_json('collection', $inputJSON);
if (!check($collection) || !is_string($collection))
    http_error(400, 'No collection provided');

if (!file_exists('./config.php'))
    http_error(501, 'Developer didn\'t implement a config.php file');

// import db config
require_once './config.php';

/** @var array<string, JSONDatabase> $database_list */

// HTTPExceptions get properly handled in the catch
try {

    // checking good collection
    if (!array_key_exists($collection, $database_list))
        http_error(404, "Collection not found: $collection");

    $db = $database_list[$collection];

    $commandStr = check_key_json('command', $inputJSON);
    if ($commandStr === false || !is_string($commandStr))
        http_error(400, 'No command provided');

    $command = WriteCommand::tryFrom($commandStr);
    if ($command === null) {
        $available_commands = array_map(fn(WriteCommand $c) => $c->value, WriteCommand::cases());
        http_error(404, "Command not found: $commandStr. Available commands: " . implode(', ', $available_commands));
    }

    $isBulk = in_array($command, [WriteCommand::SetBulk, WriteCommand::AddBulk, WriteCommand::RemoveBulk, WriteCommand::EditFieldBulk], true);
    $valueKeyName = $isBulk ? 'values' : 'value';
    if (!array_key_exists($valueKeyName, $inputJSON))
        http_error(400, "No $valueKeyName provided");

    $value = $inputJSON[$valueKeyName];

    switch ($command) {
        case WriteCommand::WriteRaw:
            $db->writeRaw($value);
            http_success("Successful {$command->value} command");
        case WriteCommand::Add:
            $newId = $db->add($value);
            http_message($newId, 'id', 200);
        case WriteCommand::AddBulk:
            $id_array = $db->addBulk($value);
            http_message($id_array, 'ids', 200);
        case WriteCommand::Remove:
            $db->remove($value);
            http_success("Successful {$command->value} command");
        case WriteCommand::RemoveBulk:
            $db->removeBulk($value);
            http_success("Successful {$command->value} command");
        case WriteCommand::Set:
            if (!array_key_exists('key', $inputJSON))
                http_error(400, 'No key provided');

            $dbKey = $inputJSON['key'];
            $db->set($dbKey, $value);
            http_success("Successful {$command->value} command");
        case WriteCommand::SetBulk:
            if (!array_key_exists('keys', $inputJSON))
                http_error(400, 'No keys provided');

            $dbKey = $inputJSON['keys'];
            $db->setBulk($dbKey, $value);
            http_success("Successful {$command->value} command");
        case WriteCommand::EditField:
            $db->editField($value);
            http_success("Successful {$command->value} command");
        case WriteCommand::EditFieldBulk:
            $res = $db->editFieldBulk($value);
            if ($res === false)
                http_error(400, 'Incorrect data provided');

            http_success("Successful {$command->value} command");
    }

} catch (HTTPException $e) {
    http_error($e->getCode(), $e->getMessage());
} catch (Exception $e) {
    http_error(400, $e->getMessage());
}
