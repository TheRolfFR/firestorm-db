<div align="center">
<img src="img/firestorm-128.png">

<h1>firestorm-db</h1>

<a href="https://www.npmjs.com/package/firestorm-db" target="_blank">
    <img alt="npm" src="https://img.shields.io/npm/v/firestorm-db?color=cb0000&logo=npm&style=flat-square">
</a>
<img alt="GitHub file size in bytes" src="https://img.shields.io/github/size/TheRolfFR/firestorm-db/src%2Findex.js?color=43A047&label=Script%20size&logoColor=green&style=flat-square">
<a href="https://github.com/TheRolfFR/firestorm-db/blob/main/CHANGELOG.md">
    <img alt="Changelog" src="https://img.shields.io/badge/Changelog-Read_here-blue?style=flat-square">
</a>
<a href="https://github.com/TheRolfFR/firestorm-db/actions/workflows/tests-js.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/TheRolfFR/firestorm-db/tests-js.yml?style=flat-square" alt="Tests" />
</a>
</div>

_Self-hosted Firestore-like database written purely in TypeScript/JavaScript and PHP with API endpoints based on micro bulk operations._

---

# Client

The Firestorm client connects to your backend PHP endpoints using the native `fetch` API. Any server errors are wrapped in informative `FirestormError` objects containing status codes and response details.

## Setup & Initialization

Create a Firestorm instance using the `createFirestorm()` factory:

```ts
// ESM / TypeScript
import { createFirestorm } from "firestorm-db";

// CommonJS
// const { createFirestorm } = require("firestorm-db");

const instance = createFirestorm({
	/** Optional internal name for debugging / reflection */
	name: "production",
	/** The base URL of your Firestorm server root (trailing slash optional) */
	address: "https://example.com/path/to/firestorm/root/",
	/** Your write token (must match a token in your server's tokens.php) */
	token: "my_secret_token_probably_from_an_env_file",
});

instance.address; // "https://example.com/path/to/firestorm/root/"
instance.name = "dev"; // updates the debug name
```

---

## Collections API

Collections represent database tables/collections (similar to Firestore collections or SQL tables).

### Defining a Collection

Collections use a `Raw` $\rightarrow$ `Transformed` pipeline:
`Collection<Raw, Transformed = CollectionItem<Raw>>`

- **`Raw`**: Schema of items written to disk/server (write type).
- **`Transformed`**: Type returned by read queries (read type). Defaults to `CollectionItem<Raw>` with injected `[ID_FIELD]`.
- **`ID_FIELD`**: Global `unique symbol` representing the document key/ID. Because `ID_FIELD` is a symbol, it **never collides** with user database properties (even if your documents already have an `id` field) and is automatically ignored during JSON serialization on writes.

```ts
import { createFirestorm, ID_FIELD } from "firestorm-db";

import type { CollectionItem } from "firestorm-db";

const instance = createFirestorm({ address, token });

interface User {
	id?: number; // Even if your database document has an 'id' field, no collision!
	name: string;
	password: string;
	pets: string[];
}

// 1. Standard Collection (injected ID_FIELD symbol)
const userCollection = instance.collection<User>({ name: "users" });

// Write operations accept Raw (User):
const newId = await userCollection.add({
	name: "John Doe",
	password: "secret_password",
	pets: ["dog"],
});

// Read operations return CollectionItem<User>:
const user = await userCollection.get(newId);
console.log(user[ID_FIELD]); // "123456789"
console.log(user.name); // "John Doe"
```

### OOP Models & Sensitive Field Sanitization

You can use the `transform` callback to instantiate OOP class models or strip sensitive fields (like passwords) before data is returned to your application:

```ts
// 1. Domain class models (OOP)
class UserModel {
	constructor(
		public readonly id: string,
		public readonly name: string,
		public readonly pets: string[],
	) {}

	static from(el: CollectionItem<User>): UserModel {
		return new UserModel(el[ID_FIELD], el.name, el.pets);
	}

	get hasPets(): boolean {
		return this.pets.length > 0;
	}

	greet(): string {
		return `Hello, I'm ${this.name}!`;
	}
}

