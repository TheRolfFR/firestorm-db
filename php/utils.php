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
    http_message($message, 200);
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

?>