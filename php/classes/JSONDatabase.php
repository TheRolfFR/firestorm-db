<?php

require_once('./utils.php');
require_once('./classes/FileAccess.php');
require_once('./classes/HTTPException.php');
require_once(__DIR__.'/read/random.php');
require_once(__DIR__.'/read/searchArray.php');

class JSONDatabase {
    public $folderPath = './files/';
    public $fileName = 'db';
    public $fileExt = '.json';

    public $default = array();

    public $autoKey = true;
    public $autoIncrement = true;

    public function fullPath() {
        return $this->folderPath . $this->fileName . $this->fileExt;
    }

    public function write_raw($content) {
        $content_type = gettype($content);
        $incorrect_types = array('integer', 'double', 'string', 'boolean');

        // content must not be primitive
        if(in_array($content_type, $incorrect_types)) {
            throw new HTTPException('write_raw value must not be a ' . $content_type, 400);
            return 400;
        }

        // value must not be a sequential array with values inside [1, 2, 3]
        // we accept sequential arrays but with objects not primitives
        if(is_array($content) and !array_assoc($content)) {
            foreach($content as $item) {
                $item_type = gettype($item);
                if(in_array($item_type, $incorrect_types)) {
                    throw new HTTPException('write_raw item must not be a ' . $item_type, 400);
                    return 400;
                }
            }
        }

        // now we know we have an associative array

        // content must be objects
        foreach ($content as $key => $item) {
            // item must not be primitive

            // we don't accept primitive keys as value
            $item_type = gettype($item);
            if(in_array($item_type, $incorrect_types)) {
                throw new HTTPException('write_raw item with key' . $key . ' item must not be a ' . $item_type, 400);
                return 400;
            }

            // we accept associative array as items because they may have an integer key
        }

        $content = stringifier($content);

        // fix empty raw content
        //be cause php parses {} as array(0)
        if($content === '[]')
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
        return FileAccess::read($this->fullPath(), $waitLock, json_encode($this->default));
    }

    public function read($waitLock = false) {
        $res = $this->read_raw($waitLock);
        $res['content'] = json_decode($res['content'], true);

        return $res;
    }

    public function get($key) {
        $obj = $this->read();
        if(!$obj || array_key_exists('content', $obj) == false || array_key_exists(strval($key), $obj['content']) == false)
            return null;

        $res = array($key => $obj['content'][$key]);
        return $res;
    }

    public function set($key, $value) {
        if($key === null or $value === null) { /// === fixes the empty array == comparaison
            throw new HTTPException("Key or value are null", 400);
        }

        $key_var_type = gettype($key);
        if($key_var_type != 'string' and $key_var_type != 'integer')
            throw new HTTPException('Incorrect key', 400);

        $value_var_type = gettype($value);
        if($value_var_type == 'double' or $value_var_type == 'integer' or $value_var_type == 'string')
            throw new HTTPException('Invalid value type, got ' . $value_var_type . ', expected object', 400);

        if($value !== array() and !array_assoc($value))
            throw new HTTPException('Value cannot be a sequential array', 400);

        $key = strval($key);

        // else set it at the corresponding value
        $obj = $this->read(true);
        $obj['content'][$key] = json_decode(json_encode($value), true);
        return $this->write($obj);
    }

    public function setBulk($keys, $values) {
        // we verify that our keys are in an array
        $key_var_type = gettype($keys);
        if($key_var_type != 'array')
            throw new Exception('Incorect keys type');

        // else set it at the corresponding value
        $obj = $this->read(true);

        // decode and add all values
        $value_decoded = json_decode(json_encode($values), true);
        $keys_decoded = json_decode(json_encode($keys), true);
        for($i = 0; $i < count($value_decoded); $i++) {

            $key_var_type = gettype($keys_decoded[$i]);
            if($key_var_type != 'string' and $key_var_type != 'double' and $key_var_type != 'integer')
                throw new Exception('Incorrect key');

            $key = strval($keys_decoded[$i]);

            $obj['content'][$key] = $value_decoded[$i];
        }

        $this->write($obj);
    }

