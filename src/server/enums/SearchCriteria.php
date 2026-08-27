<?php

/**
 * Supported comparison criteria and operators for collection searches.
 */
enum SearchCriteria: string {
    case Equals = '==';
    case NotEquals = '!=';
    case GreaterThan = '>';
    case GreaterThanOrEqual = '>=';
    case LessThan = '<';
    case LessThanOrEqual = '<=';
    case In = 'in';
    case Includes = 'includes';
    case Contains = 'contains';
    case StartsWith = 'startsWith';
    case EndsWith = 'endsWith';
    case ArrayContains = 'array-contains';
    case ArrayContainsNone = 'array-contains-none';
    case ArrayContainsAny = 'array-contains-any';
    case ArrayContainsAll = 'array-contains-all';
    case ArrayLength = 'array-length';
    case ArrayLengthEq = 'array-length-eq';
    case ArrayLengthDf = 'array-length-df';
    case ArrayLengthGt = 'array-length-gt';
    case ArrayLengthLt = 'array-length-lt';
    case ArrayLengthGe = 'array-length-ge';
    case ArrayLengthLe = 'array-length-le';
}
