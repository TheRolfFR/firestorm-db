<?php
require_once './utils.php';
require_once './classes/JSONDatabase.php';

$log_path = 'firestorm.log';

/**
 * Example server-side collection creation:
 * The class has most things set by default, so this is intentionally verbose
 * For adding multiple collections, you can declare them directly in the array constructor.
 */

$database_list = [];

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
// Whether to use cryptographically secure random keys instead of timestamp-based uniqid
// - Ignored if autoIncrement is true or autoKey is false
// - Default: false
$db->secureKeys = false;
// The database_list key is what the collection will be called in JavaScript
$database_list['my_collection_name'] = $db;

// This can be simplified using constructor arguments or PHP 8 named arguments:
// - Note: all of these arguments are optional and will fall back to their defaults if not provided
// - Order: (fileName, autoKey, autoIncrement, secureKeys, folderPath, fileExt)
$database_list['my_collection_name'] = new JSONDatabase('my_json_name', true, true, false);
// Example with named arguments:
// $database_list['secure_collection'] = new JSONDatabase(
//     fileName: 'secure_data',
//     autoIncrement: false,
//     secureKeys: true
// );

/**
 * File handling:
 * If you don't need this functionality, delete this section, files.php and files_api/*.php files.
 */

// Extension whitelist
$authorized_file_extension = ['.txt', '.png', '.jpg', '.jpeg'];

// Root directory for where files should be uploaded
// ($_SERVER['SCRIPT_FILENAME']) is a shortcut to the root Firestorm directory.
$STORAGE_LOCATION = dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';
