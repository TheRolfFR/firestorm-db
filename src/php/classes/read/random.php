<?php

function make_seed() {
    [$usec, $sec] = explode(' ', microtime());
    return intval($sec + $usec * 1000000);
}

function choose_random($json, $seed = false, $max = -1, $offset = 0) {
    $keys = array_keys($json);
    $keys_selected = [];
    $keys_length = count($keys);

    // return an empty array, can't get more elements
    if ($offset >= $keys_length) return [];

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
    for ($i = 0; $keys_length > 0 && $i < $max; ++$i) {
        // get an index
        $index = mt_rand(0, $keys_length - 1);

        // move element to keys selected
        $keys_selected = array_merge($keys_selected, array_splice($keys, $index, 1));

        // recompute keys left
        $keys_length = count($keys);
    }

    // get objects from keys selected
    $result = [];
    foreach ($keys_selected as $k) {
        $key = strval($k);
        $result[$key] = $json[$key];
    }

    return $result;
}
