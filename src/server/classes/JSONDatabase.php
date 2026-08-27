<?php

require_once __DIR__ . '/../utils.php';
require_once __DIR__ . '/FileAccess.php';
require_once __DIR__ . '/HTTPException.php';

require_once __DIR__ . '/../read/search.php';
require_once __DIR__ . '/../write/editField.php';
require_once __DIR__ . '/../read/random.php';

/** Manages locked, JSON-backed collection operations. */
class JSONDatabase {
    /** Directory where the collection file is stored. */
    public string $folderPath = './files/';
    /** Collection file name without extension. */
    public string $fileName = 'db';
    /** Extension for the collection file. */
    public string $fileExt = '.json';

    /** Whether automatic key generation is enabled for add operations. */
    public bool $autoKey = true;
    /** Whether auto-generated keys should increment numerically or use unique IDs. */
    public bool $autoIncrement = true;
    /** Whether to use cryptographically secure random keys instead of timestamp-based unique IDs when autoIncrement is false. */
    public bool $secureKeys = false;

    /**
     * Creates a new JSONDatabase instance.
     *
     * @param string $fileName Collection file name without extension.
     * @param bool $autoKey Enable automatic key generation.
     * @param bool $autoIncrement Use auto-incrementing integer keys instead of unique IDs.
     * @param bool $secureKeys Use cryptographically secure random keys instead of timestamp-based uniqid.
     * @param string $folderPath Directory where collection files are stored.
     * @param string $fileExt File extension for the database file.
     */
    public function __construct(
        string $fileName = 'db',
        bool $autoKey = true,
        bool $autoIncrement = true,
        bool $secureKeys = false,
        string $folderPath = './files/',
        string $fileExt = '.json'
    ) {
        // if no/some args provided they just fall back to their defaults
        $this->fileName = $fileName;
        $this->autoKey = $autoKey;
        $this->autoIncrement = $autoIncrement;
        $this->secureKeys = $secureKeys;
        $this->folderPath = $folderPath;
        $this->fileExt = $fileExt;
    }

    /**
     * Gets the full file path for the collection JSON file.
     *
     * @return string
     */
    public function fullPath(): string {
        return $this->folderPath . $this->fileName . $this->fileExt;
    }

    /**
     * Validates raw JSON content and writes it directly to the collection file.
     *
     * @param mixed $content Raw content to write (must be array or object, not a primitive).
     * @return int|false Number of bytes written, or false on failure.
     * @throws HTTPException If content or an item inside is a primitive value.
     */
    public function writeRaw($content) {
        $content_type = gettype($content);
        $incorrect_types = ['integer', 'double', 'string', 'boolean'];

        // content must not be primitive
        if (in_array($content_type, $incorrect_types)) {
            throw new HTTPException("writeRaw value cannot be a $content_type", 400);
        }

        // value must not be a sequential array with values inside [1, 2, 3]
        // we accept sequential arrays but with objects not primitives
        if (is_array($content) and !array_assoc($content)) {
            foreach ($content as $item) {
                $item_type = gettype($item);
                if (in_array($item_type, $incorrect_types)) {
                    throw new HTTPException("writeRaw item cannot be a $item_type", 400);
                }
            }
        }

        $content = stringifier($content);

        // fix empty raw content because php parses {} as array(0)
        if ($content === '[]')
            $content = '{}';

        return file_put_contents($this->fullPath(), $content, LOCK_EX);
    }

    /**
     * Encodes collection data to JSON and writes it to file with file locking.
     *
     * @param FileObject $obj File object containing JSON data to encode.
     * @return int Number of bytes written.
     * @throws HTTPException If encoding fails.
     */
    private function write(FileObject $obj): int {
        $content = stringifier($obj->json, 1);
        if ($content === false) {
            throw new HTTPException('Failed to encode database content', 500);
        }
        $obj->content = $content;
        return FileAccess::write($obj);
    }