    private function newLastKey($arr) {
        if($this->autoIncrement) {
            $int_keys = array_filter(array_keys($arr), "is_int");
            sort($int_keys);
            $last_key = count($int_keys) > 0 ? $int_keys[count($int_keys) - 1] + 1 : 0;
        } else {
            $last_key = uniqid();
            while(array_key_exists($last_key, $arr)) {
                $last_key = uniqid();
            }
        }

        return strval($last_key);
    }

    public function add($value) {
        // restricts types to objects only
        $value_type = gettype($value);
        if($value_type == 'NULL' or $value_type == 'boolean' or $value_type == 'integer' or $value_type == 'double' or $value_type == 'string' or (is_array($value) and count($value) and !array_assoc($value)))
            throw new HTTPException('add value must be an object not a ' . $value_type, 400);

        if($this->autoKey == false)
            throw new Exception('Autokey disabled');

        // else set it at the corresponding value
        $obj = $this->read(true);

        $id = $this->newLastKey($obj['content']);
        $obj['content'][$id] = $value;

        $this->write($obj);

        return $id;
    }

    public function addBulk($values) {
        if($values !== array() and $values == NULL)
            throw new HTTPException('null-like value not accepted', 400);

        // restricts types to non base variables
        $value_type = gettype($values);
        if($value_type == 'NULL' or $value_type == 'boolean' or $value_type == 'integer' or $value_type == 'double' or $value_type == 'string' or (is_array($values) and count($values) and array_assoc($values)))
            throw new HTTPException('value must be an array not a ' . $value_type, 400);

        // so here we have a sequential array type
        // now the values inside this array must not be base values
        foreach($values as $value) {
            $value_type = gettype($value);
            if($value_type == 'NULL' or $value_type == 'boolean' or $value_type == 'integer' or $value_type == 'double' or $value_type == 'string' or (is_array($value) and count($value) and !array_assoc($value)))
                throw new HTTPException('array value must be an object not a ' . $value_type, 400);
        }

        if($this->autoKey == false)
            throw new Exception('Autokey disabled');

        // veriify that values is an array with number indices
        if(array_assoc($values))
            throw new Exception('Wanted sequential array');

        // else set it at the correspongding value
        $obj = $this->read(true);

        // decode and add all values
        $values_decoded = $values;
        $id_array = array();
        foreach($values_decoded as $value_decoded) {
            $id = $this->newLastKey($obj['content']);

            $obj['content'][$id] = $value_decoded;

            array_push($id_array, $id);
        }

        $this->write($obj);

        return $id_array;
    }

    public function remove($key) {
        if(gettype($key) != 'string')
            throw new HTTPException("remove value must be a string", 400);

        $obj = $this->read(true);
        unset($obj['content'][$key]);
        $this->write($obj);
    }

    public function removeBulk($keys) {
        if($keys !== array() and $keys == NULL)
            throw new HTTPException('null-like keys not accepted', 400);

        if(gettype($keys) !== 'array' or array_assoc($keys))
            throw new HTTPException('keys must be an array', 400);

        for($i = 0; $i < count($keys); $i++) {
            $key_var_type = gettype($keys[$i]);
            if($key_var_type != 'string' and $key_var_type != 'double' and $key_var_type != 'integer')
                throw new HTTPException('Incorrect key type', 400);
            else
                $keys[$i] = strval($keys[$i]);
        }

        $obj = $this->read(true);

        // remove all keys
        foreach($keys as $key_decoded) {
            unset($obj['content'][$key_decoded]);
        }

        $this->write($obj);
    }

