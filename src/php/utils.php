<?php

function pre_dump($val) {
    echo '<pre>';
    var_dump($val);
    echo '</pre>';
}

function check($var) {
    if(isset($var) and !empty($var)) {
        return true;
    }
    return false;
}

function sec($var) {
    return htmlspecialchars($var);
}

function http_response($body, $code=200) {
    header('Content-Type: application/json');
    http_response_code($code);
    
    echo $body;
    
    exit();
}

function http_json_response($json, $code = 200) {
    http_response(json_encode($json), $code);
}

function http_message($message, $key = 'message', $code = 200) {
    $arr = array($key => $message);
    http_json_response($arr, $code);
}

function http_error($code, $message) {
    http_message($message, 'error', $code);
}

function http_success($message) {
    http_message($message, 'message', 200);
}

function check_key_json($key, $arr, $parse = false) {
    return array_key_exists($key, $arr) ? ($parse ? sec($arr[$key]) : $arr[$key]) : false;
}

function array_assoc(array $arr)
{
    if (array() === $arr) return false;
    return array_keys($arr) !== range(0, count($arr) - 1);
}

function array_sequential(array $arr)
{
    return !array_assoc($arr);
}

function stringifier($obj, $depth = 1) {	
	if($depth == 0) {
		return json_encode($obj);
	}
	
    $res = "{";
    
    $formed = array();
    foreach(array_keys($obj) as $key) {
        array_push($formed, '"' . strval($key) . '":' . stringifier($obj[$key], $depth - 1));
    }
    $res .= implode(",", $formed);
    
    $res .= "}";
    
    return $res;
}

function cors() {
// Allow from any origin
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');    // cache for 1 day
}

// Access-Control headers are received during OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {

    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");         

    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
        header("Access-Control-Allow-Headers:        {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

    exit(0);
}
}

function removeDots($path) {
    $root = ($path[0] === '/') ? '/' : '';

    $segments = explode('/', trim($path, '/'));
    $ret = array();
    foreach($segments as $segment){
        if (($segment == '.') || strlen($segment) === 0) {
            continue;
        }
        if ($segment == '..') {
            array_pop($ret);
        } else {
            array_push($ret, $segment);
        }
    }
    return $root . implode('/', $ret);
}

if (! function_exists('str_ends_with')) {
    function str_ends_with(string $haystack, string $needle): bool
    {
        $needle_len = strlen($needle);
        return ($needle_len === 0 || 0 === substr_compare($haystack, $needle, - $needle_len));
    }
}

?>