    /**
     * Returns the SHA-1 hash of the collection JSON content.
     *
     * @return string SHA-1 hash.
     */
    public function sha1(): string {
        $obj = $this->readRaw();
        return sha1($obj->content);
    }

    /**
     * Reads raw collection file contents.
     *
     * @param bool $waitLock Whether to obtain an exclusive file lock.
     * @return FileObject File object with raw file content.
     */
    public function readRaw(bool $waitLock = false): FileObject {
        // fall back to empty array if failed
        return FileAccess::read($this->fullPath(), $waitLock, '[]');
    }

    /**
     * Reads and decodes collection JSON content.
     *
     * @param bool $waitLock Whether to obtain an exclusive file lock.
     * @return FileObject File object with decoded JSON data.
     * @throws HTTPException If JSON decoding fails or structure is invalid.
     */
    public function read(bool $waitLock = false): FileObject {
        $res = $this->readRaw($waitLock);
        $decoded = json_decode($res->content, true);
        if (!is_array($decoded)) {
            throw new HTTPException('Database content must be a JSON object or array', 500);
        }
        $res->json = $decoded;
        return $res;
    }

    /**
     * Retrieves an element from the collection by its key.
     *
     * @param string|int $key Key of the element to retrieve.
     * @return mixed The stored element, or null if not found.
     */
    public function get($key) {
        $obj = $this->read();
        if (
            !array_key_exists(strval($key), $obj->json)
        )
            return null;
        return $obj->json[$key];
    }

    /**
     * Sets or overwrites an element in the collection by key.
     *
     * @param string|int $key Key for the element.
     * @param mixed $value Element object to store.
     * @return int Number of bytes written.
     * @throws HTTPException On invalid key or value type.
     */
    public function set($key, $value): int {
        // "===" fixes the empty array "==" comparison
        if ($key === null or $value === null) {
            throw new HTTPException('Key or value is null', 400);
        }

        $key_var_type = gettype($key);
        if (!is_keyable($key))
            throw new HTTPException("Incorrect key type, got $key_var_type, expected string or integer", 400);

        $encoded_value = json_encode($value);
        if ($encoded_value === false)
            throw new HTTPException('Failed to encode value', 400);

        $key = strval($key);

        // set it at the corresponding value
        $obj = $this->read(true);

        $obj->json[$key] = json_decode($encoded_value, true);
        return $this->write($obj);
    }

    /**
     * Sets multiple elements in the collection using parallel arrays of keys and values.
     *
     * @param mixed $keys Array of string|int keys.
     * @param mixed $values Array of corresponding values.
     * @throws HTTPException On invalid inputs or mismatched array sizes.
     */
    public function setBulk($keys, $values): void {
        // we verify that our keys are in an array
        $key_var_type = gettype($keys);
        if ($key_var_type != 'array')
            throw new HTTPException('Incorrect keys type');

        $encoded_values = json_encode($values);
        if ($encoded_values === false)
            throw new HTTPException('Failed to encode values', 400);

        $encoded_keys = json_encode($keys);
        if ($encoded_keys === false)
            throw new HTTPException('Failed to encode keys', 400);


        // else set it at the corresponding value
        $obj = $this->read(true);

        // decode and add all values
        $value_decoded = json_decode($encoded_values, true);
        $keys_decoded = json_decode($encoded_keys, true);

        // ensure both arrays are valid
        if (!is_array($keys_decoded) || !is_array($value_decoded)) {
            throw new HTTPException("Invalid input: keys or values are not arrays.");
        }

        // ensure both arrays have the same length
        if (count($keys_decoded) !== count($value_decoded)) {
            throw new HTTPException("Key and value array sizes are not equal.");
        }

        // regular for loop to join keys and values together
        for ($i = 0; $i < count($value_decoded); $i++) {
            if (!array_key_exists($i, $keys_decoded)) {
                throw new HTTPException("Undefined key at index $i in key array.");
            }

            $key_var_type = gettype($keys_decoded[$i]);
            if (!is_keyable($keys_decoded[$i]))
                throw new HTTPException("Incorrect key type, got $key_var_type, expected string or integer");

            $key = strval($keys_decoded[$i]);

            $obj->json[$key] = $value_decoded[$i];
        }

        $this->write($obj);
    }

