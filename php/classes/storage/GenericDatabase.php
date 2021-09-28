<?php
require_once('../HTTPException.php');

abstract class GenericDatabase {

    private $path;

    function __construct($path) {
        $this->$path = $path;
    }
    
    public function init() {} // does nothing by default

    public function fullPath() { return $path; }
    abstract public function writeRaw($content);
    abstract public function readRaw();
    
    abstract public function get($key);
    abstract public function getBulk($keys);
    public function searchKeys($keys) { return $this->getBulk($keys); }

    abstract public function add($value);
    abstract public function set($key, $value);
    abstract public function setBulk($keys, $values);

    abstract public function remove($key);
    abstract public function removeBulk($keys);

    abstract public function select($options);
    abstract public function search($conditions);
    abstract public function random($options);

    abstract public function editField($fieldObj);
    abstract public function editFieldBulk($fieldObjArr);

    public function editObject($objOpt) { throw new HTTPException('Method not supported', 405); }
    public function editObjectBulk($objOptArr) { throw new HTTPException('Method not supported', 405); }
}