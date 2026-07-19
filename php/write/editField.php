<?php

require_once __DIR__ . '/../classes/HTTPException.php';
require_once __DIR__ . '/../utils.php';

// MANDATORY REFERENCE to edit directly: PHP 5+
function editField(&$content, $editObj): bool {
	// must be associative array
	$editObjType = gettype($editObj);
	if (is_primitive($editObj) || array_sequential($editObj))
		throw new HTTPException("Edit object has wrong type $editObjType, expected object", 400);

	// id required
	if (!array_key_exists('id', $editObj) || !check($editObj['id']))
		throw new HTTPException('Missing ID field', 400);

	$id = $editObj['id'];

	// id string or integer
	if (!is_keyable($id))
		throw new HTTPException('ID must be a string or number', 400);

	// object not found
	if (!array_key_exists($id, $content) || !check($content[$id]))
		throw new HTTPException('ID doesn\'t exist in collection', 400);

	// field required
	if (!array_key_exists('field', $editObj) || !check($editObj['field']))
		throw new HTTPException('Missing field field', 400);

	$field = $editObj['field'];

	// field is a string
	if (gettype($field) != 'string')
		throw new HTTPException('field must be a string', 400);

	// operation required
	if (!array_key_exists('operation', $editObj) || !check($editObj['operation']))
		throw new HTTPException('Missing operation field', 400);

	$operation = $editObj['operation'];

	$value = null;

	// return if operation has no value
	// set, append, array-push, array-delete, array-splice
	if (
		in_array($operation, ['set', 'append', 'array-push', 'array-delete', 'array-splice']) and
		(!array_key_exists('value', $editObj) or !isset($editObj['value']))
	)
		throw new HTTPException("A value is required for operation $operation", 400);
	else if (array_key_exists('value', $editObj))
		$value = $editObj['value'];

	// field not needed for set or push operation (can create fields)
	// missing field in remove doesn't matter since it's gone either way
	if (
		!isset($content[$id][$field]) and
		($operation != 'set' and $operation != 'remove' and $operation != 'array-push')
	)
		throw new HTTPException("Field $field doesn't exist in ID $id", 400);

	switch ($operation) {
		case 'set':
			$content[$id][$field] = $value;
			return true;
		case 'remove':
			unset($content[$id][$field]);
			return true;
		case 'append':
			// check type string
			if (gettype($content[$id][$field]) != 'string' or gettype($value) != 'string')
				throw new HTTPException('append requires string values', 400);

			$content[$id][$field] .= $value;
			return true;
		case 'invert':
			// check type boolean
			if (gettype($content[$id][$field]) != 'boolean')
				throw new HTTPException('invert field must be a boolean', 400);

			$content[$id][$field] = !$content[$id][$field];
			return true;
		case 'increment':
		case 'decrement':
			// check type number
			if (!is_number_like($content[$id][$field]))
				throw new HTTPException('increment and decrement fields must be numbers', 400);

			$change = $operation == 'increment' ? 1 : -1;

			// check if value
			if (isset($editObj['value'])) {
				// error here
				if (is_number_like($editObj['value']))
					$change *= $editObj['value'];
				// incorrect value provided, no operation done
				else
					throw new HTTPException('increment and decrement values must be numbers', 400);
			}

			$content[$id][$field] += $change;
			return true;
		case 'array-push':
			// create it if not here
			if (!isset($content[$id][$field]))
				$content[$id][$field] = [];

			// check if our field array
			if (
				gettype($content[$id][$field]) != 'array' ||
				array_assoc($content[$id][$field])
			)
				throw new HTTPException('array-push field must be an array', 400);

			array_push($content[$id][$field], $value);

			return true;

		case 'array-delete':
			// check if our field array
			if (
				gettype($content[$id][$field]) != 'array' ||
				array_assoc($content[$id][$field])
			)
				throw new HTTPException('array-delete field must be an array', 400);

			// value must be integer
			if (gettype($value) != 'integer')
				throw new HTTPException('array-delete value must be a number', 400);

			array_splice($content[$id][$field], $value, 1);

			return true;
		case 'array-splice':
			if (array_assoc($content[$id][$field]))
				throw new HTTPException('array-splice field must be an array', 400);

			// value must be an array starting with two integers
			if (
				array_assoc($value) or
				count($value) < 2 or
				gettype($value[0]) != 'integer' or
				gettype($value[1]) != 'integer'
			)
				throw new HTTPException('Incorrect array-splice options', 400);

			if (count($value) > 2)
				array_splice($content[$id][$field], $value[0], $value[1], $value[2]);
			else
				array_splice($content[$id][$field], $value[0], $value[1]);

			return true;
		default:
			break;
	}

	throw new HTTPException("Unknown operation $operation", 400);
}