const userModelCollection = instance.collection<User, UserModel>({
	name: "users",
	transform: (el) => UserModel.from(el),
});

const userModel = await userModelCollection.get(newId);
console.log(userModel.id); // "123456789"
console.log(userModel.greet()); // "Hello, I'm John Doe!"
console.log(userModel.hasPets); // true

// 2. Sensitive Field Stripping (e.g. omitting passwords)
type SafeUser = Omit<CollectionItem<User>, "password">;

const safeUserCollection = instance.collection<User, SafeUser>({
	name: "users",
	transform: ({ password, ...safeUser }) => safeUser,
});

const safeUser = await safeUserCollection.get(newId);
// Returns: { [ID_FIELD]: "123456789", name: "John Doe", pets: ["dog"] }
// "password" is completely removed before query results reach application code!
```

### Chaining Transformations (`.transform()`)

You can chain additional transformations via `.transform()`:

```ts
const userWithBye = userModelCollection.transform((user) => ({
	user,
	bye: () => `Bye ${user.name}!`,
}));

const item = await userWithBye.get(newId);
console.log(item.bye()); // "Bye John Doe!"
```

---

## Collection Operations

### Read Operations

| Method                         | Parameters                                                                     | Description                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `sha1()`                       | _none_                                                                         | Get the [SHA-1](https://www.php.net/manual/en/function.sha1.php) hash of the collection file to verify content without downloading JSON. |
| `readRaw(original?)`           | `original?: boolean`                                                           | Read the entire collection. Set `original: true` to disable ID injection (if doing so, consider using a `Document` instead).             |
| `get(key)`                     | `key: string \| number`                                                        | Get an element by its ID/key.                                                                                                            |
| `searchKeys(keys)`             | `keys: (string \| number)[]`                                                   | Get multiple elements by their keys.                                                                                                     |
| `search(filter, options?)`     | `filter: SearchOption[]`, `options?: boolean \| number \| SearchResultOptions` | Search through the collection with filtering criteria, limit, and optional randomization (`random: true \| seed`).                       |
| `select(option)`               | `option: SelectOption`                                                         | Retrieve only selected fields from the collection, with optional `search` filters.                                                       |
| `values(option)`               | `option: ValueOption`                                                          | Get all distinct non-null values for a given field across the collection, with optional `flatten`.                                       |
| `random(max?, seed?, offset?)` | `max?: number`, `seed?: number`, `offset?: number`                             | Retrieve random collection elements.                                                                                                     |

### Write Operations

| Method                   | Parameters                                    | Description                                                                                    |
| ------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `writeRaw(value)`        | `value: Object`                               | Overwrite the entire collection JSON content. **⚠️ Very dangerous! ⚠️**                        |
| `add(value)`             | `value: Raw`                                  | Append a value to the collection. Returns generated ID (requires `autoKey: true` server-side). |
| `addBulk(values)`        | `values: Raw[]`                               | Append multiple values to the collection. Returns array of generated IDs.                      |
| `set(key, value)`        | `key: string \| number`, `value: Raw`         | Set a value in the collection by its key.                                                      |
| `setBulk(keys, values)`  | `keys: (string \| number)[]`, `values: Raw[]` | Set multiple values in the collection by their keys.                                           |
| `remove(key)`            | `key: string \| number`                       | Remove an element by its key.                                                                  |
| `removeBulk(keys)`       | `keys: (string \| number)[]`                  | Remove multiple elements by their keys.                                                        |
| `editField(option)`      | `option: EditFieldOption`                     | Apply atomic operations on a specific field of an element.                                     |
| `editFieldBulk(options)` | `options: EditFieldOption[]`                  | Apply atomic operations on multiple element fields.                                            |

### Search Criteria & Options

```ts
const results = await userCollection.search(
	[
		{ field: "pets", criteria: "array-contains", value: "dog" },
		{ field: "name", criteria: "startsWith", value: "John", ignoreCase: true },
	],
	{ limit: 50, random: true },
);
```

| Criteria                | Types Allowed                 | Description                                                 |
| ----------------------- | ----------------------------- | ----------------------------------------------------------- |
| `'!='`                  | `boolean \| number \| string` | Field value is not equal to query value                     |
| `'=='`                  | `boolean \| number \| string` | Field value equals query value                              |
| `'>='`                  | `number \| string`            | Field value is greater than or equal to query value         |
| `'<='`                  | `number \| string`            | Field value is less than or equal to query value            |
| `'>'`                   | `number \| string`            | Field value is strictly greater than query value            |
| `'<'`                   | `number \| string`            | Field value is strictly less than query value               |
| `'in'`                  | `number \| string`            | Field value matches any item in the query array             |
| `'includes'`            | `string`                      | Field string includes substring                             |
| `'startsWith'`          | `string`                      | Field string starts with substring                          |
| `'endsWith'`            | `string`                      | Field string ends with substring                            |
| `'array-contains'`      | `Array`                       | Field array contains the query value                        |
| `'array-contains-none'` | `Array`                       | Field array contains none of the query array values         |
| `'array-contains-any'`  | `Array`                       | Field array contains at least one query array value         |
| `'array-contains-all'`  | `Array`                       | Field array contains every query array value                |
| `'array-length-eq'`     | `number`                      | Field array length equals query number                      |
| `'array-length-df'`     | `number`                      | Field array length is different from query number           |
| `'array-length-lt'`     | `number`                      | Field array length is strictly less than query number       |
| `'array-length-gt'`     | `number`                      | Field array length is strictly greater than query number    |
| `'array-length-le'`     | `number`                      | Field array length is less than or equal to query number    |
| `'array-length-ge'`     | `number`                      | Field array length is greater than or equal to query number |

### Edit Field Operations

Edit operations modify fields atomically without rewriting entire documents:

```ts
await userCollection.editField({
	id: "123456789",
	field: "loginCount",
	operation: "increment",
	value: 1,
});
```

| Operation      | Requires Value | Allowed Value Types      | Description                                                                                    |
| -------------- | -------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `set`          | Yes            | `any`                    | Set a new value for the field.                                                                 |
| `remove`       | No             | _N/A_                    | Delete the field from the element.                                                             |
| `append`       | Yes            | `string`                 | Append text to a string field.                                                                 |
| `invert`       | No             | _N/A_                    | Invert boolean state (`true` $\leftrightarrow$ `false`).                                       |
| `increment`    | No             | `number` (default: 1)    | Increment numerical field.                                                                     |
| `decrement`    | No             | `number` (default: 1)    | Decrement numerical field.                                                                     |
| `array-push`   | Yes            | `any`                    | Push an element to an array field.                                                             |
| `array-delete` | Yes            | `number`                 | Remove array element at specified index.                                                       |
| `array-splice` | Yes            | `[number, number, any?]` | Splice array field (see PHP [array_splice](https://www.php.net/manual/function.array-splice)). |

---

## Documents API

For singleton JSON files (such as application configuration or server settings), use `instance.document()`:

```ts
interface AppSettings {
	theme: "light" | "dark";
	maxUploadSize: number;
	nested: {
		maintenance: boolean;
	};
}