    /**
     * Generates a candidate key (cryptographically secure random key or timestamp-based unique ID).
     *
     * @return string Candidate key string.
     */
    private function newKey(): string {
        return $this->secureKeys ? bin2hex(random_bytes(16)) : uniqid();
    }

    /**
     * Generates a new key based on the configured autoKey policy (increment, unique ID, or secure random key).
     *
     * @param array<int|string, mixed> $arr Existing collection items.
     * @return string Next available key.
     */
    private function newLastKey(array $arr): string {
        if ($this->autoIncrement) {
            $int_keys = array_filter(array_keys($arr), 'is_int');
            sort($int_keys);
            $last_key = count($int_keys) > 0 ? $int_keys[count($int_keys) - 1] + 1 : 0;
        } else {
            do {
                $last_key = $this->newKey();
            } while (array_key_exists($last_key, $arr));
        }

        return strval($last_key);
    }

    /**
     * Adds an element to the collection with an automatically generated key.
     *
     * @param mixed $value Element object to store.
     * @return string The generated key.
     * @throws HTTPException If autoKey is disabled or value is invalid.
     */
    public function add($value): string {
        if ($this->autoKey == false)
            throw new HTTPException('Automatic key generation is disabled');

        // restricts types to objects only
        $value_type = gettype($value);
        if (is_primitive($value) or (is_array($value) and count($value) and !array_assoc($value)))
            throw new HTTPException("add value must be an object, not a $value_type", 400);

        // else set it at the corresponding value
        $obj = $this->read(true);

        $id = $this->newLastKey($obj->json);
        $obj->json[$id] = $value;

        $this->write($obj);

        return $id;
    }

    /**
     * Adds multiple elements to the collection with automatically generated keys.
     *
     * @param mixed $values Array of element objects to store.
     * @return array<int, string> Array of generated keys in insertion order.
     * @throws HTTPException If autoKey is disabled or values are invalid.
     */
    public function addBulk($values): array {
        if (!$this->autoKey)
            throw new HTTPException('Automatic key generation is disabled');

        if ($values !== [] and $values == NULL)
            throw new HTTPException('null-like value not accepted', 400);

        // restricts types to non base variables
        $value_type = gettype($values);
        if (is_primitive($values) or (is_array($values) and count($values) and array_assoc($values)))
            throw new HTTPException("value must be an array not a $value_type", 400);

        // so here we have a sequential array type
        // now the values inside this array must not be base values
        foreach ($values as $value) {
            $value_type = gettype($value);
            if (is_primitive($value) or (array_sequential($value) and count($value)))
                throw new HTTPException("array value must be an object not a $value_type", 400);
        }

        // verify that values is an array with number indices
        if (array_assoc($values))
            throw new HTTPException('Wanted sequential array');

        // else set it at the corresponding value
        $obj = $this->read(true);

        // decode and add all values
        $values_decoded = $values;
        $id_array = [];
        foreach ($values_decoded as $value_decoded) {
            $id = $this->newLastKey($obj->json);

            $obj->json[$id] = $value_decoded;

            array_push($id_array, $id);
        }

        $this->write($obj);

        return $id_array;
    }

    /**
     * Removes an element from the collection by key.
     *
     * @param string|int $key Key of the element to remove.
     * @throws HTTPException On invalid key type.
     */
    public function remove($key): void {
        $key_var_type = gettype($key);
        if (!is_keyable($key))
            throw new HTTPException("Incorrect key type, got $key_var_type, expected string or integer", 400);

        $obj = $this->read(true);
        unset($obj->json[$key]);
        $this->write($obj);
    }

