# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-27

### Added

- **Collision-Free `ID_FIELD` Unique Symbol**: Transitioned `ID_FIELD` from a `"id"` string constant to a global `unique symbol` (`Symbol.for("firestorm.id")`). Document keys attached by Firestorm are indexed via `item[ID_FIELD]`, guaranteeing zero collisions with document schema fields (even if documents have their own `id` property) and native exclusion from `JSON.stringify` during writes.
- **Native TypeScript Rewrite**: Complete client library ported to TypeScript with ESM modules, generated type definitions (`dist/`), and comprehensive type tests.
- **Raw $\rightarrow$ Transformed Pipeline Architecture**: Transitioned `Collection` (`Collection<Raw, Transformed>`) and `Document` (`Document<Raw, Transformed>`) to a pre-transform (`Raw`) and post-transform (`Transformed`) generic architecture. Write methods accept `Raw` types while read methods return `Transformed` types, enabling OOP class instantiation, field stripping/sanitization, and fluent chaining via `.transform()`.
- **Document Resource**: Dedicated `Document` class (`instance.document(...)`) for managing standalone key-value or configuration documents with deep dot-path mutation support.
- **Request Encapsulation**: `ResourceManager` component encapsulating HTTP communication (`getRequest`, `postRequest`), endpoint resolution, token management, and payload serialization.
- **Extended File Operations**: Added `instance.files.copy()`, `instance.files.move()`, `instance.files.exists()`, and `instance.files.append()` methods.
- **Cryptographically Secure Keys**: Added `$secureKeys` configuration to `JSONDatabase` for generating cryptographically secure random unique IDs.
- **Structured Error Handling**: Added `FirestormError` class carrying complete `ResponseDetails` (HTTP status code, headers, and parsed payload) with automatic wrapping of HTML/string server errors.
- **PHP 8.5 Modernization & Backport Polyfills**: Fully modernized server codebase to PHP 8.5 standards with a dedicated backward-compatibility polyfill layer (`src/server/polyfills/polyfills.php` and root `composer.json` supporting `symfony/polyfill-php83`, `symfony/polyfill-php84`, and `symfony/polyfill-php85`). Introduces backed Enums (`SearchCriteria`, `EditOperation`, `ReadCommand`, `WriteCommand`), Constructor Property Promotion, `readonly` properties, `#[\Override]`, First-Class Callables (`$fn(...)`), strict `match` expressions, modern `\Random\Randomizer` engines, and high-performance native `array_is_list()`, `array_any()`, `array_all()`, and `json_validate()`.
- **Refined Search & Filter Criteria**: Dedicated `ComparisonCriteria`, `BooleanCriteria`, `NumberCriteria`, `StringCriteria`, and `ArrayCriteria` types.

### Changed

- Simplified `Collection<Raw, Transformed>` and `CollectionOptions<Raw, Transformed>` by eliminating the 3rd generic `ItemIdField` and the `idField` configuration option.
- Migrated server requirements to PHP 8.2+ with strict typing and support for named constructor arguments in `JSONDatabase`.
- Refactored `FileAccess` file locking to provide descriptive error context including file paths on lock or descriptor failure.
- Streamlined `createFirestorm()` factory export and removed global state and global methods.
- Decoupled `Collection` and `Document` from server endpoint URLs by delegating all operations to `ResourceManager`.
- Replaced manual extension loops across backend file endpoints with centralized `check_file_extension()` validator.
- Made `Collection` and `Document` constructors as well as `instance.collection()` and `instance.document()` object-only, requiring a configuration object (`{ name: string, ... }`) rather than positional string/callback arguments.

### Removed

- Removed `ItemIdField` generic parameter and `idField` option from collections in favor of the collision-free `ID_FIELD` unique symbol.
- Removed legacy global state and `firestorm.table()` alias in favor of `instance.collection()`.
- Removed legacy `addMethods` positional callback in favor of the unified `Raw -> Transformed` architecture with `.transform()`.

## [1.15.0] - 2026-07-19

### Added

- `Firestorm.clientVersion` field.
- `Firestorm.serverVersion` getter (returns a `Promise<string>`).
- `Firestorm.name` instance field, for debugging purposes.

### Changed

- Multiple Firestorm instances with different configurations at the same time are now possible.
- On top of the existing legacy methods, you can use the `firestorm.create` function to create a unique instance first.
- Instances can now use getter/setter for `address` and `token` or can be set directly as a parameter in the `create` method.
- Instance can now have their own `ID_FIELD` rather than using the global attribute.
- Add methods now receive the collection instance as a second parameter, since `ID_FIELD` is now attached to the instance rather than globally.
- Added `WithID` helper type, which adds the ID field to the input type.
- Separated and cleaned up PHP folder structure.

