# Migration Guide: Firestorm 1.15.1 to 2.0.0

This guide outlines the breaking changes, architectural upgrades, and step-by-step instructions to migrate your applications and server infrastructure from **Firestorm 1.15.1** to **Firestorm 2.0.0**.

---

## 📋 Table of Contents

1. [High-Level Changes Overview](#high-level-changes-overview)
2. [System & Environment Requirements](#system--environment-requirements)
3. [Client-Side Migration](#client-side-migration)
   - [1. Instance Creation & Configuration](#1-instance-creation--configuration)
   - [2. `ID_FIELD` Unique Symbol & `CollectionItem<T>`](#2-id_field-unique-symbol--collectionitemt)
   - [3. Collection Definition & Transform Pipeline](#3-collection-definition--transform-pipeline)
   - [4. Dedicated `Document` Resource](#4-dedicated-document-resource)
   - [5. Standardized Files API](#5-standardized-files-api)
   - [6. Structured Error Handling with `FirestormError`](#6-structured-error-handling-with-firestormerror)
4. [Server-Side Migration (PHP)](#server-side-migration-php)
   - [1. PHP Version Requirement (PHP 8.2+)](#1-php-version-requirement-php-82)
   - [2. Directory Reorganization & Modular Routing](#2-directory-reorganization--modular-routing)
   - [3. `JSONDatabase` Configuration & `secureKeys`](#3-jsondatabase-configuration--securekeys)
5. [Side-by-Side Migration Cheat Sheet](#side-by-side-migration-cheat-sheet)

---

## High-Level Changes Overview

Firestorm 2.0 is a ground-up modernization of both the TypeScript/JavaScript client and PHP backend:

- **Native TypeScript Rewrite**: Fully typed client with dual ESM & CommonJS outputs, zero external HTTP dependencies (uses native `fetch`), and comprehensive type inference.
- **Collision-Free Document IDs**: `ID_FIELD` is now a global `unique symbol` (`Symbol.for("firestorm.id")`), eliminating property collisions with user schemas (such as existing `id` properties) and preventing ID pollution during JSON writes.
- **`Raw` $\rightarrow$ `Transformed` Pipeline**: Strong separation between types written to disk (`Raw`) and types returned from read queries (`Transformed`), with built-in support for OOP model instantiation, sensitive field stripping, and `.transform()` chaining.
- **Dedicated `Document` Class**: First-class support for single key-value configuration documents with deep dot-path mutation (`instance.document(...)`).
- **HTTP-Standard File Manager**: File operations revamped around standard HTTP verbs (`get()`, `post()`, `put()`, `patch()`, `delete()`) and direct server-side file management (`copy()`, `move()`, `exists()`).
- **PHP 8.5 Standards & Polyfills**: Backend updated for PHP 8.5 with a dedicated zero-dependency polyfill layer supporting PHP 8.2+, backed Enums, constructor property promotion, and cryptographically secure random IDs.

---

## System & Environment Requirements

| Runtime / Platform | v1.15.1           | v2.0.0                                                             |
| :----------------- | :---------------- | :----------------------------------------------------------------- |
| **Node.js**        | `>= 16.x`         | `>= 18.x` (native `fetch` support)                                 |
| **TypeScript**     | `>= 4.x`          | `>= 5.0`                                                           |
| **Module Systems** | CJS / Bundled ESM | Native ESM (`dist/esm`) & CJS (`dist/cjs`) + `.d.ts` declarations  |
| **PHP (Server)**   | PHP 7.4+ / 8.0+   | **PHP 8.2+** (PHP 8.5 recommended; polyfills included for 8.3–8.5) |

---

## Client-Side Migration

### 1. Instance Creation & Configuration

#### ❌ v1.15.1 (Legacy Singleton & `.create()`)

```ts
// Legacy singleton mutation
import firestorm from "firestorm-db";

firestorm.address = "https://example.com/api";
firestorm.token = "secret_token";

// Or v1.15.x factory
const instance = firestorm.create({
	address: "https://example.com/api",
	token: "secret_token",
});
```

#### ✅ v2.0.0 (Functional `createFirestorm` Factory)

Global singleton properties and `firestorm.table()` have been removed. Always instantiate using the named `createFirestorm()` factory:

```ts
import { createFirestorm } from "firestorm-db";

const instance = createFirestorm({
	name: "production", // optional debug name
	address: "https://example.com/api",
	token: "secret_token",
});
```

---

### 2. `ID_FIELD` Unique Symbol & `CollectionItem<T>`

In v1.15.1, `ID_FIELD` was the string `"id"`, which caused conflicts if your collection stored documents containing their own `id` field. In v2.0.0, `ID_FIELD` is a `unique symbol` (`Symbol.for("firestorm.id")`).

- Document keys injected by Firestorm are indexed via `item[ID_FIELD]`.
- Symbols are natively ignored by `JSON.stringify()`, ensuring stored payloads on disk remain unmodified.
- The `WithID<T>` type helper has been replaced with `CollectionItem<T>`.

#### ❌ v1.15.1

```ts
import firestorm from "firestorm-db";

import type { WithID } from "firestorm-db";

interface User {
	id?: string; // Collides with Firestorm document ID!
	name: string;
}

const user: WithID<User> = await userCollection.get("12345");
console.log(user.id); // "12345"
```

#### ✅ v2.0.0

```ts
import { ID_FIELD } from "firestorm-db";

import type { CollectionItem } from "firestorm-db";

interface User {
	id?: number; // Safe! No collision with Firestorm's document key
	name: string;
}

// CollectionItem<User> is User & { [ID_FIELD]: string }
const user: CollectionItem<User> = await userCollection.get("12345");

console.log(user[ID_FIELD]); // "12345" (Firestorm document ID)
console.log(user.id); // Stored user property (if any)
```

---

### 3. Collection Definition & Transform Pipeline

#### ❌ v1.15.1 (Positional arguments and `addMethods`)

```ts
// Positional collection name and callback for adding methods
const users = instance.collection<User>("users", (user, col) => ({
	...user,
	greet() {
		return `Hello ${user.name}`;
	},
}));
```

#### ✅ v2.0.0 (Object Configuration & `Raw` $\rightarrow$ `Transformed` Generics)

Collections are configured using an options object `{ name: string, transform?: Function }`. Write methods (`add`, `set`, etc.) accept `Raw`, and read methods (`get`, `search`, etc.) return `Transformed` (defaults to `CollectionItem<Raw>`):

```ts
import { createFirestorm, ID_FIELD } from "firestorm-db";

import type { CollectionItem } from "firestorm-db";

interface UserRaw {
	name: string;
	passwordHash: string;
}

// 1. Basic Collection
const users = instance.collection<UserRaw>({ name: "users" });

// 2. Sensitive Field Stripping via transform
type SafeUser = Omit<CollectionItem<UserRaw>, "passwordHash">;

const safeUsers = instance.collection<UserRaw, SafeUser>({
	name: "users",
	transform: ({ passwordHash, ...user }) => user,
});

// 3. OOP Class Model Instantiation
class UserModel {
	constructor(
		public readonly id: string,
		public readonly name: string,
	) {}

	static from(item: CollectionItem<UserRaw>): UserModel {
		return new UserModel(item[ID_FIELD], item.name);
	}

	greet() {
		return `Hello, I'm ${this.name}!`;
	}
}

const userModels = instance.collection<UserRaw, UserModel>({
	name: "users",
	transform: (item) => UserModel.from(item),
});

// 4. Fluent Chaining with .transform()
const userWithBye = userModels.transform((model) => ({
	model,
	bye: () => `Goodbye ${model.name}`,
}));
```

---

### 4. Dedicated `Document` Resource

In v1.x, storing singleton configurations required treating a single file as a collection with `readRaw({ original: true })`. Firestorm 2.0 introduces a dedicated `Document` class with deep dot-path mutation.

```ts
interface AppConfig {
	theme: "light" | "dark";
	features: {
		betaTester: boolean;
		maxUploadLimit: number;
	};
}

const configDoc = instance.document<AppConfig>({ name: "app_config" });

// Read whole document
const fullConfig = await configDoc.readRaw();

// Get specific keys (type-safe)
const theme = await configDoc.get("theme"); // "light" | "dark"
const [themeVal, limitVal] = await configDoc.getKeys(["theme", "features.maxUploadLimit"]);

// Deep mutate with dot notation
await configDoc.set("features.betaTester", true);

// Atomic field operations
await configDoc.editField({
	field: "features.maxUploadLimit",
	operation: "increment",
	value: 1024,
});
```

---

### 5. Standardized Files API

File methods under `instance.files` have been overhauled to align with standard HTTP verbs and use single configuration objects.

| Action                  | v1.15.1                               | v2.0.0                                                            |
| :---------------------- | :------------------------------------ | :---------------------------------------------------------------- |
| **Download / Get**      | `files.get(path)`                     | `instance.files.get<T>({ path })`                                 |
| **Upload / Post**       | `files.upload(path, file, overwrite)` | `instance.files.post({ body: formData })`                         |
| **Write / Put Text**    | _(N/A)_                               | `instance.files.put({ path, body, options })`                     |
| **Append / Patch Text** | `files.append(path, content, create)` | `instance.files.patch({ path, body, options: { create: true } })` |
| **Delete**              | `files.delete(path)`                  | `instance.files.delete({ path })`                                 |
| **Server-Side Copy**    | _(N/A)_                               | `instance.files.copy({ oldPath, newPath, overwrite? })`           |
| **Server-Side Move**    | _(N/A)_                               | `instance.files.move({ oldPath, newPath, overwrite? })`           |
| **File Exists Check**   | _(N/A)_                               | `instance.files.exists({ path })`                                 |

#### v2.0.0 Files Example:

```ts
import FormData from "form-data"; // Node.js (or browser native FormData)

// 1. Upload via post()
const form = new FormData();
form.append("path", "/reports/2026.pdf");
form.append("file", fileBuffer, "2026.pdf");
form.append("overwrite", "true");
await instance.files.post({ body: form });

// 2. Direct Write / Put
await instance.files.put({
	path: "/logs/app.log",
	body: "System started.",
	options: { overwrite: true },
});

// 3. Patch / Append
await instance.files.patch({
	path: "/logs/app.log",
	body: "\nEvent: User login",
	options: { create: true },
});

// 4. Server-side Operations
if (await instance.files.exists({ path: "/logs/app.log" })) {
	await instance.files.copy({
		oldPath: "/logs/app.log",
		newPath: "/logs/app_backup.log",
		overwrite: true,
	});
}
```

---

### 6. Structured Error Handling with `FirestormError`

Axios error wrapping has been replaced by the native `FirestormError` class:

```ts
import { FirestormError } from "firestorm-db";

try {
	await userCollection.get("non_existent_key");
} catch (error) {
	if (error instanceof FirestormError) {
		console.error("HTTP Status:", error.response?.status); // e.g., 404
		console.error("Status Text:", error.response?.statusText); // e.g., "Not Found"
		console.error("Response Details:", error.response?.data); // Raw/parsed server payload
	}
}
```

---

## Server-Side Migration (PHP)

### 1. PHP Version Requirement (PHP 8.2+)

- **Minimum Supported Version**: **PHP 8.2**.
- **Target Engine**: **PHP 8.5** (built-in polyfills in `src/server/polyfills/` backport features like `json_validate`, `array_any`, `array_all`, `mb_trim`, etc.).
- Ensure `extension=json` and `extension=mbstring` are enabled in `php.ini`.

### 2. Directory Reorganization & Modular Routing

The backend structure has moved from `php/` to `src/server/` with modular file handlers:

```text
src/server/
├── classes/
│   ├── FileAccess.php
│   ├── HTTPException.php
│   └── JSONDatabase.php
├── enums/
│   ├── ApiCommand.php
│   ├── EditOperation.php
│   └── SearchCriteria.php
├── files_api/
│   ├── append_file.php
│   ├── copy_file.php
│   ├── delete_file.php
│   ├── exists_file.php
│   ├── get_file.php
│   ├── move_file.php
│   ├── upload_file.php
│   └── write_file.php
├── polyfills/
│   └── polyfills.php
├── config.php
├── files.php
├── get.php
├── post.php
├── tokens.php
└── version.ini
```

> **Note**: If your deployment script synchronizes the `php/` directory to your web server root, update the target path to `src/server/`.

### 3. `JSONDatabase` Configuration & `secureKeys`

`JSONDatabase` now fully supports PHP named arguments and introduces `$secureKeys` for generating cryptographically secure 32-character hex keys (`random_bytes(16)` / `\Random\Randomizer`) instead of timestamp-based `uniqid`.

```php
<?php
// src/server/config.php
require_once './classes/JSONDatabase.php';

$database_list = [
    // Standard Auto-Incrementing (0, 1, 2...)
    'orders' => new JSONDatabase('orders', autoKey: true, autoIncrement: true),

    // Fast Uniqid Keys
    'users' => new JSONDatabase('users', autoKey: true, autoIncrement: false),

    // Cryptographically Secure Hex Keys
    'sessions' => new JSONDatabase(
        fileName: 'sessions',
        autoIncrement: false,
        secureKeys: true
    ),

    // Fixed Document / Manual IDs
    'settings' => new JSONDatabase('settings', autoKey: false),
];

// Optional Files Storage configuration
$authorized_file_extension = ['.txt', '.png', '.jpg', '.jpeg', '.pdf', '.json'];
$STORAGE_LOCATION = dirname($_SERVER['SCRIPT_FILENAME']) . '/uploads/';
```

---

## Side-by-Side Migration Cheat Sheet

| Feature / Operation           | Firestorm 1.15.1                              | Firestorm 2.0.0                                                                   |
| :---------------------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Package Import**            | `import firestorm from "firestorm-db"`        | `import { createFirestorm, ID_FIELD } from "firestorm-db"`                        |
| **Instance Init**             | `firestorm.create({ address, token })`        | `createFirestorm({ address, token })`                                             |
| **Define Collection**         | `instance.collection("users", addMethods)`    | `instance.collection({ name: "users", transform })`                               |
| **Define Document**           | _(Use Collection)_                            | `instance.document({ name: "settings" })`                                         |
| **Access Document Key**       | `item.id` or `item[instance.ID_FIELD]`        | `item[ID_FIELD]` (Symbol)                                                         |
| **Item Type Helper**          | `WithID<User>`                                | `CollectionItem<User>`                                                            |
| **Get File**                  | `instance.files.get("file.txt")`              | `instance.files.get({ path: "file.txt" })`                                        |
| **Upload File**               | `instance.files.upload("f.txt", blob, true)`  | `instance.files.post({ body: formData })`                                         |
| **Append Text**               | `instance.files.append("f.txt", "str", true)` | `instance.files.patch({ path: "f.txt", body: "str", options: { create: true } })` |
| **Put / Write Text**          | _(N/A)_                                       | `instance.files.put({ path: "f.txt", body: "str" })`                              |
| **Delete File**               | `instance.files.delete("file.txt")`           | `instance.files.delete({ path: "file.txt" })`                                     |
| **File Exists / Move / Copy** | _(N/A)_                                       | `instance.files.exists()`, `.move()`, `.copy()`                                   |
| **Error Handling**            | `catch (err: AxiosError)`                     | `catch (err: FirestormError)`                                                     |
| **PHP Version**               | PHP 7.4+                                      | **PHP 8.2+** (PHP 8.5 recommended)                                                |
