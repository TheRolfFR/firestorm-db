<?php

require_once('./utils.php');
require_once('./classes/JSONDatabase.php');

$props = array(
    array('house', false),
    array('base', true, true),
);

$database_list = array();
foreach($props as $prop) {
  $dbName = $prop[0];
  $autoKey = $prop[1];
  $autoKeyIncrement = count($prop) > 2 and $prop[2] == true;
  
  $tmp_db = new JSONDatabase;
  $tmp_db->fileName = $dbName;
  $tmp_db->autoKey = $autoKey;
  $tmp_db->autoIncrement = $autoKeyIncrement;
  
  $database_list[$dbName] = $tmp_db;
}

$log_path = "firestorm.log";

?>