    /**
     * Removes multiple elements from the collection by their keys.
     *
     * @param mixed $keys Array of string|int keys to remove.
     * @throws HTTPException On invalid keys array format.
     */
    public function removeBulk($keys): void {
        if ($keys !== [] and $keys == NULL)
            throw new HTTPException('null-like keys not accepted', 400);

        if (gettype($keys) !== 'array' or array_assoc($keys))
            throw new HTTPException('keys must be an array', 400);

        for ($i = 0; $i < count($keys); $i++) {
            $key_var_type = gettype($keys[$i]);
            if (!is_keyable($keys[$i]))
                throw new HTTPException("Incorrect key type, got $key_var_type, expected string or integer", 400);
            else
                $keys[$i] = strval($keys[$i]);
        }

        $obj = $this->read(true);

        // idempotent: unset() on missing keys is a silent no-op per key, no exception thrown
        foreach ($keys as $key_decoded)
            unset($obj->json[$key_decoded]);

        $this->write($obj);
    }

    /**
     * Searches elements matching specified field conditions.
     *
     * @param array<int, array{field: string, criteria: mixed, value: mixed, ignoreCase?: bool}> $conditions Array of search conditions.
     * @param bool|array{seed?: int} $random Optional random selection settings or boolean.
     * @param bool|int $limit Maximum number of results to return.
     * @return array<int|string, mixed> Matching elements.
     * @throws HTTPException On invalid limit or random seed option.
     */
    public function search(array $conditions, $random = false, $limit = false): array {
        $has_limit = false;
        if (gettype($limit) === 'integer' && $limit > 0)
            $has_limit = true;
        else if ($limit !== false)
            throw new HTTPException('search option limit must be a positive integer');

        $obj = $this->read();
        $res = filter_search_conditions($obj->json, $conditions, $has_limit, $limit, $random);

        if ($random !== false) {
            $seed = false;
            if (is_array($random) && array_key_exists('seed', $random)) {
                $rawSeed = $random['seed'];
                if (!is_int($rawSeed))
                    throw new HTTPException('Seed not an integer value for random search result');
                $seed = intval($rawSeed);
            }
            // apply limit during random selection to avoid unnecessary processing
            $res = choose_random($res, $seed, $has_limit ? $limit : -1);
        }

        return $res;
    }

    /**
     * Searches for existing elements by an array of keys.
     *
     * @param mixed $searchedKeys Array of string|int keys to look up.
     * @return array<int|string, mixed> Map of found keys and their corresponding elements.
     */
    public function searchKeys($searchedKeys): array {
        $obj = $this->read();

        $res = [];
        if (gettype($searchedKeys) != 'array')
            return $res;

        foreach ($searchedKeys as $key) {
            $key = strval($key);

            if (array_key_exists($key, $obj->json)) {
                $res[$key] = $obj->json[$key];
            }
        }

        return $res;
    }

    /**
     * Performs a field edit operation on collection elements.
     *
     * @param mixed $editObj Edit specification object.
     * @throws HTTPException If edit specification is invalid.
     */
    public function editField($editObj): void {
        $fileObj = $this->read(true);
        edit_field($fileObj->json, $editObj);
        $this->write($fileObj);
    }

    /**
     * Performs multiple field edit operations in bulk.
     *
     * @param mixed $objArray Array of edit specification objects.
     * @return bool|void Returns false if input is an associative array, void on success.
     * @throws HTTPException If edit specification is invalid.
     */
    public function editFieldBulk($objArray) {
        // need sequential array
        if (array_assoc($objArray))
            return false;

        $fileObj = $this->read(true);
        foreach ($objArray as &$editObj) {
            // edit by reference, faster than passing values back and forth
            edit_field($fileObj->json, $editObj);
        }
        $this->write($fileObj);
    }

