import { ResourceManager } from "../managers/resource.ts";
import { ID_FIELD } from "../types/utils.ts";

import type { Firestorm } from "../instance.ts";
import type { EditFieldOption } from "../types/editFieldOption.ts";
import type { SearchOption, SearchResultOptions } from "../types/searchOption.ts";
import type { SelectOption } from "../types/selectOption.ts";
import type { CollectionItem, Confirmation, IdEncoding } from "../types/utils.ts";
import type { ValueOption, ValueReturnType } from "../types/valueOption.ts";
import type { ResourceLike } from "../utils.ts";

/**
 * Configuration options for creating a Collection resource.
 */
export interface CollectionOptions<
	Raw extends Record<string, unknown> = Record<string, unknown>,
	Transformed = CollectionItem<Raw>,
> {
	/** Name of the collection stored in Firestorm */
	name: string;
	/** Transformation function applied to query results */
	transform?: (el: CollectionItem<Raw>, collection: Collection<Raw, Transformed>) => Transformed;
}

/**
 * Represents a Firestorm Collection resource with a Raw (pre-transform) -> Transformed (post-transform) architecture.
 * @template Raw - Base collection element type (write type).
 * @template Transformed - Transformed element type returned by queries (read type).
 */
export class Collection<
	Raw extends Record<string, unknown> = Record<string, unknown>,
	Transformed = CollectionItem<Raw>,
