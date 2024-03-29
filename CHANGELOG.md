# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.12.0]

### Added

- `Collection.values` method, which gets all distinct non-null values for a given key across a collection.

### Changed

- Refactored JavaScript part to be less verbose and reuse existing code better.
- Use JSDoc `{@link }` properties.
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

- crypto module as it is now deprecated and a built-in node package
