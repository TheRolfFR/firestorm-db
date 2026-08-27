<?php

require_once __DIR__ . '/../classes/HTTPException.php';

/**
 * Evaluates one supported comparison against a stored field while applying case rules where relevant.
 *
 * @param mixed $field The stored field value in the collection item.
 * @param string $criteria Comparison operator or criteria name.
 * @param mixed $value The target operand value to compare against.
 * @param bool $ignoreCase Whether string comparisons should be case-insensitive.
 * @return bool True if the field satisfies the search criteria, false otherwise.
 */
function search($field, string $criteria, $value, bool $ignoreCase): bool {
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
                    return is_array($value) && in_array($field, $value);
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

/**
 * Tests whether a sequential field contains one requested value, using case-insensitive string matching when requested.
 *
 * @param array<mixed> $array
 * @param mixed $value
 */
function array_contains(array $array, $value, bool $ignoreCase = false): bool {
    for ($tmp_i = 0; $tmp_i < count($array); ++$tmp_i) {
        $contains = $ignoreCase
            ? strcasecmp($array[$tmp_i], $value) === 0
            : $array[$tmp_i] == $value;
        if ($contains)
            return true;
    }
    return false;
}

/**
 * Rejects malformed comparison data and reports whether any requested value occurs in the stored field.
 *
 * @param array<mixed> $concernedField
 * @param mixed $value
 */
function array_contains_any(array $concernedField, $value, bool $ignoreCase = false): bool {
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

/**
 * Rejects malformed comparison data and reports whether every requested value occurs in the stored field.
 *
 * @param array<mixed> $concernedField
 * @param mixed $value
 */
function array_contains_all(array $concernedField, $value, bool $ignoreCase = false): bool {
    if (gettype($value) !== 'array')
        throw new HTTPException("Comparison array is not an array");

    $diff = $ignoreCase
        ? array_udiff($value, $concernedField, 'strcasecmp')
        : array_diff($value, $concernedField);

    // if there's no array diff one must be a superset of the other
    return count($diff) === 0;
}

/**
 * Evaluates whether an element matches all specified search conditions.
 *
 * @param mixed $el
 * @param array<int, array{field: string, criteria: mixed, value: mixed, ignoreCase?: bool}> $conditions
 */
function matches_search_conditions($el, array $conditions): bool {
    $el_root = $el;

    foreach ($conditions as $condition) {
        $field = $condition['field'];
        $field_path = explode('.', $field);

        for ($field_ind = 0; $el != NULL && $field_ind + 1 < count($field_path); ++$field_ind) {
            if (!array_key_exists($field_path[$field_ind], $el))
                return false;

            $el = $el[$field_path[$field_ind]];
            $field = $field_path[$field_ind + 1];
        }

        if (
            $el == NULL ||
            !array_key_exists($field, $el) ||
            !array_key_exists('criteria', $condition) ||
            !array_key_exists('value', $condition)
        ) {
            return false;
        }

        $ignoreCase = array_key_exists('ignoreCase', $condition) && !!$condition['ignoreCase'];
        if (!search(
            $el[$field],
            $condition['criteria'],
            $condition['value'],
            $ignoreCase
        )) {
            return false;
        }

        $el = $el_root;
    }

    return true;
}

/**
 * Filters a collection array using search conditions, with optional limit early exit support.
 *
 * @param array<int|string, mixed> $content
 * @param array<int, array{field: string, criteria: mixed, value: mixed, ignoreCase?: bool}> $conditions
 * @param bool $has_limit
 * @param int|false $limit
 * @param mixed $random
 * @return array<int|string, mixed>
 */
function filter_search_conditions(array $content, array $conditions, bool $has_limit = false, $limit = false, $random = false): array {
    $res = [];
    foreach ($content as $key => $el) {
        if (matches_search_conditions($el, $conditions)) {
            $res[$key] = $el;

            // only stop early if results will not be ordered randomly
            if ($has_limit && $random === false && count($res) >= $limit)
                break;
        }
    }
    return $res;
}

