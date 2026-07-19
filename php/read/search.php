<?php

require_once __DIR__ . '/../classes/HTTPException.php';

// returns whether the element matched the filter or not
function search($field, $criteria, $value, $ignoreCase): bool {
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
                case 'array-contains-all':
                    return array_contains_all($field, $value, $ignoreCase);
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
