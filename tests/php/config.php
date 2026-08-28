<?php
if (file_exists('./utils.php')) {
    require_once './utils.php';
} else {
    require_once __DIR__ . '/../../src/server/utils.php';
}

if (file_exists('./classes/JSONDatabase.php')) {
    require_once './classes/JSONDatabase.php';
} else {
    require_once __DIR__ . '/../../src/server/classes/JSONDatabase.php';
}

// whitelist of correct extensions
$authorized_file_extension = ['.txt', '.png', '.jpg', '.jpeg'];

// subfolder of uploads location, must start with dirname($_SERVER['SCRIPT_FILENAME'])
// to force a subfolder of firestorm installation
$STORAGE_LOCATION = dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';

$database_list = [
	// test with constructor/optional args
	"house" => new JSONDatabase('house', false),
	"random_keys" => new JSONDatabase('random_keys', true, false, false),
	"secure_keys" => new JSONDatabase('secure_keys', true, false, true),
];

// test without constructor
$tmp = new JSONDatabase;
$tmp->fileName = 'base';
$tmp->autoKey = true;
$tmp->autoIncrement = true;

$database_list[$tmp->fileName] = $tmp;

$settingsDoc = new JSONDatabase('settings', false);
$database_list['settings'] = $settingsDoc;

$log_path = 'firestorm.log';
