<?php

function array_contains($array, $value, $ignoreCase = false) {
    $tmp = false;
    $tmp_i = 0;
    while ($tmp_i < count($array) and !$tmp) {
        if ($ignoreCase) {
            $tmp = ($ignoreCase ? strcasecmp($array[$tmp_i], $value)  : strcmp($array[$tmp_i], $value)) == 0;
        } else {
            $tmp = $array[$tmp_i] == $value;
        }
        $tmp_i = $tmp_i + 1;
    }
    return $tmp;
}

function array_contains_any($concernedField, $value, $ignoreCase = false) {
    $add = false;

    if (gettype($value) === 'array') {
        $tmp = false;
        $val_i = 0;
        while ($val_i < count($value) and !$tmp) {
            $cf_i = 0;
            while ($cf_i < count($concernedField) && !$tmp) {
                if ($ignoreCase) {
                    $tmp = ($ignoreCase ? strcasecmp($concernedField[$cf_i], $value[$val_i]) : strcmp($concernedField[$cf_i], $value[$val_i])) === 0;
                } else {
                    $tmp = $concernedField[$cf_i] == $value[$val_i];
                }
                $cf_i = $cf_i + 1;
            }
            $val_i = $val_i + 1;
        }

        $add = $tmp;
    } else {
        $add = false;
    }

    return $add;
}