    public function search($conditions, $random = false) {
        $obj = $this->read();

        $res = [];

        foreach(array_keys($obj['content']) as $key) {
            $el = $obj['content'][$key];
            $el_root = $el;

            $add = true;

            $condition_index = 0;
            while($condition_index < count($conditions) and $add) {
                // get condition
                $condition = $conditions[$condition_index];

                // get condition fields extracted
                $field = $condition['field'];
                $field_path = explode(".", $field);

                error_reporting(error_reporting() - E_NOTICE);
                $field_ind = 0;

                while($el != NULL && $field_ind + 1 < count($field_path)) {
                    $el = $el[$field_path[$field_ind]];
                    $field_ind = $field_ind + 1;
                    $field = $field_path[$field_ind];
                }
                error_reporting(error_reporting() + E_NOTICE);

                if($el != NULL && array_key_exists($field, $el) && array_key_exists('criteria', $condition) && array_key_exists('value', $condition)) {
                    $criteria = $condition['criteria'];
                    $value = $condition['value'];

                    // get field to compare
                    $concernedField = $el[$field];

                    // get concerned field type
                    $fieldType = gettype($concernedField);

                    if($criteria == 'array-contains' || $criteria == 'array-contains-any') {
                        $ignoreCase = array_key_exists('ignoreCase', $condition) && !!$condition['ignoreCase'];
                    }

                    switch($fieldType) {
                        case 'boolean':
                            switch($criteria) {
                                case '!=':
                                    $add = $concernedField != $value;
                                    break;
                                case '==':
                                    $add = $concernedField == $value;
                                    break;
                                default:
                                    $add = false;
                                    break;
                            }
                            break;
                        case 'integer':
                        case 'double':
                            switch($criteria) {
                                case '!=':
                                    $add = $concernedField != $value;
                                    break;
                                case '==':
                                    $add = $concernedField == $value;
                                    break;
                                case '>=':
                                    $add = $concernedField >= $value;
                                    break;
                                case '<=':
                                    $add = $concernedField <= $value;
                                    break;
                                case '<':
                                    $add = $concernedField < $value;
                                    break;
                                case '>':
                                    $add = $concernedField > $value;
                                    break;
                                case 'in':
                                    $add = in_array($concernedField, $value);
                                    break;
                                default:
                                    $add = false;
                                    break;
                            }
                            break;
                        case 'string':
                            $ignoreCase = array_key_exists('ignoreCase', $condition) && !!$condition['ignoreCase'];
                            switch($criteria) {
                                case '!=':
                                    $add = ($ignoreCase ? strcasecmp($concernedField, $value) : strcmp($concernedField, $value)) != 0;
                                    break;
                                case '==':
                                    $add = ($ignoreCase ? strcasecmp($concernedField, $value) : strcmp($concernedField, $value)) == 0;
                                    break;
                                case '>=':
                                    $add = ($ignoreCase ? strcasecmp($concernedField, $value) : strcmp($concernedField, $value)) >= 0;
                                    break;
                                case '<=':
                                    $add = ($ignoreCase ? strcasecmp($concernedField, $value) : strcmp($concernedField, $value)) <= 0;
                                    break;
                                case '<':
                                    $add = ($ignoreCase ? strcasecmp($concernedField, $value) : strcmp($concernedField, $value)) < 0;
                                    break;
                                case '>':
                                    $add = ($ignoreCase ? strcasecmp($concernedField, $value) : strcmp($concernedField, $value)) > 0;
                                    break;
                                case 'includes':
                                case 'contains':
                                    $add = $value != "" ? (($ignoreCase ? stripos($concernedField, $value) : strpos($concernedField, $value)) !== false) : true;
                                    break;
                                case 'startsWith':
                                    $add = $value != "" ? (($ignoreCase ? stripos($concernedField, $value) : strpos($concernedField, $value)) === 0) : true;
                                    break;
                                case 'endsWith':
                                    $end = substr($concernedField, -strlen($value));
                                    $add = $value != "" ? (($ignoreCase ? strcasecmp($end, $value) : strcmp($end, $value)) === 0) : true;
                                    break;
                                case 'in':
                                    $notfound = true;
                                    $a_i = 0;
                                    while($a_i < count($value) && $notfound) {
                                        $notfound = ($ignoreCase ? strcasecmp($concernedField, $value[$a_i])  : strcmp($concernedField, $value[$a_i])) != 0;
                                        $a_i++;
                                    }
                                    $add = !$notfound;
                                    break;
                                default:
                                    $add = false;
                                    break;
                            }
                            break;
                        case 'array':
                            switch($criteria) {
                                case "array-contains":
                                    $add = array_contains($concernedField, $value, $ignoreCase);
                                    break;
                                case "array-contains-any":
                                    $add = array_contains_any($concernedField, $value, $ignoreCase);
                                    break;
                                case "array-length":
                                case "array-length-eq":
                                    $add = count($concernedField) == $value;
                                    break;
                                case "array-length-df":
                                    $add = count($concernedField) != $value;
                                    break;
                                case "array-length-gt":
                                    $add = count($concernedField) > $value;
                                    break;
                                case "array-length-lt":
                                    $add = count($concernedField) < $value;
                                    break;
                                case "array-length-ge":
                                    $add = count($concernedField) >= $value;
                                    break;
                                case "array-length-le":
                                    $add = count($concernedField) <= $value;
                                    break;
                                default:
                                    $add = false;
                                    break;
                            }
                        default:
                            break;
                    }
                } else {
                    $add = false;
                }

                $condition_index++;
                $el = $el_root;
            }

            if($add) {
                $res[$key] = $el_root;
            }
        }

        if($random !== false) {
            $seed = false;
            if(is_array($random) && array_key_exists('seed', $random)) {
                $rawSeed = sec($random['seed']);
                if(!is_int($rawSeed)) throw new HTTPException("Seed not an integer value for random search result");
                $seed = intval($rawSeed);
            }
            $res = chooseRandom($res, $seed);
        }

        return $res;
    }

