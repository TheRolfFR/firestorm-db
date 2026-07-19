<?php

require_once __DIR__ . '/../utils.php';
require_once __DIR__ . '/FileAccess.php';
require_once __DIR__ . '/HTTPException.php';

require_once __DIR__ . '/../read/search.php';
require_once __DIR__ . '/../write/editField.php';
require_once __DIR__ . '/../read/random.php';

class JSONDatabase {
    /** Folder to get the JSON file from */
    public string $folderPath = './files/';
    /** Name of the JSON file */
    public string $fileName = 'db';
    /** File extension used in collection name */
    public string $fileExt = '.json';

    /** Whether to automatically generate the key name or to have explicit key names */
    public bool $autoKey = true;
    /** Whether to simply start at 0 and increment or to use a random ID name */
    public bool $autoIncrement = true;

    public function __construct(
        string $fileName = 'db',
        bool $autoKey = true,
        bool $autoIncrement = true
    ) {
        // if no/some args provided they just fall back to their defaults
        $this->fileName = $fileName;
        $this->autoKey = $autoKey;
        $this->autoIncrement = $autoIncrement;
    }

    public function fullPath(): string {
        return $this->folderPath . $this->fileName . $this->fileExt;
    }

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

        // now we know we have an associative array

        // content must be objects
        foreach ($content as $key => $item) {
            // item must not be primitive

            // we don't accept primitive keys as value
            $item_type = gettype($item);
            if (in_array($item_type, $incorrect_types)) {
                throw new HTTPException("writeRaw item with key $key cannot be a $item_type", 400);
            }

            // we accept associative array as items because they may have an integer key
        }

        $content = stringifier($content);

        // fix empty raw content because php parses {} as array(0)
        if ($content === '[]')
            $content = '{}';

