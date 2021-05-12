<?php

// import useful functions
require_once('./utils.php');

$method = sec($_SERVER['REQUEST_METHOD']);
if($method === 'GET') {
    http_error(400, 'Incorrect request type, expected POST, not ' . $method);
}

$inputJSON = json_decode(file_get_contents('php://input'), true);

if(!$inputJSON)
    http_error(400, 'No JSON body provided');
    
// pre_dump($inputJSON);
// exit();

$token = check_key_json('token', $inputJSON);
if(!$token)
    http_error(400, 'No token provided');

if(file_exists('./tokens.php') == false)
    http_error(501, 'Admin didn\'t implemented tokens.php file');

// add tokens    
require_once('./tokens.php');

if(!$db_tokens)
    http_error(400, 'Developer is dumb and forgot to create tokens');

// verifying token
if(!in_array($token, $db_tokens))
    http_error(403, 'Invalid token');

$collection = check_key_json('collection', $inputJSON);
if(!check($collection))
    http_error(400, 'No collection provided');

if(file_exists('./config.php') == false)
    http_error(501, 'Admin didn\'t implemented config.php file');

// import db config
require_once('./config.php');

// trying things
try {
    
// checking good collection
if(!array_key_exists($collection, $database_list))
    http_error(404, 'Collection not found: ' . $collection);
    
$db = $database_list[$collection];

$command = check_key_json('command', $inputJSON);
if($command === false)
    http_error(400, 'No command provided');
    
$commands_available = ['write_raw', 'add', 'addBulk', 'remove', 'removeBulk', 'set', 'setBulk'];

if(!in_array($command, $commands_available))
    http_error(404, 'Command not found: ' . $command . '. Available commands: ' . join(', ', $commands_available));
    
$valueKeyName = ($command != 'setBulk' && $command != 'addBulk') ? 'value' : 'values';
$value = check_key_json($valueKeyName, $inputJSON, false);

if($value === false)
    http_error(400, 'No ' . $valueKeyName . ' provided');

switch($command) {
    case 'write_raw':
        $db->write_raw(json_encode($value));
        http_success('Successful ' . $command . ' command');
        break;
    case 'add':
        $newId = $db->add($value);
        http_message($newId, 'id', 200);
        break;
    case 'addBulk':
        $id_array = $db->addBulk($value);
        http_message($id_array, 'ids', 200);
        break;
    case 'remove':
        $db->remove($value);
        http_success('Successful ' . $command . ' command');
        break;
    case 'removeBulk':
        $db->add($value);
        http_success('Successful ' . $command . ' command');
        break;
    case 'set':
        $dbKey = check_key_json('key', $inputJSON);
        if(!$dbKey)
            http_error(400, 'No key provided');
        
        $db->set($dbKey, $value);
        http_success('Successful ' . $command . ' command');
        break;
    case 'setBulk':
        $dbKey = check_key_json('keys', $inputJSON, false);
        if(!$dbKey)
            http_error(400, 'No keys provided');
        
        $db->setBulk($dbKey, $value);
        http_success('Successful ' . $command . ' command');
        break;
    default:
        break;
}

http_error(404, 'No request handler found for command ' . $command);

} catch(Exception $e) {
    http_error(400, $e->getMessage());
}