const settingsDoc = instance.document<AppSettings>({ name: "settings" });

// 1. Read entire document
const fullSettings = await settingsDoc.readRaw();

// 2. Get specific field
const theme = await settingsDoc.get("theme"); // "light"

// 3. Get multiple fields
const [themeVal, sizeVal] = await settingsDoc.getKeys(["theme", "maxUploadSize"]);

// 4. Update top-level or deep nested field (dot notation)
await settingsDoc.set("nested.maintenance", true);

// 5. Atomic field edit
await settingsDoc.editField({
	field: "maxUploadSize",
	operation: "increment",
	value: 1024,
});
```

---

## Files API

Firestorm includes a file management API under `instance.files`:

| Method          | Parameters                                               | Description                               | Returns                 |
| --------------- | -------------------------------------------------------- | ----------------------------------------- | ----------------------- |
| `get<T>(req)`   | `request: HttpGetRequest`                                | Retrieve file content by path             | `Promise<T>`            |
| `post(req)`     | `request: HttpBodyRequest`                               | Upload/post a file via `body: FormData`   | `Promise<Confirmation>` |
| `delete(req)`   | `request: HttpBodyRequest`                               | Delete a file from the server             | `Promise<Confirmation>` |
| `copy(options)` | `options: FileCopyOptions`                               | Copy a file directly on the server        | `Promise<Confirmation>` |
| `move(options)` | `options: FileMoveOptions`                               | Move/rename a file directly on the server | `Promise<Confirmation>` |
| `exists(req)`   | `options: FileExistsOptions`                             | Check if a file exists on the server      | `Promise<boolean>`      |
| `patch(req)`    | `request: HttpBodyRequest<Body, FilePatchCustomOptions>` | Append/patch text to a file on the server | `Promise<Confirmation>` |
| `put(req)`      | `request: HttpBodyRequest<Body, FilePutCustomOptions>`   | Write/put text to a file on the server    | `Promise<Confirmation>` |

### File Examples

```ts
import FormData from "form-data"; // in Node.js (or browser native FormData)