        return file_put_contents($this->fullPath(), $content, LOCK_EX);
    }

    private function write(FileObject $obj) {
        $obj->content = stringifier($obj->content, 1);
        return FileAccess::write($obj);
    }

    public function sha1() {
        $obj = $this->readRaw();
        return sha1($obj->content);  // @phpstan-ignore argument.type
    }

    public function readRaw($waitLock = false): FileObject {
        // fall back to empty array if failed
        return FileAccess::read($this->fullPath(), $waitLock, json_encode([]));
    }

    public function read($waitLock = false) {
        $res = $this->readRaw($waitLock);
        $res->content = json_decode($res->content, true);  // @phpstan-ignore argument.type
        return $res;
    }

    public function get($key) {
        $obj = $this->read();
        if (
            !$obj ||
            property_exists($obj, 'content') == false ||
            array_key_exists(strval($key), $obj->content) == false
        )
            return null;
        return $obj->content[$key];
    }

    public function set($key, $value) {
        // "===" fixes the empty array "==" comparison
        if ($key === null or $value === null) {
            throw new HTTPException('Key or value is null', 400);
        }

        $key_var_type = gettype($key);
        if (!is_keyable($key))
            throw new HTTPException("Incorrect key type, got $key_var_type, expected string or integer", 400);

        $value_var_type = gettype($value);
        if (is_primitive($value))
            throw new HTTPException("Invalid value type, got $value_var_type, expected object", 400);

        if ($value !== [] and !array_assoc($value))
            throw new HTTPException('Value cannot be a sequential array', 400);

        $encoded_value = json_encode($value);
        if ($encoded_value === false)
            throw new HTTPException('Failed to encode value', 400);

        $key = strval($key);

        // set it at the corresponding value
        $obj = $this->read(true);

        $obj->content[$key] = json_decode($encoded_value, true);
        return $this->write($obj);
    }

    public function setBulk($keys, $values) {
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

            $obj->content[$key] = $value_decoded[$i];
        }

        $this->write($obj);
    }

    private function newLastKey($arr) {
        if ($this->autoIncrement) {
            $int_keys = array_filter(array_keys($arr), 'is_int');
            sort($int_keys);
            $last_key = count($int_keys) > 0 ? $int_keys[count($int_keys) - 1] + 1 : 0;
        } else {
            $last_key = uniqid();
            while (array_key_exists($last_key, $arr))
                $last_key = uniqid();
        }

        return strval($last_key);
    }

    public function add($value) {
        if ($this->autoKey == false)
            throw new HTTPException('Automatic key generation is disabled');

        // restricts types to objects only
        $value_type = gettype($value);
        if (is_primitive($value) or (is_array($value) and count($value) and !array_assoc($value)))
            throw new HTTPException("add value must be an object, not a $value_type", 400);

        // else set it at the corresponding value
        $obj = $this->read(true);

        $id = $this->newLastKey($obj->content);
        $obj->content[$id] = $value;

        $this->write($obj);

        return $id;
    }

    public function addBulk($values) {
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
            $id = $this->newLastKey($obj->content);

            $obj->content[$id] = $value_decoded;

            array_push($id_array, $id);
        }

        $this->write($obj);

        return $id_array;
    }

    public function remove($key) {
        $key_var_type = gettype($key);
        if (!is_keyable($key))
            throw new HTTPException("Incorrect key type, got $key_var_type, expected string or integer", 400);

        $obj = $this->read(true);
        unset($obj->content[$key]);
        $this->write($obj);
    }

    public function removeBulk($keys) {
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

        // remove all keys
        foreach ($keys as $key_decoded)
            unset($obj->content[$key_decoded]);

        $this->write($obj);
    }

    public function search($conditions, $random = false, $limit = false) {
        $has_limit = false;
        if (gettype($limit) === 'integer' && $limit > 0)
            $has_limit = true;
        else if ($limit !== false)
            throw new HTTPException('search option limit must be a positive integer');

        $obj = $this->read();
        $res = [];

        foreach ($obj->content as $key => $el) {
            $el_root = $el;

            $add = true;
            foreach ($conditions as $condition) {
                if (!$add)
                    break;

                // extract field
                $field = $condition['field'];
                $field_path = explode('.', $field);

                // get nested fields if needed
                for ($field_ind = 0; $el != NULL && $field_ind + 1 < count($field_path); ++$field_ind) {
                    // don't crash if unknown nested key, break early
                    if (!array_key_exists($field_path[$field_ind], $el))
                        break;

                    $el = $el[$field_path[$field_ind]];
                    $field = $field_path[$field_ind + 1];
                }

                if (
                    $el == NULL ||
                    !array_key_exists($field, $el) ||
                    !array_key_exists('criteria', $condition) ||
                    !array_key_exists('value', $condition)
                ) {
                    $add = false;
                    break;
                }

                $ignoreCase = array_key_exists('ignoreCase', $condition) && !!$condition['ignoreCase'];
                $add = search(
                    $el[$field],
                    $condition['criteria'],
                    $condition['value'],
                    $ignoreCase
                );

                $el = $el_root;
            }

            // if all conditions are met, we can add the value to our output
            if ($add)
                $res[$key] = $el_root;

            // only stop early if results will not be ordered randomly
            if ($has_limit && $random === false && count($res) >= $limit)
                break;
        }

        if ($random !== false) {
            $seed = false;
            if (is_array($random) && array_key_exists('seed', $random)) {
                $rawSeed = sec($random['seed']);
                if (!is_int($rawSeed))
                    throw new HTTPException('Seed not an integer value for random search result');
                $seed = intval($rawSeed);
            }
            // apply limit during random selection to avoid unnecessary processing
            $res = choose_random($res, $seed, $has_limit ? $limit : -1);
        }

        return $res;
    }

    public function searchKeys($searchedKeys) {
        $obj = $this->read();

        $res = [];
        if (gettype($searchedKeys) != 'array')
            return $res;

        foreach ($searchedKeys as $key) {
            $key = strval($key);

            if (array_key_exists($key, $obj->content)) {
                $res[$key] = $obj->content[$key];
            }
        }

        return $res;
    }

    public function editField($editObj) {
        $fileObj = $this->read(true);
        editField($fileObj->content, $editObj);
        $this->write($fileObj);
    }

    public function editFieldBulk($objArray) {
        // need sequential array
        if (array_assoc($objArray))
            return false;

        $fileObj = $this->read(true);
        foreach ($objArray as &$editObj) {
            // edit by reference, faster than passing values back and forth
            editField($fileObj, $editObj);
        }
        $this->write($fileObj);
    }

    public function select($selectObj) {
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

        $result = [];
        foreach ($obj->content as $key => $value) {
            $result[$key] = [];
            foreach ($fields as $field) {
                if (array_key_exists($field, $value))
                    $result[$key][$field] = $value[$field];
            }
        }

        return $result;
    }

    public function values($valueObj) {
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
        foreach ($obj->content as $value) {
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


    // can run with a maximum amount of random entries
    // (if collection is smaller it's not guaranteed)
    // (is optional, else it will be all the results)
    public function random($params) {
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

        return choose_random($obj->content, $seed, $max, $offset);
    }
}
