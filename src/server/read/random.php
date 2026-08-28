<?php

use Random\Randomizer;
use Random\Engine\Mt19937;

/** Generates a time-derived seed for callers that need a non-repeatable selection order. */
function make_seed(): int {
    [$usec, $sec] = explode(' ', microtime());
    return (int) ($sec . substr((string) intval((float) $usec * 1000000), 0, 6));
}

/**
 * Returns a globally shared Randomizer instance to avoid repeated instantiation overhead.
 */
function global_randomizer(): Randomizer {
    static $randomizer = null;
    if ($randomizer === null) {
        $randomizer = new Randomizer();
    }
    return $randomizer;
}

/**
 * Selects distinct entries by key, with optional deterministic ordering, limit, and skipped selections.
 *
 * @param array<mixed> $json
 * @param int|false $seed
 * @param int $max
 * @param int $offset
 * @return array<mixed>
 */
function choose_random(array $json, int|false $seed = false, int $max = -1, int $offset = 0): array {
    $keys = array_keys($json);
    $keys_length = count($keys);

    // return an empty array, can't get more elements
    if ($offset >= $keys_length) return [];

    if ($max === -1 || $max > $keys_length) $max = $keys_length;

    $randomizer = $seed !== false ? new Randomizer(new Mt19937($seed)) : global_randomizer();

    // splice keys before the offset
    for ($i = 0; $i < $offset; ++$i) {
        $index = $randomizer->getInt(0, count($keys) - 1);
        array_splice($keys, $index, 1);
    }

    // pick up to $max keys
    $keys_selected = [];
    for ($i = 0; count($keys) > 0 && $i < $max; ++$i) {
        $index = $randomizer->getInt(0, count($keys) - 1);
        $spliced = array_splice($keys, $index, 1);
        $keys_selected[] = $spliced[0];
    }

    // get objects from keys selected
    $result = [];
    foreach ($keys_selected as $k) {
        $key = strval($k);
        $result[$key] = $json[$key];
    }

    return $result;
}
