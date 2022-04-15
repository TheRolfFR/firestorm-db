<?php

require_once('./utils.php');
require_once('./classes/JSONDatabase.php');

$props = array(
    array('users', false), // Key is Discord ID
    array('paths', true), // I need auto key but not necessarly autoIncrement
    array('contributions', true), // I need auto key but not necessarly autoIncrement
    array('textures', true), // I need auto increment ID
    array('uses', true), // I need auto increment ID
    array('animation', false), // key is texture use ID
);

$database_list = array();
foreach($props as $prop) {
    $dbName = $prop[0];
    $autoKey = $prop[1];
    
    $tmp_db = new JSONDatabase;
    $tmp_db->fileName = $dbName;
    $tmp_db->autoKey = $autoKey;
    
    if($dbName == 'paths' or $dbName == 'contributions') {
        $tmp_db->autoIncrement = false;
    }
    
    $database_list[$dbName] = $tmp_db;
}

$log_path = "firestorm.log";

?>