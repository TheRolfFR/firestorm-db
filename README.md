<div align="center">
<img src="img/firestorm-128.png">

<h1>firestorm-db</h1>

<a href="https://www.npmjs.com/package/firestorm-db" targtet="_blank" ><img alt="npm" src="https://img.shields.io/npm/v/firestorm-db?color=cb0000&logo=npm&style=flat-square"> <img alt="npm bundle size" src="https://img.shields.io/bundlephobia/min/firestorm-db?label=NPM%20minified%20size&style=flat-square"> </a> <img alt="GitHub file size in bytes" src="https://img.shields.io/github/size/TheRolfFR/firestorm-db/index.js?color=43A047&label=Script%20size&logoColor=green&style=flat-square"><a href="https://github.com/TheRolfFR/firestorm-db/actions/workflows/testjs.yml"><img src="https://github.com/TheRolfFR/firestorm-db/actions/workflows/testjs.yml/badge.svg" alt="Tests" /></a>

</div>

*Self hosted Firestore-like database with API endpoints based on micro bulk operations*

## Installation

```
npm install --save firestorm-db
```

## JavaScript Part

The JavaScript [index.js](./index.js) file is Just an [axios](https://www.npmjs.com/package/axios) wrapper of the library.

## How to use it

First you need to configure the address of the API and your token if needed :

```js
require('dotenv').config() // add some env variables
const firestorm = require('firestorm-db')

// ex: 'http://example.com/path/to/firestorm/root/'
firestorm.address(process.env.FIRESTORM_URL)

// only necessary if you want to write or access private collections
// must match token stored in tokens.php file
firestorm.token(process.env.FIRESTORM_TOKEN)
```

Now you can use it to its full potential:

```js
const firestorm = require('firestorm-db')

// returns a Collection instance
const userCollection = firestorm.collection('users')

// all methods return promises
userCollection.read_raw()
.then(res => console.log(res))
.catch(err => console.error(err))
```

### Collection contructor

Collection takes 1 argument and one optional argument : 
- The name of the collection as a ``String``
- The method adder which allows to inject methods to the get methods results, which is a ``Function`` taking the element as an argument

```js
const firestorm = require('firestorm-db')

// returns a Collection instance
const userCollection = firestorm.collection('users', el => {
  el.hello = function() {
    console.log(`${el.name} says hello!`)
  }
})

// if you have a 'users' table with a printable field named name
const johnDoe = await userCollection.get(123456789)
// gives { name: "John Doe", hello: function}

johnDoe.hello() // prints out "John Doe says hello!"
```

Available methods for a collection:

### Read operations

| Name | Parameters | Description |
|--|--|--|
| read_raw() | none | Reads the entire collection |
| get(id) | id: ``String\|Name`` | Tries to get one element by its key |
| search(searchOptions, random) | searchOptions: ``SearchOption[]`` random?:`false|true|Number`| Searches collections and returns matching results |
| searchKeys(keys) | keys: ``String[] \| Number[]`` | Searches collections with given keys and returns matching results |
| select(selectOption) | selectOption: ``{ field: String[] }`` | Improved read_raw with field selection |
| random(max, seed, offset) | max?: ``Integer >= -1`` seed?: ``Integer`` offset?:``Integer >= 0`` | Reads random entries of collection |

Search method can take one or more options to filter entries in a collection. A search option studies a ``field`` with a ``criteria`` and compares it to a ``value``.

Not all criterias are available depending the field type. There a more options available than the firestore ``where`` command allowing you to get better and faster search results.

### All search options available

| Criteria | Types allowed | Description |
|--|--|--|
| ``'!='`` | Boolean, Number, String | Searches if the entry field's value is different from yours
| ``'=='`` | Boolean, Number, String | Searches if the entry field's value is equal to yours
| ``'>='`` | Number, String | Searches if the entry field's value is greater or equal than yours
| ``'<='`` | Number, String | Searches if the entry field's value is equal to than yours
| ``'>'`` | Number, String | Searches if the entry field's value is greater than yours
| ``'<'`` | Number, String | Searches if the entry field's value is lower than yours
| ``'in'`` | Number, String | Searches if the entry field's value is in the array of values you gave
| ``'includes'`` | String | Searches if the entry field's value includes your substring
| ``'startsWith'`` | String | Searches if the entry field's value starts with your substring
| ``'endsWith'`` | String | Searches if the entry field's value ends with your substring
| ``'array-contains'`` | Array | Searches if the entry field's array contains your value
| ``'array-contains-any'`` | Array | Searches if the entry field's array ends contains your one value of more inside your values array
| ``'array-length-eq'`` | Number | Searches if the entry field's array size is equal to your value
| ``'array-length-df'`` | Number | Searches if the entry field's array size is different from your value
| ``'array-length-lt'`` | Number | Searches if the entry field's array size is lower than your value
| ``'array-length-gt'`` | Number | Searches if the entry field's array size is lower greater than your value
| ``'array-length-le'`` | Number | Searches if the entry field's array size is lower or equal to your value
| ``'array-length-ge'`` | Number | Searches if the entry field's array size is greater or equal to your value

### Write operations

| Name | Parameters | Description |
|--|--|--|
| writes_raw() | none | Writes the entire collection **/!\\ Very dangerous /!\\** |
| add(value) | value: ``Object`` | Adds one element with autoKey into the collection |
| addBulk(values) | value: ``Object[]`` | Adds multiple elements with autoKey into the collection |
| remove(key) | key: ``String\|Name`` | Remove one element from the collection with the corresponding key |
| removeBulk(keys) | keys: ``String[]\|Name[]`` |  Remove multiple elements from the collection with the corresponding keys |
| set(key, value) | key: ``String\|Name``, value: ``Object`` | Sets one element with its key and value into the collection |
| setBulk(keys, values) | keys: ``String[]\|Name[]``, values: ``Object[]`` | Sets multiple elements with their corresponding keys and values into the collectionn |
| editField(obj) | obj: ``EditObject`` | Changes one field of a given element in a collection |
| editFieldBulk(objArray) | objArray: ``EditObject[]`` | Changes one field per element in a collection |

### Edit field operations

Edit objects have and ``id`` to get the wanted element, the ``field`` they want to edit, an ``operation``, with what to do to this field, and a possible ``value``. Here is a list of operations:

| Operation | Value required | Types allowed | Description |
|--|--|--|--|
|``set``| Yes | any | Sets a field to a given value |
|``remove``| No | any | Removes a field from the element |
|``append``| Yes | String | Appends string at the end of the string field |
|``invert``| No | any | Inverts tate of boolean field |
|``increment``| No | Number | Adds a number to the field, default is 1 |
|``decrement``| No | Number | Retrieves a number to the field, default is -1 |
|``array-push ``| Yes | any | Push an element to the end of an array field |
|``array-delete`` | Yes | Integer | Removes and element at a certain index in an array field, check [array_splice documentation](https://www.php.net/manual/function.array-splice) offset for more infos |
|``array-splice`` | Yes | [Integer, Integer] | Remvoes certains elements, check [array_splice documentation](https://www.php.net/manual/function.array-splice) offset and length for more infos |


<br>

## PHP files

The PHP files are the ones handling files, read and writes. It also handles GET and POST request to manipulate the database.

## PHP setup

The developer has to create 2 files at root of this folder: ``tokens.php`` and ``config.php``

``tokens.php`` will contain the tokens inside a ``$db_tokens`` value array with the tokens to use. You will use these tokens to write data or read private tables.

``config.php`` stores all of your collections config. You will create a ``$database_list`` variable with an array of ``JSONDatabase`` instances 

```php
<?php
// config.php
require_once('./classes/JSONDatabase.php');

$database_list = array();

$tmp = new JSONDatabase;
$tmp->folderPath = './files/';
$tmp->fileName = 'users';
$tmp->autoKey = false;

$database_list[$tmp->fileName] = $tmp;

$tmp = new JSONDatabase;
$tmp->folderPath = './files/';
$tmp->fileName = 'paths';
$tmp->autoKey = true;

$database_list[$tmp->fileName] = $tmp;
?>
```

Database will be stored in ``<foldePath>/<filename>.json`` and ``autoKey`` allows or forbids some write operations.

## API endpoints

All JS methods correspond in fact to axios request. Read requests are GET request when write requests are POST requests with a JSON data.

You always have the same first keys and the one key per method:
```json
{
  "collection": "<collectionName>",
  "token": "<writeTokenIfNecessary>",
  "command": "<methodName>",
  ...
}
```