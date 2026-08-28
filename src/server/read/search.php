<?php

require_once __DIR__ . '/../classes/HTTPException.php';
require_once __DIR__ . '/../enums/SearchCriteria.php';
require_once __DIR__ . '/../polyfills/polyfills.php';

/**
 * Evaluates one supported comparison against a stored field while applying case rules where relevant.
 *
 * @param mixed $field The stored field value in the collection item.
 * @param string $criteria Comparison operator or criteria name.
 * @param mixed $value The target operand value to compare against.
 * @param bool $ignoreCase Whether string comparisons should be case-insensitive.
 * @return bool True if the field satisfies the search criteria, false otherwise.
 */
function search(mixed $field, string $criteria, mixed $value, bool $ignoreCase): bool {
    $fieldType = gettype($field);

    return match ($fieldType) {
        'boolean' => match ($criteria) {
            '!=' => $field != $value,
            '==' => $field == $value,
            default => false,
        },
        'integer', 'double' => match ($criteria) {
            '!=' => $field != $value,
            '==' => $field == $value,
            '>=' => $field >= $value,
            '<=' => $field <= $value,
            '<' => $field < $value,
            '>' => $field > $value,
            'in' => is_array($value) && in_array($field, $value, true),
            default => false,
        },
        'string' => (function() use ($field, $criteria, $value, $ignoreCase): bool {
            $cmpFunc = $ignoreCase ? strcasecmp(...) : strcmp(...);
            $posFunc = $ignoreCase ? stripos(...) : strpos(...);

            return match ($criteria) {
                '!=' => $cmpFunc($field, $value) !== 0,
                '==' => $cmpFunc($field, $value) === 0,
                '>=' => $cmpFunc($field, $value) >= 0,
                '<=' => $cmpFunc($field, $value) <= 0,
                '<' => $cmpFunc($field, $value) < 0,
                '>' => $cmpFunc($field, $value) > 0,
                'includes', 'contains' => $value !== '' ? ($posFunc($field, $value) !== false) : true,
                'startsWith' => $value !== '' ? ($posFunc($field, $value) === 0) : true,
                'endsWith' => $value !== '' ? ($cmpFunc(substr($field, -strlen($value)), $value) === 0) : true,
                'in' => is_array($value) && array_any($value, fn($val) => $cmpFunc($field, $val) === 0),
                default => false,
            };
        })(),
        'array' => match ($criteria) {
            'array-contains' => array_contains($field, $value, $ignoreCase),
            'array-contains-none' => !array_contains_any($field, $value, $ignoreCase),
            'array-contains-any' => array_contains_any($field, $value, $ignoreCase),
            'array-contains-all' => array_contains_all($field, $value, $ignoreCase),
            'array-length', 'array-length-eq' => count($field) == $value,
            'array-length-df' => count($field) != $value,
            'array-length-gt' => count($field) > $value,
            'array-length-lt' => count($field) < $value,
            'array-length-ge' => count($field) >= $value,
            'array-length-le' => count($field) <= $value,
            default => false,
        },
        default => false,
    };
}

/**
 * Tests whether a sequential field contains one requested value, using case-insensitive string matching when requested.
 *
 * @param array<mixed> $array
 * @param mixed $value
 * @param bool $ignoreCase
 * @return bool
 */
function array_contains(array $array, mixed $value, bool $ignoreCase = false): bool {
    return array_any($array, function($item) use ($value, $ignoreCase) {
        return $ignoreCase
            ? (is_string($item) && is_string($value) ? strcasecmp($item, $value) === 0 : $item == $value)
            : $item == $value;
    });
}

/**
 * Rejects malformed comparison data and reports whether any requested value occurs in the stored field.
 *
 * @param array<mixed> $concernedField
 * @param mixed $value
 * @param bool $ignoreCase
 * @return bool
 * @throws HTTPException
 */
function array_contains_any(array $concernedField, mixed $value, bool $ignoreCase = false): bool {
    if (!is_array($value))
        throw new HTTPException("Comparison array is not an array");

    return array_any($value, fn($val) => array_contains($concernedField, $val, $ignoreCase));
}

/**
 * Rejects malformed comparison data and reports whether every requested value occurs in the stored field.
 *
 * @param array<mixed> $concernedField
 * @param mixed $value
 * @param bool $ignoreCase
 * @return bool
 * @throws HTTPException
 */
function array_contains_all(array $concernedField, mixed $value, bool $ignoreCase = false): bool {
    if (!is_array($value))
        throw new HTTPException("Comparison array is not an array");

    return array_all($value, fn($val) => array_contains($concernedField, $val, $ignoreCase));
}

/**
 * Evaluates whether an element matches all specified search conditions.
 *
 * @param mixed $el
 * @param array<int, array{field: string, criteria: mixed, value: mixed, ignoreCase?: bool}> $conditions
 * @return bool
 */
function matches_search_conditions(mixed $el, array $conditions): bool {
    $el_root = $el;

    foreach ($conditions as $condition) {
        $field = $condition['field'];
        $field_path = explode('.', $field);

        for ($field_ind = 0; $el !== null && $field_ind + 1 < count($field_path); ++$field_ind) {
            if (!is_array($el) || !array_key_exists($field_path[$field_ind], $el))
                return false;

            $el = $el[$field_path[$field_ind]];
            $field = $field_path[$field_ind + 1];
        }

        if (
            $el === null ||
            !is_array($el) ||
            !array_key_exists($field, $el) ||
            !array_key_exists('criteria', $condition) ||
            !array_key_exists('value', $condition)
        ) {
            return false;
        }

        $ignoreCase = !empty($condition['ignoreCase']);
        if (!search(
            $el[$field],
            (string) $condition['criteria'],
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
function filter_search_conditions(array $content, array $conditions, bool $has_limit = false, int|false $limit = false, mixed $random = false): array {
    $res = array_filter($content, fn($el) => matches_search_conditions($el, $conditions));

    if ($has_limit && $random === false && $limit !== false) {
        return array_slice($res, 0, $limit, true);
    }

    return $res;
}
