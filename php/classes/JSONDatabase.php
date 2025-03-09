<?php

require_once './utils.php';
require_once './classes/FileAccess.php';
require_once './classes/HTTPException.php';
require_once './classes/read/random.php';
require_once './classes/read/searchArray.php';

class JSONDatabase {
    /** Folder to get the JSON file from */
    public $folderPath = './files/';
    /** Name of the JSON file */
    public $fileName = 'db';
    /** File extension used in collection name */
    public $fileExt = '.json';

    /** Whether to automatically generate the key name or to have explicit key names */
    public $autoKey = true;
    /** Whether to simply start at 0 and increment or to use a random ID name */
    public $autoIncrement = true;

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

    public function fullPath() {
        return $this->folderPath . $this->fileName . $this->fileExt;
    }

    public function write_raw($content) {
        $content_type = gettype($content);
        $incorrect_types = array('integer', 'double', 'string', 'boolean');

        // content must not be primitive
        if (in_array($content_type, $incorrect_types)) {
            throw new HTTPException("write_raw value cannot be a $content_type", 400);
        }

        // value must not be a sequential array with values inside [1, 2, 3]
        // we accept sequential arrays but with objects not primitives
        if (is_array($content) and !array_assoc($content)) {
            foreach ($content as $item) {
                $item_type = gettype($item);
                if (in_array($item_type, $incorrect_types)) {
                    throw new HTTPException("write_raw item cannot be a $item_type", 400);
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
                throw new HTTPException("write_raw item with key $key cannot be a $item_type", 400);
            }

            // we accept associative array as items because they may have an integer key
        }

        $content = stringifier($content);

        // fix empty raw content because php parses {} as array(0)
        if ($content === '[]')
            $content = '{}';

        return file_put_contents($this->fullPath(), $content, LOCK_EX);
    }

    private function write($obj) {
        $obj['content'] = stringifier($obj['content'], 1);
        return FileAccess::write($obj);
    }

    public function sha1() {
        $obj = $this->read_raw();
        return sha1($obj['content']);
    }

    public function read_raw($waitLock = false) {
        // fall back to empty array if failed
        return FileAccess::read($this->fullPath(), $waitLock, json_encode(array()));
    }

    public function read($waitLock = false) {
        $res = $this->read_raw($waitLock);
        $res['content'] = json_decode($res['content'], true);
        return $res;
    }

    public function get($key) {
        $obj = $this->read();
        if (
            !$obj ||
            array_key_exists('content', $obj) == false ||
            array_key_exists(strval($key), $obj['content']) == false
        )
            return null;

        $res = array($key => $obj['content'][$key]);
        return $res;
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

        if ($value !== array() and !array_assoc($value))
            throw new HTTPException('Value cannot be a sequential array', 400);

        $key = strval($key);

        // set it at the corresponding value
        $obj = $this->read(true);
        $obj['content'][$key] = json_decode(json_encode($value), true);
        return $this->write($obj);
    }

    public function setBulk($keys, $values) {
        // we verify that our keys are in an array
        $key_var_type = gettype($keys);
        if ($key_var_type != 'array')
            throw new HTTPException('Incorrect keys type');

        // else set it at the corresponding value
        $obj = $this->read(true);

        // decode and add all values
        $value_decoded = json_decode(json_encode($values), true);
        $keys_decoded = json_decode(json_encode($keys), true);

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

            $obj['content'][$key] = $value_decoded[$i];
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

        $id = $this->newLastKey($obj['content']);
        $obj['content'][$id] = $value;

        $this->write($obj);

        return $id;
    }

    public function addBulk($values) {
        if (!$this->autoKey)
            throw new HTTPException('Automatic key generation is disabled');

        if ($values !== array() and $values == NULL)
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
        $id_array = array();
        foreach ($values_decoded as $value_decoded) {
            $id = $this->newLastKey($obj['content']);

            $obj['content'][$id] = $value_decoded;

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
        unset($obj['content'][$key]);
        $this->write($obj);
    }

    public function removeBulk($keys) {
        if ($keys !== array() and $keys == NULL)
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
            unset($obj['content'][$key_decoded]);

        $this->write($obj);
    }

    private function _search($field, $criteria, $value, $ignoreCase): bool {
        $fieldType = gettype($field);
        switch ($fieldType) {
            case 'boolean':
                switch ($criteria) {
                    case '!=':
                        return $field != $value;
                    case '==':
                        return $field == $value;
                    default:
                        return false;
                }
            case 'integer':
            case 'double':
                switch ($criteria) {
                    case '!=':
                        return $field != $value;
                    case '==':
                        return $field == $value;
                    case '>=':
                        return $field >= $value;
                    case '<=':
                        return $field <= $value;
                    case '<':
                        return $field < $value;
                    case '>':
                        return $field > $value;
                    case 'in':
                        return in_array($field, $value);
                    default:
                        return false;
                }
            case 'string':
                // saves a lot of duplicate ternaries, no idea why php needs these to be strings
                $cmpFunc = $ignoreCase ? 'strcasecmp' : 'strcmp';
                $posFunc = $ignoreCase ? 'stripos' : 'strpos';
                switch ($criteria) {
                    case '!=':
                        return $cmpFunc($field, $value) != 0;
                    case '==':
                        return $cmpFunc($field, $value) == 0;
                    case '>=':
                        return $cmpFunc($field, $value) >= 0;
                    case '<=':
                        return $cmpFunc($field, $value) <= 0;
                    case '<':
                        return $cmpFunc($field, $value) < 0;
                    case '>':
                        return $cmpFunc($field, $value) > 0;
                    case 'includes':
                    case 'contains':
                        return $value != '' ? ($posFunc($field, $value) !== false) : true;
                    case 'startsWith':
                        return $value != '' ? ($posFunc($field, $value) === 0) : true;
                    case 'endsWith':
                        $end = substr($field, -strlen($value));
                        return $value != '' ? ($cmpFunc($end, $value) === 0) : true;
                    case 'in':
                        $found = false;
                        foreach ($value as $val) {
                            $found = $cmpFunc($field, $val) == 0;
                            if ($found)
                                break;
                        }
                        return $found;
                    default:
                        return false;
                }
            case 'array':
                switch ($criteria) {
                    case 'array-contains':
                        return array_contains($field, $value, $ignoreCase);
                    case 'array-contains-none':
                        return !array_contains_any($field, $value, $ignoreCase);
                    case 'array-contains-any':
                        return array_contains_any($field, $value, $ignoreCase);
                    case 'array-length':
                    case 'array-length-eq':
                        return count($field) == $value;
                    case 'array-length-df':
                        return count($field) != $value;
                    case 'array-length-gt':
                        return count($field) > $value;
                    case 'array-length-lt':
                        return count($field) < $value;
                    case 'array-length-ge':
                        return count($field) >= $value;
                    case 'array-length-le':
                        return count($field) <= $value;
                    default:
                        return false;
                }
            default:
                break;
        }

        // unknown type
        return false;
    }

    public function search($conditions, $random = false) {
        $obj = $this->read();
        $res = [];

        foreach ($obj['content'] as $key => $el) {
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
                $add = $this->_search(
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
        }

        if ($random !== false) {
            $seed = false;
            if (is_array($random) && array_key_exists('seed', $random)) {
                $rawSeed = sec($random['seed']);
                if (!is_int($rawSeed))
                    throw new HTTPException('Seed not an integer value for random search result');
                $seed = intval($rawSeed);
            }
            $res = choose_random($res, $seed);
        }

        return $res;
    }

    public function searchKeys($searchedKeys) {
        $obj = $this->read();

        $res = array();
        if (gettype($searchedKeys) != 'array')
            return $res;

        foreach ($searchedKeys as $key) {
            $key = strval($key);

            if (array_key_exists($key, $obj['content'])) {
                $res[$key] = $obj['content'][$key];
            }
        }

        return $res;
    }

    // MANDATORY REFERENCE to edit directly: PHP 5+
    private function _edit(&$obj, $editObj): bool {
        // must be associative array
        $editObjType = gettype($editObj);
        if (is_primitive($editObj) || array_sequential($editObj))
            throw new HTTPException("Edit object has wrong type $editObjType, expected object", 400);

        // id required
        if (!array_key_exists('id', $editObj) || !check($editObj['id']))
            throw new HTTPException('Missing ID field', 400);

        $id = $editObj['id'];

        // id string or integer
        if (!is_keyable($id))
            throw new HTTPException('ID must be a string or number', 400);

        // object not found
        if (!array_key_exists($id, $obj['content']) || !check($obj['content'][$id]))
            throw new HTTPException('ID doesn\'t exist in collection', 400);

        // field required
        if (!array_key_exists('field', $editObj) || !check($editObj['field']))
            throw new HTTPException('Missing field field', 400);

        $field = $editObj['field'];

        // field is a string
        if (gettype($field) != 'string')
            throw new HTTPException('field must be a string', 400);

        // operation required
        if (!array_key_exists('operation', $editObj) || !check($editObj['operation']))
            throw new HTTPException('Missing operation field', 400);

        $operation = $editObj['operation'];

        $value = null;

        // return if operation has no value
        // set, append, array-push, array-delete, array-splice
        if (
            in_array($operation, ['set', 'append', 'array-push', 'array-delete', 'array-splice']) and
            (!array_key_exists('value', $editObj) or !isset($editObj['value']))
        )
            throw new HTTPException("A value is required for operation $operation", 400);
        else if (array_key_exists('value', $editObj))
            $value = $editObj['value'];

        // field not needed for set or push operation (can create fields)
        // missing field in remove doesn't matter since it's gone either way
        if (
            !isset($obj['content'][$id][$field]) and
            ($operation != 'set' and $operation != 'remove' and $operation != 'array-push')
        )
            throw new HTTPException("Field $field doesn't exist in ID $id", 400);

        switch ($operation) {
            case 'set':
                $obj['content'][$id][$field] = $value;
                return true;
            case 'remove':
                unset($obj['content'][$id][$field]);
                return true;
            case 'append':
                // check type string
                if (gettype($obj['content'][$id][$field]) != 'string' or gettype($value) != 'string')
                    throw new HTTPException('append requires string values', 400);

                $obj['content'][$id][$field] .= $value;
                return true;
            case 'invert':
                // check type boolean
                if (gettype($obj['content'][$id][$field]) != 'boolean')
                    throw new HTTPException('invert field must be a boolean', 400);

                $obj['content'][$id][$field] = !$obj['content'][$id][$field];
                return true;
            case 'increment':
            case 'decrement':
                // check type number
                if (!is_number_like($obj['content'][$id][$field]))
                    throw new HTTPException('increment and decrement fields must be numbers', 400);

                $change = $operation == 'increment' ? 1 : -1;

                // check if value
                if (isset($editObj['value'])) {
                    // error here
                    if (is_number_like($editObj['value']))
                        $change *= $editObj['value'];
                    // incorrect value provided, no operation done
                    else
                        throw new HTTPException('increment and decrement values must be numbers', 400);
                }

                $obj['content'][$id][$field] += $change;
                return true;
            case 'array-push':
                // create it if not here
                if (!isset($obj['content'][$id][$field]))
                    $obj['content'][$id][$field] = array();

                // check if our field array
                if (
                    gettype($obj['content'][$id][$field]) != 'array' ||
                    array_assoc($obj['content'][$id][$field])
                )
                    throw new HTTPException('array-push field must be an array', 400);

                array_push($obj['content'][$id][$field], $value);

                return true;

            case 'array-delete':
                // check if our field array
                if (
                    gettype($obj['content'][$id][$field]) != 'array' ||
                    array_assoc($obj['content'][$id][$field])
                )
                    throw new HTTPException('array-delete field must be an array', 400);

                // value must be integer
                if (gettype($value) != 'integer')
                    throw new HTTPException('array-delete value must be a number', 400);

                array_splice($obj['content'][$id][$field], $value, 1);

                return true;
            case 'array-splice':
                if (array_assoc($obj['content'][$id][$field]))
                    throw new HTTPException('array-splice field must be an array', 400);

                // value must be an array starting with two integers
                if (
                    array_assoc($value) or
                    count($value) < 2 or
                    gettype($value[0]) != 'integer' or
                    gettype($value[1]) != 'integer'
                )
                    throw new HTTPException('Incorrect array-splice options', 400);

                if (count($value) > 2)
                    array_splice($obj['content'][$id][$field], $value[0], $value[1], $value[2]);
                else
                    array_splice($obj['content'][$id][$field], $value[0], $value[1]);

                return true;
            default:
                break;
        }

        throw new HTTPException("Unknown operation $operation", 400);
    }

    public function editField($editObj) {
        $fileObj = $this->read(true);
        $this->_edit($fileObj, $editObj);
        $this->write($fileObj);
    }

    public function editFieldBulk($objArray) {
        // need sequential array
        if (array_assoc($objArray))
            return false;

        $fileObj = $this->read(true);
        foreach ($objArray as &$editObj) {
            // edit by reference, faster than passing values back and forth
            $this->_edit($fileObj, $editObj);
        }
        $this->write($fileObj);
    }

    public function select($selectObj) {
        if (!array_key_exists('fields', $selectObj))
            throw new HTTPException('Missing required fields field');

        if (!gettype($selectObj['fields']) === 'array' || !array_sequential($selectObj['fields']))
            throw new HTTPException('Incorrect fields type, expected an array');

        // all field arguments should be strings
        $fields = $selectObj['fields'];
        foreach ($fields as $field) {
            if (gettype($field) !== 'string')
                throw new HTTPException('fields field incorrect, expected a string array');
        }

        $obj = $this->read();

        $result = array();
        foreach ($obj['content'] as $key => $value) {
            $result[$key] = array();
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
        foreach ($obj['content'] as $value) {
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

    public function random($params) {
        return random($params, $this);
    }
}
