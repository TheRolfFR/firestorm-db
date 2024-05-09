<?php

require_once './utils.php';
require_once './classes/JSONDatabase.php';

$log_path = 'firestorm.log';
$database_list = array();

/**
 * Example server-side collection creation:
 * The class has most things set by default, so this is intentionally verbose
 * For adding multiple collections, you can declare them directly in the array constructor.
 */

$db = new JSONDatabase;
// This will be the name of the JSON file
// It has to be the same as the actual file name (no extension)
$db->fileName = 'my_json_name';
// Whether to automatically generate the key name or to have explicit key names
// - Default: true
$db->autoKey = true;
// Whether to simply start at 0 and increment or to use a random ID name
// - Ignored if autoKey is false
// - Default: true
$db->autoIncrement = true;
// The database_list key is what the collection will be called in JavaScript
$database_list['my_collection_name'] = $db;

// This can be simplified into the following constructor:
// - Note: all of these arguments are optional and will fall back to their defaults if not provided
// - Order: (fileName, autoKey, autoIncrement)
$database_list['my_collection_name'] = new JSONDatabase('my_json_name', true, true);

/**
 * File handling:
 * If you don't need this functionality, delete this section and files.php.
 */

// Extension whitelist
$authorized_file_extension = array('.txt', '.png', '.jpg', '.jpeg');

// Root directory for where files should be uploaded
// ($_SERVER['SCRIPT_FILENAME']) is a shortcut to the root Firestorm directory.
$STORAGE_LOCATION = dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';