    public function searchKeys($searchedKeys) {
        $obj = $this->read();

        $res = array();
        if(gettype($searchedKeys) != 'array')
            return $res;

        foreach($searchedKeys as $key) {
            $key = strval($key);

            if(array_key_exists($key, $obj['content'])) {
                $res[$key] = $el = $obj['content'][$key];
            }
        }

        return $res;
    }

    public function editField($editObj) {
        return $this->editFieldBulk(array($editObj))[0];
    }

    // MANDATORY REFERENCE to edit directly: PHP 5+
    private function __edit(&$obj, $editObj) {

        if(!is_object($editObj))
            return false;

        // id required
        if(!check($editObj['id']))
            return false;

        $id = $editObj['id'];

        // id string or integer
        if(gettype($id) != 'string' and gettype($id) != 'integer')
            return false;

        // object not found
        if(!array_key_exists($id, $obj['content']) || !check($obj['content'][$id]))
            return false;

        // field required
        if(!check($editObj['field']))
            return false;

        $field = $editObj['field'];

        // field is a string
        if(gettype($field) != 'string')
            return false;

        // operation required
        if(!check($editObj['operation']))
            return false;

        $operation = $editObj['operation'];

        $value = null;
        // return if operation has no value
        // set, append, array-push, array-delete, array-slice
        if(in_array($operation, ['set', 'append', 'array-push', 'array-delete', 'array-slice']) and !isset($editObj['value']))
            return false;
        else
            $value = $editObj['value'];

        // field not found for other than set or push operation
        // for the remove operation it is still a success because at the end the field doesn't exist
        if(!isset($obj['content'][$id][$field]) and ($operation != 'set' and $operation != 'remove' and $operation != 'array-push'))
            return false;

        switch($operation) {
            case 'set':
                $obj['content'][$id][$field] = $value;
                return true;
            case 'remove':
                unset($obj['content'][$id][$field]);
                return true;
            case 'append':
                // check type string
                if(gettype($obj['content'][$id][$field]) != 'string' or gettype($value) != 'string')
                    return false;

                $obj['content'][$id][$field] .= $value;
                return true;
            case 'invert':
                // check type boolean
                if(gettype($obj['content'][$id][$field]) != 'boolean')
                    return false;

                $obj['content'][$id][$field] = !$obj['content'][$id][$field];
                return true;
            case 'increment':
            case 'decrement':
                // check type number
                if(gettype($obj['content'][$id][$field]) != 'integer' and gettype($obj['content'][$id][$field]) != 'double')
                    return false;

                $change = $operation == 'increment' ? +1 : -1;

                // check if value
                if(isset($editObj['value'])) {
                    if(gettype($editObj['value']) == 'integer' or gettype($editObj['value']) == 'double') { // error here
                        $change *= $editObj['value'];
                    } else {
                        // incorrect value provided, no operation done
                        return false;
                    }
                }

                $obj['content'][$id][$field] += $change;
                return true;
            case 'array-push':
                // create it if not here
                if(!isset($obj['content'][$id][$field]))
                    $obj['content'][$id][$field] = array();

                // check if our field array
                if(gettype($obj['content'][$id][$field]) != 'array')
                    return false;

                // our field must be a sequential array
                if(array_assoc($obj['content'][$id][$field]))
                    return false;

                array_push($obj['content'][$id][$field], $value);

                return true;

            case 'array-delete':
                // check if our field array
                if(gettype($obj['content'][$id][$field]) != 'array')
                    return false;

                // our field must be a sequential array
                if(array_assoc($obj['content'][$id][$field]))
                    return false;

                // value must be integer
                if(gettype($value) != 'integer')
                    return false;

                array_splice($obj['content'][$id][$field], $value, 1);

                return true;
            case 'array-splice':
                if(array_assoc($obj['content'][$id][$field]))
                    return false;

                // value must be an array or to integers
                if(array_assoc($value) or count($value) != 2 or gettype($value[0]) != 'integer' or gettype($value[1]) != 'integer')
                    return false;

                array_splice($obj['content'][$id][$field], $value[0], $value[1]);

                return true;
            default:
                break;
        }

        return false;
    }

