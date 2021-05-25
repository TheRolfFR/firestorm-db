<?php

require_once('./utils.php');
require_once('./classes/FileAccess.php');

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
        if($content === '[]')
            $content = '{}';
        
        file_put_contents($this->fullPath(), $content, LOCK_EX);
    }
    
    private function write($obj) {
        $obj['content'] = json_encode($obj['content'], JSON_FORCE_OBJECT);
        FileAccess::write($obj);
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
        $key_var_type = gettype($key);
        if($key_var_type != 'string' and $key_var_type != 'double' and $key_var_type != 'integer')
            throw new Exception('Incorrect key');
        
        $key = strval($key);
        
        // else set it at the correspongding value
        $obj = $this->read(true);
        $obj['content'][$key] = json_decode(json_encode($value,  JSON_FORCE_OBJECT), true);
        
        $this->write($obj);
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
        $obj = $this->read(true);
        unset($obj['content'][$key]);
        $this->write($obj);
    }
    
    public function removeBulk($keys) {
        $obj = $this->read(true);
        
        // remove all keys
        $keys_decoded = json_decode($keys, true);
        foreach($keys_decoded as $key_decoded) {
            unset($obj['content'][$key_decoded]);
        }
        
        $this->write($obj);
    }
    
    public function search($conditions) {
        $obj = $this->read();
        
        $res = [];
        
        foreach(array_keys($obj['content']) as $key) {
            $el = $obj['content'][$key];
            
            $add = true;
            
            $condition_index = 0;
            while($condition_index < count($conditions) and $add) {
                // get condition
                $condition = $conditions[$condition_index];
                
                // get condition fields extracted
                $field = $condition['field'];
                
                if(array_key_exists($field, $el)) {
                    $criteria = $condition['criteria'];
                    $value = $condition['value'];
                    
                    // get field to compare
                    $concernedField = $el[$field];
                    
                    // get concerned field type
                    $fieldType = gettype($concernedField);
                    
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
                            switch($criteria) {
                                case '!=':
                                    $add = strcmp($concernedField, $value) != 0;
                                    break;
                                case '==':
                                    $add = strcmp($concernedField, $value) == 0;
                                    break;
                                case '>=':
                                    $add = strcmp($concernedField, $value) >= 0;
                                    break;
                                case '<=':
                                    $add = strcmp($concernedField, $value) <= 0;
                                    break;
                                case '<':
                                    $add = strcmp($concernedField, $value) < 0;
                                    break;
                                case '>':
                                    $add = strcmp($concernedField, $value) > 0;
                                    break;
                                case 'includes':
                                case 'contains':
                                    $add = strpos($concernedField, $value) !== false;
                                    break;
                                case 'startsWith':
                                    $add = strpos($concernedField, $value) === 0;
                                    break;
                                case 'endsWith':
                                    $add = strlen($value) ? substr($concernedField, -strlen($value)) === $value : false;
                                    break;
                                case 'in':
                                    $add = in_array($concernedField, $value);
                                    break;
                                default:
                                    $add = false;
                                    break;
                            }
                            break;
                        case 'array':
                            switch($criteria) {
                                case "array-contains":
                                    $add = in_array($value, $concernedField);
                                    break;
                                case "array-contains-any":
                                    if(gettype($value == 'array')) {
                                        $tmp = false;
                                        $tmp_i = 0;
                                        while($tmp_i < count($value) and !$tmp) {
                                            $tmp = in_array($value[$tmp_i], $concernedField);
                                            $tmp_i++;
                                        }
                                        $add = $tmp;
                                    } else {
                                        $add = false;
                                    }
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
            }
            
            if($add) {
                $res[$key] = $el;
            }
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
}

?>