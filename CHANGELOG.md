# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `Collections.values` method, which get all existing values for a given key across a collection.
- File handler types.

### Changed

- File operations now extract the Axios request like all other requests.
- Use JSDoc links consistently.
- Replaced broken `NoMethods` type with more useful `RemoveMethods` type.
- Distinguish between `add` and `set` operations with `id` field.

### Fixed

- Incorrect `editField` and `editFieldBulk` return types.
- Clarify some operations in the README.md.

## [1.11.1] - 2024-02-12

### Fixed

- Write methods being annotated as returning elements rather than confirmations
- Missing `Collection.select` return type.
- Make the JavaScript and TypeScript JSDoc entirely consistent.
- Fix file namespace being declared as an abstract class rather than a constant object.

## [1.11.0] - 2023-12-17

### Changed

- Deprecated `read_raw` and `write_raw` methods in favor of their camelCased counterparts.
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

- crypto module as it is now deprecated and a built-in package of node