// Upload / Post
const form = new FormData();
form.append("path", "/quote.txt");
form.append("file", "Great Scott!", "quote.txt");
form.append("overwrite", "true");
await instance.files.post({ body: form });

// Get content
const text = await instance.files.get<string>({ path: "/quote.txt" });
console.log(text); // "Great Scott!"

// Patch / Append text
await instance.files.patch({
	path: "/quote.txt",
	body: "\n- Doc Brown",
	options: { create: true },
});

// Copy & Move
await instance.files.copy({ oldPath: "/quote.txt", newPath: "/quote_backup.txt", overwrite: true });
await instance.files.move({
	oldPath: "/quote_backup.txt",
	newPath: "/quote_archive.txt",
	overwrite: true,
});

// Check existence & Delete
const exists = await instance.files.exists({ path: "/quote_archive.txt" }); // true
await instance.files.delete({ path: "/quote_archive.txt" });
```

---

## Advanced Client Features

### Collision-Free Document IDs with `ID_FIELD`

Firestorm uses a global unique symbol `ID_FIELD` for document keys. This guarantees that:

1. Firestorm's document ID never conflicts with existing fields in your database document (e.g. `{ id: 101, title: "Phone" }`).
2. Write operations (`add`, `set`, `writeRaw`) and `JSON.stringify` automatically ignore `ID_FIELD`, keeping stored payloads clean.
3. Complex generic types are avoided—`Collection<Raw, Transformed>` only requires the data types you actually care about.

```ts
import { createFirestorm, ID_FIELD } from "firestorm-db";

import type { CollectionItem } from "firestorm-db";

interface Product {
	id: number; // Stored numeric product SKU
	title: string;
	price: number;
}

const productCollection = instance.collection<Product>({
	name: "products",
});

const item = await productCollection.get("doc_101");
console.log(item.id); // 101 (your stored numeric ID)
console.log(item[ID_FIELD]); // "doc_101" (Firestorm's document key)
```

### Combining Collections via `transform`

You can link related collections together using `transform`:

```ts
const orders = instance.collection({ name: "orders" });

const customers = instance.collection({
	name: "customers",
	transform: (el) => ({
		...el,
		getOrders: () =>
			orders.search([
				{
					field: "customerId",
					criteria: "==",
					value: el[ID_FIELD],
				},
			]),
	}),
});

const customer = await customers.get(123);
const customerOrders = await customer.getOrders();
```

### Compatibility & Versioning

```ts
// NPM package client version
instance.clientVersion;

// Server version string from version.ini
await instance.serverVersion;

