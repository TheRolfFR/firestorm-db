<?php

require_once './classes/HTTPException.php';

function array_contains($array, $value, $ignoreCase = false) {
    for ($tmp_i = 0; $tmp_i < count($array); ++$tmp_i) {
        $contains = $ignoreCase
            ? strcasecmp($array[$tmp_i], $value) === 0
            : $array[$tmp_i] == $value;
        if ($contains)
            return true;
    }
    return false;
}

function array_contains_any($concernedField, $value, $ignoreCase = false) {
    if (gettype($value) !== 'array')
        throw new HTTPException("Comparison array is not an array");

    for ($val_i = 0; $val_i < count($value); ++$val_i) {
        for ($cf_i = 0; $cf_i < count($concernedField); ++$cf_i) {
            $contains = $ignoreCase
                ? strcasecmp($concernedField[$cf_i], $value[$val_i]) === 0
                : $concernedField[$cf_i] == $value[$val_i];
            if ($contains)
                return true;
        }
    }
    return false;
}

function array_contains_all($concernedField, $value, $ignoreCase = false) {
    if (gettype($value) !== 'array')
        throw new HTTPException("Comparison array is not an array");

    $diff = $ignoreCase
        ? array_udiff($value, $concernedField, 'strcasecmp')
        : array_diff($concernedField, $value);

    // if there's no array diff one must be a superset of the other
    return count($diff) === 0;
}
