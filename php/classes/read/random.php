<?php

require_once(__DIR__.'/../HTTPException.php');

function make_seed() {
    list($usec, $sec) = explode(' ', microtime());
    return intval($sec + $usec * 1000000);
}

// can run with a maximum amount of random entries (if collection is smaller you cannot guarantied) (is optional, else it will be all the results)
function random($params, $class) {
    $hasMax = array_key_exists('max', $params);
    $max = $hasMax ? $params['max'] : -1;
    if ($hasMax && (gettype($max) !== 'integer' || $max < -1)) throw new HTTPException('Expected integer >= -1 for the max');

    $hasSeed = array_key_exists('seed', $params);
    $hasOffset = array_key_exists('offset', $params);

    // offset is relevant only if you get the key
    if ($hasOffset && !$hasSeed) throw new HTTPException('You can\'t put an offset without a seed');

    // offset verif
    $offset = $hasOffset ? $params['offset'] : 0;
    if ($hasOffset && (gettype($offset) !== 'integer' || $offset < 0)) throw new HTTPException('Expected integer >= 0 for the offset');

    // seed verif
    $seed = $hasSeed ? $params['seed'] : false;
    if ($hasSeed && gettype($seed) !== 'integer') throw new HTTPException('Expected integer for the seed');

    $json = $class->read()['content'];

    return chooseRandom($json, $seed, $max, $offset);
}

function chooseRandom($json, $seed = false, $max = -1, $offset = 0) {
    $keys = array_keys($json);
    $keys_selected = array();
    $keys_length = count($keys);

    if ($offset >= $keys_length) return array(); // return an empty array, there is no more elements you can get

    if ($max == -1 || $max > $keys_length) $max = $keys_length;

    // set random seed just before starting picking
    if ($seed !== false) mt_srand($seed);

    // the thing is that I need to splice keys from before the offset
    for ($i = 0; $i < $offset; ++$i) {
        $index = mt_rand(0, $keys_length - 1);
        array_splice($keys, $index, 1);

        // update keys length
        $keys_length = count($keys);
    }

    // then while I can get new entries
    // -> I still have keys
    // -> I am not at maximum
    $i = 0;
    while($keys_length > 0 && $i < $max) {
        // get an index
        $index = mt_rand(0, $keys_length - 1);

        // move element to keys selected
        $keys_selected = array_merge($keys_selected, array_splice($keys, $index, 1));

        // recompute keys left
        $keys_length = count($keys);

        // next thing
        ++$i;
    }

    // get objects from keys selected
    $result = array();
    for ($i = 0; $i < count($keys_selected); ++$i) {
        $key = strval($keys_selected[$i]);
        $result[$key] = $json[$key];
    }

    return $result;
}