// Check if client and server versions match
const isCompatible = await instance.isCompatibleAddress();
```

---

## Exported TypeScript Types

The package exports all types and interfaces for full type-safety:

```ts
import type {
	ArrayCriteria,
	BooleanCriteria,
	Collection,
	// Common Utilities
	CollectionItem,
	CollectionOptions,
	// Criteria Unions
	ComparisonCriteria,
	Confirmation,
	Document,
	DocumentEditFieldOption,
	DocumentOptions,
	EditFieldOption,
	FileManager,
	// Resources & Instances
	Firestorm,
	FirestormCreationOption,
	FirestormError,
	IdEncoding,
	NumberCriteria,
	// Deep Path Types
	Path,
	PathValue,
	ResourceLike,
	ResourceManager,
	ResponseDetails,
	// Query & Options
	SearchOption,
	SearchResultOptions,
	SelectOption,
	StringCriteria,
	ValueOption,
	ValueReturnType,
} from "firestorm-db";
```

---

# Server

Firestorm's backend consists of lightweight PHP endpoints optimized for **PHP 8.5** with built-in backward-compatibility polyfills supporting **PHP 8.2+**.

## Server Setup

Deploy the server files from [`src/server/`](./src/server/) to your PHP hosting directory. The server includes zero-dependency polyfills (`src/server/polyfills/`) for standard library functions introduced in PHP 8.3–8.5 (`json_validate`, `array_any`, `array_all`, `array_find`, `mb_trim`, `array_first`, `array_last`), backed by typed Enums (`SearchCriteria`, `EditOperation`, `ReadCommand`, `WriteCommand`), Constructor Property Promotion, and modern `\Random\Randomizer` engines. If using Composer, a `composer.json` is also provided.

The two files to configure are:

### 1. `tokens.php`

Declare authorized write tokens in the `$db_tokens` array:

```php
<?php
// tokens.php
$db_tokens = [
    'my_secret_token_probably_from_an_env_file',
    'another_authorized_token',
];
```

### 2. `config.php`

Configure collections and files settings in `$database_list`:

```php
<?php
// config.php
require_once './classes/JSONDatabase.php';

$database_list = [
    // Standard auto-incrementing collection
    'orders' => new JSONDatabase('orders', autoKey: true, autoIncrement: true),

    // Timestamp-based uniqid keys (default when autoIncrement is false)
    'users' => new JSONDatabase('users', autoKey: true, autoIncrement: false),

    // Cryptographically secure random keys (32-character hex)
    'secure_vault' => new JSONDatabase(
        fileName: 'secure_data',
        autoIncrement: false,
        secureKeys: true
    ),

    // Explicit manual IDs only
    'settings' => new JSONDatabase('settings', autoKey: false),
];

// Optional Files Storage configuration
$authorized_file_extension = ['.txt', '.png', '.jpg', '.jpeg', '.pdf'];
$STORAGE_LOCATION = dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';
```

### `JSONDatabase` Options

- **`folderPath`**: Storage folder for JSON files (default: `./files/`).
- **`fileName`**: Name of the JSON file on disk (without `.json`).
- **`autoKey`**: Enable automatic ID generation on `add()` (default: `true`).
- **`autoIncrement`**: Use incremental numerical keys (`0, 1, 2...`) vs random string keys (default: `true`).
- **`secureKeys`**: Use cryptographically secure keys (`bin2hex(random_bytes(16))`) instead of `uniqid` when `autoIncrement` is `false` (default: `false`).

---

## File Permissions

Ensure the web server has write permissions to your storage and data directories:

```sh
sudo chown -R www-data "/path/to/firestorm/root/files"
sudo chown -R www-data "/path/to/firestorm/root/uploads"
```

---

## Memory Management

For large collections, allocate sufficient memory in `/etc/php/8.x/apache2/php.ini` or `.user.ini`:

```ini
memory_limit = 256M
```

---

## Request Routing & Architecture

The client communicates with the server via three specialized entrypoints:

- **Read operations** $\rightarrow$ `POST /get.php` (JSON payload)
- **Write operations** $\rightarrow$ `POST /post.php` (JSON payload)
- **File operations** $\rightarrow$ `/files.php` (`GET`, `POST`, `PATCH`)

If you do not use file management features, you can safely remove `files.php` and the `files_api/` directory.