## [1.14.0] - 2026-04-06

### Added

- `limit` search result options.
- `array-contains-all` option for array fields.
- `Collection.search` option now has a `limit` option, compatible with `random` to restrict the number of elements displayed

### Changed

- Collection type must always have an ID field.
- Changed PHP file representation from an associative array to a strongly-typed FileObject class.
- Reduced payload size for `Collection.get`.
- Use modern async/await for client code (supported in all major browers/Node.js since 2017).
- Made `firestorm.files.get` a generic method for increased type safety.
- Stricter type checking for `array-contains` search methods.
- Mixed arrays of strings and numbers are allowed in all bulk Firestorm methods.

### Fixed

- Fixed `ID_FIELD` TypeScript type.
- Updated dependencies.

## [1.13.0] - 2024-05-09

### Added

- Exposed `Collection.collectionName` as a readonly property for TypeScript usage.
- TypeScript overview to the README.
- Optional replacement argument for `array-splice` edit fields.
- `array-contains-none` option for array fields.
- Optional constructor for the `JSONDatabase` PHP class to reduce repetitive code.
- "Advanced" section to the README for previously undocumented features.
- `original` option for `readRaw` to not insert ID fields, for easier non-relational collection usage.

### Changed

- Rejected incorrect parameters are now `TypeError`s instead of regular `Error`s.
- Deprecated `firestorm.table(name)` method, since `firestorm.collection(name)` does exactly the same thing.
- Reformatted the repository and improved README.md to make it easier to set up Firestorm.
- Clean up and standardize JSDoc comments.
- `editField` and `editFieldBulk` now return confirmations like all other write methods.
- `editField` and `editFieldBulk` now reject with a descriptive error message on failure rather than silently failing.

### Fixed

- PHP-level errors not being rejected properly in GET requests.
- Certain write commands mutating data internally and affecting parameters outside Firestorm.
- `Collection.searchKeys` and `Collection.values` not returning proper `Error` objects sometimes.
- `files.upload` not allowing the `form-data` package's typing of `FormData` in TypeScript.
- Inconsistent use of indentation and formatting in PHP files.
- Various typos in PHP files.
- `Collection` class being exported in TypeScript despite the actual class being private.
- `array-splice` edit fields being incorrectly typed as `array-slice`.
- Platform-specific PHP error when searching nested keys.
- `Collection.remove` rejecting numeric keys, despite `Collection.removeBulk` not doing so.
- `editField` and `editFieldBulk` validation issues.

## [1.12.0] - 2024-02-22

### Added

- `Collection.values` method, which gets all distinct non-null values for a given key across a collection.

### Changed

- Refactored JavaScript part to be less verbose and reuse existing code better.
- Added JSDoc `{@link }` properties.
- Cleaned up and clarified README.md.
- Renamed `AllCriteria` to `AnyCriteria` to be more accurate.
- Replaced broken `NoMethods<T>` type with a more generalized `RemoveMethods<T>` type.
- Replaced `Writable<T>` with more specific `Settable<T>` and `Addable<T>` types for set and add operations respectively.
- `Collection.select` now picks the correct return parameters directly instead of returning a partial object.

### Fixed

- Ran everything through a spelling checker.
- Method fields are no longer shown as valid in searches and selections.
- `Collection.editField` and `Collection.editFieldBulk` now return confirmations like the other write methods.
- `files.upload` and `files.delete` extract the Axios request and return `WriteConfirmation`s like all other methods.

## [1.11.1] - 2024-02-12

### Fixed

- Write methods being annotated as returning elements rather than confirmations
- Missing `Collection.select` return type.
- Make the JavaScript and TypeScript JSDoc entirely consistent.
- Fix file namespace being declared as an abstract class rather than a constant object.

## [1.11.0] - 2023-12-17

### Changed

- Deprecated `Collection.read_raw` and `Collection.write_raw` methods in favor of their camelCased counterparts.
- Changed type casing style to PascalCase everywhere.
- Use ES6 method notation everywhere.

### Removed

- `Raw<T>` type in favor of `Record<K, V>`.

### Fixed

- Broken Exception types
- Prettier not running on TypeScript files
- Nested keys not being typed properly
- Fix file namespace

## [1.10.3] - 2023-11-01

### Added

- Prettier

### Fixed

- Updated and cleaned up README.md
- Fixed types being placed under wrong namespace

## [1.10.2] - 2023-07-21

### Changed

- Updated README.md with working badges
- Moved to pnpm for dependency version w/ tests

### Removed

- `crypto` module as it is now deprecated and a built-in node package