    public function editFieldBulk($objArray) {
        // need sequential array
        if(array_assoc($objArray))
            return false;

        $arrayResult = array();

        $fileObj = $this->read($this);

        foreach($objArray as &$editObj) {
            array_push($arrayResult, $this->__edit($fileObj, $editObj));
        }

        $this->write($fileObj);

        return $arrayResult;
    }

    public function select($selectObj) {
        // check fields presence
        // fields is required, a array of strings
        $verif_fields = array_key_exists('fields', $selectObj);
        if($verif_fields === false) throw new HTTPException('Missing required fields field');

        $verif_fields = gettype($selectObj['fields']) === 'array' && array_sequential($selectObj['fields']);
        if($verif_fields === false) throw new HTTPException('Incorrect fields type, expected an array');

        $fields = $selectObj['fields'];
        $i = 0; $fields_count = count($fields);
        while($i < $fields_count && $verif_fields) {
            $verif_fields = gettype($fields[$i]) === 'string';
            ++$i;
        }
        if(!$verif_fields) throw new HTTPException('fields field incorrect, expected an array of string');

        $obj = $this->read();

        $json = $obj['content'];
        $result = array();
        foreach ($json as $key => $value) {
            $result[$key] = array();
            foreach ($fields as $field) {
                if(array_key_exists($field, $value)) $result[$key][$field] = $value[$field];
            }
        }

        return $result;
    }

    public function values($valueObj) {
        if (!array_key_exists('field', $valueObj))
            throw new HTTPException('Missing required field field');

        if(!is_string($valueObj['field']))
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

        $json = $obj['content'];
        $result = [];
        foreach ($json as $key => $value) {
            // get correct field and skip existing primitive values (faster)
            if (!array_key_exists($field, $value) || in_array($value, $result)) continue;

            // flatten array results if array field
            if ($flatten === true && is_array($value[$field]))
                $result = array_merge($result, $value[$field]);
            else array_push($result, $value[$field]);
        }

        // remove complex duplicates
        $result = array_intersect_key($result, array_unique(array_map('serialize', $result)));

        return $result;
    }

    public function random($params) {
        return random($params, $this);
    }
}

?>