    /**
     * Projects specific fields from collection elements, with optional search filtering.
     *
     * @param array{fields: array<int, string>, search?: array<int, array{field: string, criteria: mixed, value: mixed, ignoreCase?: bool}>} $selectObj Selection options including field names and optional search conditions.
     * @return array<int|string, array<string, mixed>> Projected element data.
     * @throws HTTPException On invalid selection options.
     */
    public function select(array $selectObj): array {
        if (!array_key_exists('fields', $selectObj))
            throw new HTTPException('Missing required fields field');

        if (!(gettype($selectObj['fields']) === 'array') || !(array_sequential($selectObj['fields'])))
            throw new HTTPException('Incorrect fields type, expected an array');

        // all field arguments should be strings
        $fields = $selectObj['fields'];
        foreach ($fields as $field) {
            if (gettype($field) !== 'string')
                throw new HTTPException('fields field incorrect, expected a string array');
        }

        $obj = $this->read();
        $content = $obj->json;

        // optional search filter: apply search conditions before field projection
        if (array_key_exists('search', $selectObj)) {
            $searchConditions = $selectObj['search'];
            if (!is_array($searchConditions) || array_assoc($searchConditions))
                throw new HTTPException('search field must be a sequential array of search conditions');

            $content = filter_search_conditions($content, $searchConditions);
        }

        $result = [];
        foreach ($content as $key => $value) {
            $result[$key] = [];
            foreach ($fields as $field) {
                if (array_key_exists($field, $value))
                    $result[$key][$field] = $value[$field];
            }
        }

        return $result;
    }

    /**
     * Collects unique values for a given field across all elements in the collection.
     *
     * @param array{field: string, flatten?: bool} $valueObj Options containing target field name and optional flatten flag.
     * @return array<int, mixed> Unique values list.
     * @throws HTTPException On invalid value options.
     */
    public function values(array $valueObj): array {
        if (!array_key_exists('field', $valueObj))
            throw new HTTPException('Missing required field field');

        if (!is_string($valueObj['field']))
            throw new HTTPException('Incorrect field type, expected a string');

        if (array_key_exists('flatten', $valueObj)) {
            if (!is_bool($valueObj['flatten']))
                throw new HTTPException('Incorrect flatten type, expected a boolean');
            $flatten = $valueObj['flatten'];
        } else {
            $flatten = false;
        }

        $field = $valueObj['field'];

        $obj = $this->read();

        $result = [];
        foreach ($obj->json as $value) {
            // get correct field and skip existing primitive values (faster)
            if (!array_key_exists($field, $value) || in_array($value, $result))
                continue;

            // flatten array results if array field
            if ($flatten === true && is_array($value[$field]))
                $result = array_merge($result, $value[$field]);
            else
                array_push($result, $value[$field]);
        }

        // remove complex duplicates
        $result = array_intersect_key($result, array_unique(array_map('serialize', $result)));

        return $result;
    }


    /**
     * Selects random elements from the collection with optional seed and offset paging.
     *
     * @param array{max?: int, seed?: int, offset?: int} $params Options for count limit, random seed, and offset.
     * @return array<int|string, mixed> Randomly selected elements.
     * @throws HTTPException On invalid parameters.
     */
    public function random(array $params): array {
        $hasMax = array_key_exists('max', $params);
        $max = $hasMax ? $params['max'] : -1;
        if ($hasMax && (gettype($max) !== 'integer' || $max < -1))
            throw new HTTPException('Expected integer >= -1 for the max');

        $hasSeed = array_key_exists('seed', $params);
        $hasOffset = array_key_exists('offset', $params);

        // offset is relevant only if you get the key
        if ($hasOffset && !$hasSeed)
            throw new HTTPException('You can\'t put an offset without a seed');

        // offset validation
        $offset = $hasOffset ? $params['offset'] : 0;
        if ($hasOffset && (gettype($offset) !== 'integer' || $offset < 0))
            throw new HTTPException('Expected integer >= 0 for the offset');

        // seed validation
        $seed = $hasSeed ? $params['seed'] : false;
        if ($hasSeed && gettype($seed) !== 'integer')
            throw new HTTPException('Expected integer for the seed');

        $obj = $this->read();

        return choose_random($obj->json, $seed, $max, $offset);
    }
}
