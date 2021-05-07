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

function http_message($message, $key = 'message', $code = 200) {
    $arr = array($key => $message);
    http_response(json_encode($arr), $code);
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

?>