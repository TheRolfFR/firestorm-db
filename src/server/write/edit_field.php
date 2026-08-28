<?php

require_once __DIR__ . '/../classes/HTTPException.php';
require_once __DIR__ . '/../utils.php';
require_once __DIR__ . '/../enums/EditOperation.php';

/**
 * Mutates one field of an existing collection entry in place after validating the requested operation and operands.
 * The reference avoids copying the full collection before the caller persists its locked FileObject.
 * @param array<int|string, mixed> $content Collection or document content array to mutate.
 * @param mixed $editObj Specification object containing field, operation, and optional id/value.
 */
function edit_field(array &$content, mixed $editObj): bool {
	// must be associative array
	$editObjType = gettype($editObj);
	if (is_primitive($editObj) || array_sequential($editObj) || !is_array($editObj))
		throw new HTTPException("Edit object has wrong type $editObjType, expected object", 400);

	$hasId = array_key_exists('id', $editObj) && $editObj['id'] !== null && $editObj['id'] !== '';

	if ($hasId) {
		$id = $editObj['id'];

		// id string or integer
		if (!is_keyable($id))
			throw new HTTPException('ID must be a string or number', 400);

		// object not found
		if (!array_key_exists($id, $content) || !check($content[$id]))
			throw new HTTPException('ID doesn\'t exist in collection', 400);

		$target = &$content[$id];
	} else {
		$target = &$content;
	}

	// field required
	if (!array_key_exists('field', $editObj) || !check($editObj['field']))
		throw new HTTPException('Missing field field', 400);

	$field = $editObj['field'];

	// field is a string
	if (!is_string($field))
		throw new HTTPException('field must be a string', 400);

	// operation required
	if (!array_key_exists('operation', $editObj) || !check($editObj['operation']))
		throw new HTTPException('Missing operation field', 400);

	$operation = $editObj['operation'];

	$value = null;

	// return if operation has no value
	// set, append, array-push, array-delete, array-splice
	if (
		in_array($operation, ['set', 'append', 'array-push', 'array-delete', 'array-splice'], true) &&
		(!array_key_exists('value', $editObj) || !isset($editObj['value']))
	)
		throw new HTTPException("A value is required for operation $operation", 400);
	else if (array_key_exists('value', $editObj))
		$value = $editObj['value'];

	$segments = explode('.', $field);
	$curr = &$target;
	for ($i = 0; $i < count($segments) - 1; $i++) {
		$seg = $segments[$i];
		if (!isset($curr[$seg]) || !is_array($curr[$seg])) {
			if ($operation === 'set' || $operation === 'array-push') {
				$curr[$seg] = [];
			} else {
				$msg = $hasId ? "Field $field doesn't exist in ID {$editObj['id']}" : "Field $field doesn't exist in document";
				throw new HTTPException($msg, 400);
			}
		}
		$curr = &$curr[$seg];
	}
	$targetRef = &$curr;
	$finalKey = $segments[count($segments) - 1];

	// field not needed for set or push operation (can create fields)
	// missing field in remove doesn't matter since it's gone either way
	if (
		!isset($targetRef[$finalKey]) &&
		($operation !== 'set' && $operation !== 'remove' && $operation !== 'array-push')
	) {
		$msg = $hasId ? "Field $field doesn't exist in ID {$editObj['id']}" : "Field $field doesn't exist in document";
		throw new HTTPException($msg, 400);
	}

	switch ($operation) {
		case 'set':
			$targetRef[$finalKey] = $value;
			return true;
		case 'remove':
			unset($targetRef[$finalKey]);
			return true;
		case 'append':
			// check type string
			if (!is_string($targetRef[$finalKey]) || !is_string($value))
				throw new HTTPException('append requires string values', 400);

			$targetRef[$finalKey] .= $value;
			return true;
		case 'invert':
			// check type boolean
			if (!is_bool($targetRef[$finalKey]))
				throw new HTTPException('invert field must be a boolean', 400);

			$targetRef[$finalKey] = !$targetRef[$finalKey];
			return true;
		case 'increment':
		case 'decrement':
			// check type number
			if (!is_number_like($targetRef[$finalKey]))
				throw new HTTPException('increment and decrement fields must be numbers', 400);

			$change = $operation === 'increment' ? 1 : -1;

			// check if value
			if (isset($editObj['value'])) {
				if (is_number_like($editObj['value']))
					$change *= $editObj['value'];
				else
					throw new HTTPException('increment and decrement values must be numbers', 400);
			}

			$targetRef[$finalKey] += $change;
			return true;
		case 'array-push':
			// create it if not here
			if (!isset($targetRef[$finalKey]))
				$targetRef[$finalKey] = [];

			// check if our field array
			if (!is_array($targetRef[$finalKey]) || array_assoc($targetRef[$finalKey]))
				throw new HTTPException('array-push field must be an array', 400);

			$targetRef[$finalKey][] = $value;
			return true;

		case 'array-delete':
			// check if our field array
			if (!is_array($targetRef[$finalKey]) || array_assoc($targetRef[$finalKey]))
				throw new HTTPException('array-delete field must be an array', 400);

			// value must be integer
			if (!is_int($value))
				throw new HTTPException('array-delete value must be a number', 400);

			array_splice($targetRef[$finalKey], $value, 1);
			return true;

		case 'array-splice':
			if (array_assoc($targetRef[$finalKey]))
				throw new HTTPException('array-splice field must be an array', 400);

			// value must be an array starting with two integers
			if (
				!is_array($value) ||
				array_assoc($value) ||
				count($value) < 2 ||
				!is_int($value[0]) ||
				!is_int($value[1])
			)
				throw new HTTPException('Incorrect array-splice options', 400);

			if (count($value) > 2)
				array_splice($targetRef[$finalKey], $value[0], $value[1], $value[2]);
			else
				array_splice($targetRef[$finalKey], $value[0], $value[1]);

			return true;
		default:
			break;
	}

	throw new HTTPException("Unknown operation $operation", 400);
}
