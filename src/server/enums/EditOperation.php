<?php

/**
 * Supported field mutation operations for editField and editFieldBulk.
 */
enum EditOperation: string {
    case Set = 'set';
    case Remove = 'remove';
    case Append = 'append';
    case Invert = 'invert';
    case Increment = 'increment';
    case Decrement = 'decrement';
    case ArrayPush = 'array-push';
    case ArrayDelete = 'array-delete';
    case ArraySplice = 'array-splice';
}