> implements ResourceLike {
	protected readonly manager: ResourceManager;
	private readonly transformFn: (
		el: CollectionItem<Raw>,
		collection: Collection<Raw, Transformed>,
	) => Transformed;

	/**
	 * @param instance - Root Firestorm instance.
	 * @param options - Configuration options (name, transform).
	 */
	constructor(instance: Firestorm, options: CollectionOptions<Raw, Transformed>) {
		if (typeof options !== "object" || options === null) {
			throw new TypeError("Collection options must be an object");
		}
		const name = options.name;
		if (!name) {
			throw new Error("Collection must have a name");
		}
		this.manager = new ResourceManager(instance, name);
		if (options.transform !== undefined && typeof options.transform !== "function") {
			throw new TypeError("Collection transform must be a function");
		}

		this.transformFn = options.transform ?? ((el) => el as unknown as Transformed);
	}

	/**
	 * Access the root Firestorm instance.
	 */
	public get instance(): Firestorm {
		return this.manager.instance;
	}

	/**
	 * Name of the collection.
	 */
	public get name(): string {
		return this.manager.resourceName;
	}

	/**
	 * Returns the SHA-1 hash of the JSON.
	 * - Can be used to compare file content without downloading the file.
	 *
	 * @returns The SHA-1 hash of the JSON.
	 */
	public sha1(): Promise<string> {
		return this.manager.get<string>({ path: "sha1", options: { objectLike: false } });
	}

	/**
	 * Fluent helper to transform collection items into another representation.
	 * @template NextTransformed - Type of the new transformed element.
	 * @param transformFn - Transformation function that takes the current transformed element.
	 * @returns A new Collection instance with the updated Transformed type.
	 */
	public transform<NextTransformed>(
		transformFn: (el: Transformed, collection: Collection<Raw, Transformed>) => NextTransformed,
	): Collection<Raw, NextTransformed> {
		return new Collection<Raw, NextTransformed>(this.instance, {
			name: this.name,
			transform: (rawWithId) => transformFn(this.applyTransformation(rawWithId), this),
		});
	}

	/**
	 * Identify the element by its key and add the ID field
	 * @param el - The element to identify
	 * @param key - The key to identify the element
	 * @returns The element with the ID field added
	 */
	private withId<T extends Record<string, unknown>>(el: T, key: IdEncoding): CollectionItem<T> {
		(el as Record<string | symbol, unknown>)[ID_FIELD] = String(key);
		return el as CollectionItem<T>;
	}

	/**
	 * Apply configured transformation to item with injected ID
	 */
	private applyTransformation(el: CollectionItem<Raw>): Transformed {
		return this.transformFn(el, this);
	}

	/**
	 * Get an element from the collection by its key
	 * @param key - The key of the element to retrieve
	 * @returns The element with the specified key
	 */
	public async get(key: IdEncoding): Promise<Transformed> {
		const item = await this.manager.get<Raw>({
			path: "get",
			params: { id: key },
			options: { objectLike: false },
		});
		return this.applyTransformation(this.withId(item, key));
	}

	/**
	 * Get multiple elements from the collection by their keys
	 * @param keys - Array of keys to search
	 * @returns The found elements
	 */
	public async searchKeys(keys: IdEncoding[]): Promise<Transformed[]> {
		if (!Array.isArray(keys)) throw new TypeError("Keys must be an array");

		const res = await this.manager.get<Record<string, Raw>>({
			path: "searchKeys",
			params: { search: keys },
		});

		return Object.entries(res).map(([id, value]) =>
			this.applyTransformation(this.withId(value, id)),
		);
	}

	/**
	 * Search through the collection
	 * @param options - Array of search options
	 * @param resultOptions - Search result options (limit, random seed/boolean)
	 * @returns The found elements
	 */
	public async search(
		options: SearchOption<Raw>[],
		resultOptions?: boolean | number | SearchResultOptions,
	): Promise<Transformed[]> {
		if (!Array.isArray(options)) throw new TypeError("Search options must be an array");

		if (
			resultOptions !== undefined &&
			typeof resultOptions !== "number" &&
			typeof resultOptions !== "boolean" &&
			typeof resultOptions !== "object"
		)
			throw new TypeError("Incorrect search result options");

		let random: boolean | number | undefined = false;
		let limit: number | undefined = undefined;

		if (typeof resultOptions === "object" && resultOptions !== null) {
			random = resultOptions.random ?? false;
			limit = resultOptions.limit;
		} else if (typeof resultOptions === "boolean" || typeof resultOptions === "number") {
			random = resultOptions;
		}

		if (
			limit !== undefined &&
			(typeof limit !== "number" || limit <= 0 || !Number.isInteger(limit))
		)
			throw new TypeError(
				`${JSON.stringify(limit)} search option limit must be a positive integer`,
			);

		if (
			random !== undefined &&
			random !== false &&
			random !== true &&
			(typeof random !== "number" || !Number.isInteger(random))
		)
			throw new TypeError(
				`${JSON.stringify(random)} search option random must be a boolean or an integer`,
			);

		options.forEach((op) => {
			const option = op as Record<string, unknown>;
			if (option.field === undefined || option.criteria === undefined || option.value === undefined)
				throw new TypeError("Missing fields in search options array");

			if (typeof option.field !== "string")
				throw new TypeError("Search option field must be a string");

			if (option.criteria === "in" && !Array.isArray(option.value))
				throw new TypeError("Search option value must be an array when criteria is 'in'");
		});

		const params: Record<string, unknown> = {
			search: options,
		};

		if (limit !== undefined) {
			params.limit = limit;
		}

		if (random !== undefined && random !== false) {
			if (random === true) {
				params.random = {};
			} else {
				const seed = parseInt(String(random));
				params.random = { seed };
			}
		}

		const res = await this.manager.get<Record<string, Raw>>({
			path: "search",
			params,
		});
		return Object.entries(res).map(([id, item]) => this.applyTransformation(this.withId(item, id)));
	}

	/**
	 * Read the raw content of the collection.
	 *
	 * @remarks
	 * If you find yourself using `readRaw(true)` (i.e. without ID injection or relational entities),
	 * you probably should use a {@link Document} instead of a {@link Collection}.
	 *
	 * @param original - If true, original raw JSON format is returned without ID injection
	 * @returns An object with keys and elements
	 */
	public async readRaw(original?: false): Promise<Record<string, Transformed>>;
	public async readRaw(original: true): Promise<Record<string, Raw>>;
	public async readRaw(
		original = false,
	): Promise<Record<string, Transformed> | Record<string, Raw>> {
		const res = await this.manager.get<Record<string, Raw>>({
			path: "readRaw",
			options: { objectLike: false },
		});
		if (original) {
			return res;
		}

		const formattedResult: Record<string, Transformed> = {};
		Object.entries(res).forEach(([key, item]) => {
			formattedResult[key] = this.applyTransformation(this.withId(item, key));
		});

		return formattedResult;
	}

	/**
	 * Set the entire content of the collection. Very dangerous!
	 * @param value - The value you want to write
	 * @returns Mutation confirmation
	 */
	public writeRaw(value: Record<string, Raw>): Promise<Confirmation> {
		if (value === undefined || value === null)
			throw new TypeError("writeRaw value cannot be undefined or null");

		return this.manager.post<Confirmation>({
			path: "writeRaw",
			body: value,
		});
	}

	/**
	 * Get only selected fields from the collection
	 * @template K - Allowed keys from the collection item
	 * @param option - The select option object
	 * @returns An object with keys and selected elements
	 */
	public async select<K extends keyof Raw>(
		option: SelectOption<Raw, K>,
	): Promise<Record<string, CollectionItem<Pick<Raw, K>>>> {
		const params: Record<string, unknown> = { select: option ?? {} };

		if (option?.search !== undefined) {
			params.search = option.search;
		}

		const data = await this.manager.get<Record<string, Pick<Raw, K>>>({
			path: "select",
			params,
		});
		const result: Record<string, CollectionItem<Pick<Raw, K>>> = {};

		Object.entries(data).forEach(([key, item]) => {
			result[key] = this.withId(item, key);
		});

		return result;
	}

	/**
	 * Get all distinct non-null values for a given key across a collection
	 * @param option - The value option object
	 * @returns An array with distinct non-null values for this key
	 */
	public async values<Key extends keyof Raw, Flatten extends boolean = false>(
		option: ValueOption<Raw, Key, Flatten>,
	): Promise<ValueReturnType<Raw, Key, Flatten>> {
		if (!option) throw new TypeError("Value option must be provided");
		if (typeof option.field !== "string") throw new TypeError("Field must be a string");
		if (option.flatten !== undefined && typeof option.flatten !== "boolean")
			throw new TypeError("Flatten must be a boolean");

		const data = await this.manager.get<Record<string, unknown>>({
			path: "values",
			params: { values: option },
			options: { objectLike: false },
		});

		return Object.values(data).filter((d) => d !== null) as ValueReturnType<Raw, Key, Flatten>;
	}

	/**
	 * Read random collection elements
	 * @param max - Maximum number of elements to retrieve (default: -1)
	 * @param seed - Optional random seed
	 * @param offset - Offset for pagination (default: 0)
	 * @returns Random elements
	 */
	public async random(max?: number, seed?: number, offset?: number): Promise<Transformed[]> {
		const params: Record<string, number> = {};

		if (max !== undefined) {
			if (typeof max !== "number" || !Number.isInteger(max) || max < -1)
				throw new TypeError("Expected integer >= -1 for the max");

			params.max = max;
		}

		if (offset !== undefined) {
			if (seed === undefined && offset !== undefined)
				throw new TypeError("You can't put an offset without a seed");

			if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0)
				throw new TypeError("Expected integer >= 0 for the offset");
		}

		if (seed !== undefined) {
			if (typeof seed !== "number" || !Number.isInteger(seed))
				throw new TypeError("Expected integer for the seed");

			params.seed = seed;
			params.offset = offset ?? 0;
		}

		const data = await this.manager.get<Record<string, Raw>>({
			path: "random",
			params: { random: params },
		});

		return Object.entries(data).map(([key, item]) =>
			this.applyTransformation(this.withId(item, key)),
		);
	}

	/**
	 * Add a value to the collection
	 * @param value - The value to add
	 * @returns The generated key for the added element
	 */
	public async add(value: Raw): Promise<string> {
		const res = await this.manager.post<{ id: string }>({
			path: "add",
			body: value,
		});
		return res.id;
	}

	/**
	 * Add multiple values to the collection
	 * @param values - The values to add
	 * @returns The generated keys of the added elements
	 */
	public async addBulk(values: Raw[]): Promise<string[]> {
		const res = await this.manager.post<{ ids: string[] }>({
			path: "addBulk",
			body: values,
			options: { multiple: true },
		});
		return res.ids;
	}

	/**
	 * Delete an entry by its key
	 * @param key - The key of the entry to remove
	 * @returns Mutation confirmation
	 */
	public remove(key: IdEncoding): Promise<Confirmation> {
		return this.manager.delete<Confirmation>({
			path: "remove",
			body: String(key),
			options: { multiple: false },
		});
	}

	/**
	 * Delete multiple entries by their keys
	 * @param keys - The keys of the entries to remove
	 * @returns Mutation confirmation
	 */
	public removeBulk(keys: IdEncoding[]): Promise<Confirmation> {
		return this.manager.delete<Confirmation>({
			path: "removeBulk",
			body: keys.map(String),
			options: { multiple: true },
		});
	}

	/**
	 * Set a value in the collection by key
	 * @param key - The key of the element you want to edit
	 * @param value - The value you want to edit
	 * @returns Mutation confirmation
	 */
	public set(key: IdEncoding, value: Raw): Promise<Confirmation> {
		return this.manager.put<Confirmation>({
			path: "set",
			body: value,
			options: {
				multiple: false,
				additionalData: { key: String(key) },
			},
		});
	}

	/**
	 * Set multiple values in the collection by their keys
	 * @param keys - The keys of the elements you want to edit
	 * @param values - The values you want to edit
	 * @returns Mutation confirmation
	 */
	public setBulk(keys: IdEncoding[], values: Raw[]): Promise<Confirmation> {
		return this.manager.put<Confirmation>({
			path: "setBulk",
			body: values,
			options: {
				multiple: true,
				additionalData: { keys: keys.map(String) },
			},
		});
	}

	/**
	 * Edit an element's field in the collection
	 * @param option - The edit object
	 * @returns Mutation confirmation
	 */
	public editField(option: EditFieldOption<Raw>): Promise<Confirmation> {
		return this.manager.patch<Confirmation>({
			path: "editField",
			body: option,
			options: { multiple: false },
		});
	}

	/**
	 * Edit multiple elements' fields in the collection
	 * @param options - The edit objects
	 * @returns Mutation confirmation
	 */
	public editFieldBulk(options: EditFieldOption<Raw>[]): Promise<Confirmation> {
		return this.manager.patch<Confirmation>({
			path: "editFieldBulk",
			body: options,
			options: { multiple: true },
		});
	}
}
