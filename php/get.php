<?php
require_once('./utils.php');

cors();

// display all errors
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// import useful functions
require_once('./log.php');

$method = sec($_SERVER['REQUEST_METHOD']);
if($method !== 'GET' && $method !== 'POST') {
    http_error(400, 'Incorrect request type, expected GET or POST, not ' . $method);
}

$inputJSON = json_decode(file_get_contents('php://input'), true);

if(!$inputJSON)
    http_error(400, 'No JSON body provided');
    
// pre_dump($inputJSON);
// exit();

$collection = check_key_json('collection', $inputJSON);
if(!$collection)
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
    
/**
 * @var JSONDatabase
 */
$db = $database_list[$collection];

$command = check_key_json('command', $inputJSON);
if(!$command)
    http_error(400, 'No command provided');
    
$commands_available = ['read_raw', 'get', 'search', 'searchKeys', 'select', 'random'];

// var_dump($command);
// exit();

if(!in_array($command, $commands_available))
    http_error(404, 'Command not found: ' . $command . '. Available commands: ' . join(', ', $commands_available));
    
switch($command) {
    case 'read_raw':
        $res = $db->read_raw();
        $res = $res['content'];
        http_response($res);
        break;
    case 'get':
        $id = check_key_json('id', $inputJSON);
        
        // strict compare to include 0 or "0" ids
        if($id === false)
            http_error(400, 'No id provided');
            
        $result = $db->get($id);
        if(!$result)
            http_error(404, 'get failed on collection ' . $collection . ' with key ' . $id);
            
        http_response(stringifier($result));
        break;
    case 'search':
        $search = check_key_json('search', $inputJSON, false);
        $random = check_key_json('random', $inputJSON, false);
        
        if(!$search)
            http_error(400, 'No search provided');
        
        $result = $db->search($search, $random);
        
        http_response(stringifier($result));
        break;
    case 'searchKeys':
        $search = check_key_json('search', $inputJSON, false);
        
        if(!$search)
            http_error(400, 'No search provided');
            
        $result = $db->searchKeys($search);
        
        http_response(stringifier($result));
        break;
    case 'select':
        $select = check_key_json('select', $inputJSON, false);

        if($select === false) http_error('400', 'No select provided');

        $result = $db->select($select);
        http_response(stringifier($result));
    case 'random':
        $params = check_key_json('random', $inputJSON, false);
        if($params === false) http_error('400', 'No random object provided');

        http_response(stringifier($db->random($params)));
    default:
        break;
}

http_message(400, 'Bad request');


} catch(Exception $e) {
    http_error(500, $e->getMessage());
}
