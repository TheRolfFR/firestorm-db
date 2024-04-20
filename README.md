<div align="center">
<img src="img/firestorm-128.png">

<h1>firestorm-db</h1>

<a href="https://www.npmjs.com/package/firestorm-db" target="_blank" ><img alt="npm" src="https://img.shields.io/npm/v/firestorm-db?color=cb0000&logo=npm&style=flat-square"></a>
<img alt="GitHub file size in bytes" src="https://img.shields.io/github/size/TheRolfFR/firestorm-db/src%2Findex.js?color=43A047&label=Script%20size&logoColor=green&style=flat-square">
<a href="https://github.com/TheRolfFR/firestorm-db/blob/main/CHANGELOG.md"> <img alt="Static Badge" src="https://img.shields.io/badge/Changelog-Read_here-blue?style=flat-square"></a>
<a href="https://github.com/TheRolfFR/firestorm-db/actions/workflows/testjs.yml"> <img src="https://img.shields.io/github/actions/workflow/status/TheRolfFR/firestorm-db/testjs.yml?style=flat-square" alt="Tests" /></a>

</div>

_Self hosted Firestore-like database with API endpoints based on micro bulk operations_

## Installation

Installing the JavaScript wrapper is as simple as running:
```sh
npm install firestorm-db
```
To install the PHP backend used to actually query data, copy the sample [php](./php/) folder to your hosting platform and edit the configuration files.
More information about configuring Firestorm server-side is given in the [PHP](#php-part) section.

# JavaScript Part

The JavaScript [index.js](./src/index.js) file is simply an [Axios](https://www.npmjs.com/package/axios) wrapper of the PHP API.

## JavaScript setup

First, set your API address (and your writing token if needed) using the `address()` and `token()` functions:

```js
const firestorm = require("firestorm-db");

firestorm.address("http://example.com/path/to/firestorm/root/");

// only necessary if you want to write or access private collections
// must match token stored in tokens.php file
firestorm.token("my_secret_token_probably_from_an_env_file");
```

Now you can use Firestorm to its full potential:

```js
const firestorm = require("firestorm-db");

// returns a Collection instance
const userCollection = firestorm.collection("users");

// all methods return promises
userCollection
    .readRaw()
    .then((res) => console.log(res))
    .catch((err) => console.error(err));
```

## Create your first Collection

A Firestorm collection takes one required argument and one optional argument:

- The name of the collection as a `string`.
- The method adder, which lets you inject methods to query results. It's implemented similarly to [`Array.prototype.map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map), taking an outputted element as an argument, modifying the element with methods and data inside a callback, and returning the modified element at the end.

```js
const firestorm = require("firestorm-db");

const userCollection = firestorm.collection("users", (el) => {
    // inject a method into the element
    el.hello = () => `${el.name} says hello!`;
    // return the modified element back with the injected method
    return el;
});

// assumes you have a 'users' table with a printable field called 'name'
const johnDoe = await userCollection.get(123456789);
// gives { name: "John Doe", hello: Function }

johnDoe.hello(); // "John Doe says hello!"
```

Available methods for a collection:

### Read operations

| Name                          | Parameters                                                  | Description                                                                                                           |
| ----------------------------- | ------------------------------------------------------------| --------------------------------------------------------------------------------------------------------------------- |
| sha1()                        | none                                                        | Get the sha1 hash of the file. Can be used to see if same file content without downloading the file.                  |
| readRaw()                     | none                                                        | Returns the whole content of the JSON. ID values are injected for easier iteration, so this may be different to sha1. |
| get(id)                       | id: `string \| number`                                      | Get an element from the collection.                                                                                   |
| search(searchOptions, random) | searchOptions: `SearchOption[]` random?:`boolean \| number` | Search through the collection You can randomize the output order with random as true or a given seed.                 |
| searchKeys(keys)              | keys: `string[] \| number[]`                                | Search specific keys through the collection.                                                                          |
| select(selectOption)          | selectOption: `{ fields: string[] }`                        | Get only selected fields from the collection Essentially an upgraded version of readRaw.                              |
| values(valueOption)           | valueOption: `{ field: string, flatten?: boolean }`         | Get all distinct non-null values for a given key across a collection.                                                 |
| random(max, seed, offset)     | max?: `number >= -1` seed?: `number` offset?:`number >= 0`  | Reads random entries of collection.                                                                                   |

The search method can take one or more options to filter entries in a collection. A search option takes a `field` with a `criteria` and compares it to a `value`. You can also use the boolean `ignoreCase` option for string values.

Not all criteria are available depending the field type. There are more options available than the firestore `where` command, allowing you to get better and faster search results.

### All search options available

| Criteria               | Types allowed                 | Description                                                                       |
| ---------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `'!='`                 | `boolean`, `number`, `string` | Entry field's value is different from yours                                       |
| `'=='`                 | `boolean`, `number`, `string` | Entry field's value is equal to yours                                             |
| `'>='`                 | `number`, `string`            | Entry field's value is greater or equal than yours                                |
| `'<='`                 | `number`, `string`            | Entry field's value is equal to than yours                                        |
| `'>'`                  | `number`, `string`            | Entry field's value is greater than yours                                         |
| `'<'`                  | `number`, `string`            | Entry field's value is lower than yours                                           |
| `'in'`                 | `number`, `string`            | Entry field's value is in the array of values you gave                            |
| `'includes'`           | `string`                      | Entry field's value includes your substring                                       |
| `'startsWith'`         | `string`                      | Entry field's value starts with your substring                                    |
| `'endsWith'`           | `string`                      | Entry field's value ends with your substring                                      |
| `'array-contains'`     | `Array`                       | Entry field's array contains your value                                           |
| `'array-contains-any'` | `Array`                       | Entry field's array ends contains your one value of more inside your values array |
| `'array-length-eq'`    | `number`                      | Entry field's array size is equal to your value                                   |
| `'array-length-df'`    | `number`                      | Entry field's array size is different from your value                             |
| `'array-length-lt'`    | `number`                      | Entry field's array size is lower than your value                                 |
| `'array-length-gt'`    | `number`                      | Entry field's array size is lower greater than your value                         |
| `'array-length-le'`    | `number`                      | Entry field's array size is lower or equal to your value                          |
| `'array-length-ge'`    | `number`                      | Entry field's array size is greater or equal to your value                        |

### Write operations

| Name                    | Parameters                                       | Description                                                                         |
| ----------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| writeRaw()              | none                                             | Set the entire JSON file contents **⚠️ Very dangerous! ⚠️**                           |
| add(value)              | value: `Object`                                  | Adds one element with autoKey into the collection                                   |
| addBulk(values)         | value: `Object[]`                                | Adds multiple elements with autoKey into the collection                             |
| remove(key)             | key: `string \| number`                          | Remove one element from the collection with the corresponding key                   |
| removeBulk(keys)        | keys: `string[] \| number[]`                     | Remove multiple elements from the collection with the corresponding keys            |
| set(key, value)         | key: `string \| number`, value: `Object`         | Sets one element with its key and value into the collection                         |
| setBulk(keys, values)   | keys: `string[] \| number[]`, values: `Object[]` | Sets multiple elements with their corresponding keys and values into the collection |
| editField(obj)          | obj: `EditObject`                                | Changes one field of a given element in a collection                                |
| editFieldBulk(objArray) | objArray: `EditObject[]`                         | Changes one field per element in a collection                                       |

### Edit field operations

Edit objects have an `id` of the element, a `field` to edit, an `operation` with what to do to this field, and a possible `value`. Here is a list of operations:

| Operation      | Needs value | Types allowed      | Description                                                                                                                                                   |
| -------------- | ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set`          | Yes         | `any`              | Sets a field to a given value.                                                                                                                                |
| `remove`       | No          | `any`              | Removes a field from the element.                                                                                                                             |
| `append`       | Yes         | `string`           | Appends a new string at the end of the string field.                                                                                                          |
| `invert`       | No          | `any`              | Inverts the state of a boolean field.                                                                                                                         |
| `increment`    | No          | `number`           | Adds a number to the field, default is 1.                                                                                                                     |
| `decrement`    | No          | `number`           | Removes a number from the field, default is 1.                                                                                                                |
| `array-push `  | Yes         | `any`              | Push an element to the end of an array field.                                                                                                                 |
| `array-delete` | Yes         | `number`           | Removes an element at a certain index in an array field. Check the PHP [array_splice](https://www.php.net/manual/function.array-splice) offset for more info. |
| `array-splice` | Yes         | `[number, number]` | Removes certain elements. Check the PHP [array_splice](https://www.php.net/manual/function.array-splice) offset and length for more info.                     |

Various other methods and constants exist in the JavaScript wrapper, which will make more sense once you learn what's actually happening behind the scenes.

# PHP Part

The PHP files handle files, read, and writes, through `GET` and `POST` requests sent by the JavaScript wrapper. All JavaScript methods correspond to an equivalent Axios request to the relevant PHP file.

## PHP setup

The server-side files to handle requests can be found and copied [here](./php/). The two files that need editing are `tokens.php` and `config.php`.

- `tokens.php` contains writing tokens declared in a `$db_tokens` array. These correspond to the tokens used with `firestorm.token()` in the JavaScript wrapper.
- `config.php` stores all of your collections. This file needs to declare a `$database_list` array of `JSONDatabase` instances.

```php
<?php
// config.php
require_once('./classes/JSONDatabase.php');

$database_list = array();

// without constructor
$tmp = new JSONDatabase;
$tmp->folderPath = './files/';
$tmp->fileName = 'paths';
$tmp->autoKey = true;
$tmp->autoIncrement = false;

$database_list[$tmp->fileName] = $tmp;

// with constructor ($fileName, $autoKey = true, $autoIncrement = true)
$tmp = new JSONDatabase('users', false);
$tmp->folderPath = './files/';

$database_list[$tmp->fileName] = $tmp;
?>
```

- The database will be stored in `<folderPath>/<filename>.json` (default folder: `./files/`).
- `autoKey` controls whether to automatically generate the key name or to have explicit key names (default: `true`).
- `autoIncrement` controls whether to simply start generating key names from zero or to use a [random ID](https://www.php.net/manual/en/function.uniqid.php) each time (default: `true`).
- The key in the `$database_list` array is what the collection will be called in JavaScript in the Collection constructor (this can be different from the JSON filename if needed).

# Firestorm Files

Firestorm's file APIs are implemented in `files.php`. If you don't need file-related features, then simply delete this file.

To work with files server-side, you need two new configuration variables in `config.php`:

```php
// Extension whitelist
$authorized_file_extension = array('.txt', '.png', '.jpg', '.jpeg');

// Root directory for where files should be uploaded
// ($_SERVER['SCRIPT_FILENAME']) is a shortcut to the root Firestorm directory.
$STORAGE_LOCATION = dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';
```

Additionally, since the PHP scripts create folders and files, the script will fail if the PHP user doesn't have write permissions.
You can give Firestorm rights to a folder with the following command:

```sh
sudo chown -R www-data "/path/to/uploads/"
```

From there, you can use the functions in `firestorm.files` (detailed below) from the JavaScript wrapper.
If your upload folder is accessible from a server URL, you can directly use its address to retrieve the file.

## Upload a file

`firestorm.files.upload` uses a `FormData` object to represent an uploaded file. This class is generated from forms and is [native in modern browsers](https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData), and with Node.js can be installed with the [form-data](https://www.npmjs.com/package/form-data) package.

The uploaded file content can be a [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String), a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob), a [Buffer](https://nodejs.org/api/buffer.html), or an [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).

There is additionally an overwrite option in order to avoid mistakes.

```js
const FormData = require("form-data");
const firestorm = require("firestorm-db");
firestorm.address("ADDRESS_VALUE");
firestorm.token("TOKEN_VALUE");

const form = new FormData();
form.append("path", "/quote.txt");
// make sure to set a temporary file name
form.append("file", "but your kids are gonna love it.", "quote.txt");
// override is false by default; don't append it if you don't need to
form.append("overwrite", "true");
const uploadPromise = firestorm.files.upload(form);

uploadPromise
    .then(() => console.log("Upload successful"))
    .catch((err) => console.error(err));
```

## Get a file

`firestorm.files.get` takes a file's direct URL location or its content as its parameter.

```js
const firestorm = require("firestorm-db");
firestorm.address("ADDRESS_VALUE");

const getPromise = firestorm.files.get("/quote.txt");

getPromise
    .then((fileContent) => console.log(fileContent)) // 'but your kids are gonna love it.
    .catch((err) => console.error(err));
```

## Delete a file

`firestorm.files.delete` has the same interface as `firestorm.files.get`, but as the name suggests, it deletes the file rather than gets it.

```js
const firestorm = require("firestorm-db");
firestorm.address("ADDRESS_VALUE");
firestorm.token("TOKEN_VALUE");

const deletePromise = firestorm.files.delete("/quote.txt");

deletePromise
    .then(() => console.log("File successfully deleted"))
    .catch((err) => console.error(err));
```

# TypeScript Support

Firestorm ships with TypeScript support out of the box.

## Collection types

Collections in TypeScript additionally take a generic parameter `T`, which is the type of each element in the collection. If you aren't using a relational collection, this can simply be set to `any`.

```ts
import firestorm from "firestorm-db";
firestorm.address("ADDRESS_VALUE");

interface User {
    id: string;
    name: string;
    password: string;
    pets: string[];
}

const userCollection = firestorm.collection<User>("users");

const johnDoe = await userCollection.get(123456789);
// type: { name: string, password: string, pets: string[] }
```

Methods should also be stored in this interface, and will be filtered out from write operations:

```ts
import firestorm from "firestorm-db";
firestorm.address("ADDRESS_VALUE");

interface User {
    id: string;
    name: string;
    hello(): string;
}

const johnDoe = await userCollection.get(123456789, (el) => {
    // interface types should agree with injected methods
    el.hello = () => `${el.name} says hello!`;
    return el;
});
const hello = johnDoe.hello(); // type: string

await userCollection.add({
    id: "123456788",
    name: "Mary Doe",
    // error: Object literal may only specify known properties, and 'hello' does not exist in type 'Addable<User>'.
    hello() {
        return "Mary Doe says hello!"
    }
})
```

## Additional types

Additional types exist for search criteria options, write method return types, configuration methods, the file handler, etc.

```ts
import firestorm from "firestorm-db";
firestorm.address("ADDRESS_VALUE");

const deleteConfirmation = await firestorm.files.delete("/quote.txt");
// type: firestorm.WriteConfirmation
```

# Memory Warning

Handling big collections can cause memory allocation issues like:

```
Fatal error:
Allowed memory size of 134217728 bytes exhausted (tried to allocate 32360168 bytes)
```

If you encounter a memory allocation issue, you have to allow more memory through `/etc/php/7.4/apache2/php.ini` with a bigger value:

```
memory_limit = 256M
```

# API Endpoints

If you want to manually send requests without using the JavaScript wrapper, simply make an HTTP request to the relevant PHP file with your content. Read requests are `GET` requests sent to `<your_address_here>/get.php`, write requests are `POST` requests sent to `<your_address_here>/post.php` with provided JSON data, and file requests are requests sent to `<your_address_here>/files.php` with provided form data.

The first keys in a Firestorm request will always be the same regardless of its type, and further keys will depend on the specific method:

```json
{
  "collection": "<collectionName>",
  "token": "<writeTokenIfNecessary>",
  "command": "<methodName>",
  ...
}
```
