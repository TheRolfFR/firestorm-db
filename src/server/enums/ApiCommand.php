<?php

/**
 * Supported read endpoint commands.
 */
enum ReadCommand: string {
    case ReadRaw = 'readRaw';
    case Get = 'get';
    case Search = 'search';
    case SearchKeys = 'searchKeys';
    case Select = 'select';
    case Random = 'random';
    case Sha1 = 'sha1';
    case Values = 'values';
}

/**
 * Supported write endpoint commands.
 */
enum WriteCommand: string {
    case WriteRaw = 'writeRaw';
    case Add = 'add';
    case AddBulk = 'addBulk';
    case Remove = 'remove';
    case RemoveBulk = 'removeBulk';
    case Set = 'set';
    case SetBulk = 'setBulk';
    case EditField = 'editField';
    case EditFieldBulk = 'editFieldBulk';
}
