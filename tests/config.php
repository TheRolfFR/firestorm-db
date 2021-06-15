<?php

require_once('./utils.php');
require_once('./classes/JSONDatabase.php');

$props = array(
    array('base', true), // Key is Discord ID
);

$database_list = array();
foreach($props as $prop) {
  $dbName = $prop[0];
  $autoKey = $prop[1];
  
  $tmp_db = new JSONDatabase;
  $tmp_db->fileName = $dbName;
  $tmp_db->autoKey = $autoKey;
  
  $database_list[$dbName] = $tmp_db;
}

$log_path = "firestorm.log";

?>