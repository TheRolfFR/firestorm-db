# firestorm-db

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

Available methods for a collection:

### Read operations

| Name | Parameters | Description |
|--|--|--|
| read_raw() | none | Reads the entire collection |
| get(id) | id: ``String\|Name`` | Tries to get one element by its key |
| search(searchOptions) | searchOptions: ``SearchOption[]`` | Searches collections and returns matching results |

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