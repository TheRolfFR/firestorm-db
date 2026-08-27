import { ResourceManager } from "./resource.ts";
import type { ResourceLike } from "./utils.ts";
import type { Firestorm } from "./instance.ts";
import type { SearchOption, SearchResultOptions } from "./types/searchOption.ts";
import type { SelectOption } from "./types/selectOption.ts";
import type { ValueOption, ValueReturnType } from "./types/valueOption.ts";
import type { EditFieldOption } from "./types/editFieldOption.ts";
import type { CollectionItem, IdEncoding, WriteConfirmation } from "./types/utils.ts";
import { ID_FIELD } from "./types/utils.ts";

/**
 * Configuration options for creating a Collection resource.
 */
export interface CollectionOptions<
	Raw extends Record<string, any> = Record<string, any>,
	Transformed = CollectionItem<Raw>,
> {
	/** Name of the collection stored in Firestorm */
	name: string;
	/** Transformation function applied to query results */
	transform?: (el: CollectionItem<Raw>, collection: Collection<Raw, Transformed>) => Transformed;
}

/**
 * Represents a Firestorm Collection resource with a Raw (pre-transform) -> Transformed (post-transform) architecture.
 * @template Raw - Type of the stored documents in the collection (write type).
 * @template Transformed - Type of the transformed elements returned by queries (read type).
 */
export class Collection<
	Raw extends Record<string, any> = Record<string, any>,
	Transformed = CollectionItem<Raw>,
> implements ResourceLike {
	public readonly manager: ResourceManager;
	private readonly transformFn?: (
		el: CollectionItem<Raw>,
		collection: Collection<Raw, Transformed>,
	) => Transformed;

	/**
	 * @param instance - Root Firestorm instance.
	 * @param options - Collection configuration options object.
	 */
	constructor(instance: Firestorm, options: CollectionOptions<Raw, Transformed>) {
		if (typeof options !== "object" || options === null) {
			throw new TypeError("Collection options must be an object");
		}

		const name = options.name;
		if (!name) {
			throw new Error("Resource must have a name");
		}

		this.manager = new ResourceManager(instance, name);

		if (options.transform && typeof options.transform !== "function") {
			throw new TypeError("Collection transform must be a function");
		}

		if (options.transform) {
			this.transformFn = options.transform;
		}
	}

	/**
	 * Firestorm instance managing this collection.
	 */
	public get instance(): Firestorm {
		return this.manager.instance;
	}

	/**
	 * Name of the collection.
	 */
	public get collectionName(): string {
		return this.manager.collectionName;
	}

	/**
	 * Read API endpoint address (get.php)
	 */
	public get readAddress(): string {
		return this.manager.readAddress;
	}

	/**
	 * Write API endpoint address (post.php)
	 */
	public get writeAddress(): string {
		return this.manager.writeAddress;
	}

	/**
	 * Returns the SHA-1 hash of the collection JSON.
	 */
	public async sha1(): Promise<string> {
		return this.manager.sha1();
	}

	/**
	 * Fluent helper to transform collection items into another representation.
	 * @template NextTransformed - Type of the new transformed element.
	 * @param transformFn - Transformation function that takes the current transformed element.
	 * @returns A new Collection instance with the updated Transformed type.
	 */
	public transform<NextTransformed>(
		transformFn: (el: Transformed, collection: Collection<Raw, NextTransformed>) => NextTransformed,
	): Collection<Raw, NextTransformed> {
		const prevTransform = this.transformFn;
		const chainedFn = (
			rawWithId: CollectionItem<Raw>,
			col: Collection<Raw, NextTransformed>,
		): NextTransformed => {
			const current = prevTransform
				? prevTransform(rawWithId, this as unknown as Collection<Raw, Transformed>)
				: (rawWithId as unknown as Transformed);
			return transformFn(current, col);
		};

		return new Collection<Raw, NextTransformed>(this.instance, {
			name: this.collectionName,
			transform: chainedFn,
		});
	}

	/**
	 * Identify the element by its key and add the ID field
	 * @param el - The element to identify
	 * @param key - The key to identify the element
	 * @returns The element with the ID field added
	 */
	private withId(el: Raw, key: IdEncoding): CollectionItem<Raw>;
	private withId(el: Partial<Raw>, key: IdEncoding): CollectionItem<Partial<Raw>>;
	private withId<K extends keyof Raw>(
		el: Pick<Raw, K>,
		key: IdEncoding,
	): CollectionItem<Pick<Raw, K>>;
	private withId<K extends keyof Raw>(
		el: Raw | Partial<Raw> | Pick<Raw, K>,
		key: IdEncoding,
	): CollectionItem<Raw> | CollectionItem<Partial<Raw>> | CollectionItem<Pick<Raw, K>> {
		(el as Record<string | symbol, unknown>)[ID_FIELD] = String(key);
		return el as CollectionItem<Raw>;
	}

	/**
	 * Apply configured transformation to item with injected ID
	 */
	private applyTransform(el: CollectionItem<Raw>): Transformed {
		if (!this.transformFn) return el as unknown as Transformed;
		return this.transformFn(el, this);
	}

	/**
	 * Get an element from the collection by its key
	 * @param key - The key of the element to retrieve
	 * @returns The element with the specified key
	 */
	public async get(key: IdEncoding): Promise<Transformed> {
		const item = await this.manager.getRequest<Raw>("get", { id: key }, false);
		const itemWithId = this.withId(item, key);

		return this.applyTransform(itemWithId);
	}

	/**
	 * Get multiple elements from the collection by their keys
	 * @param keys - Array of keys to search
	 * @returns The found elements
	 */
	public async searchKeys(keys: IdEncoding[]): Promise<Transformed[]> {
		if (!Array.isArray(keys)) throw new TypeError("Keys must be an array");

		const res = await this.manager.getRequest<Record<string, Raw>>("searchKeys", {
			search: keys,
		});

		return Object.entries(res).map(([id, value]) => this.applyTransform(this.withId(value, id)));
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

		const res = await this.manager.getRequest<Record<string, Raw>>("search", params);
		return Object.entries(res).map(([id, item]) => this.applyTransform(this.withId(item, id)));
	}

	/**
	 * Read the raw content of the collection
	 * @param original - If true, original raw JSON format is returned without ID injection
	 * @returns An object with keys and elements
	 */
	public async readRaw(original?: false): Promise<Record<string, Transformed>>;
	public async readRaw(original: true): Promise<Record<string, Raw>>;
	public async readRaw(
		original = false,
	): Promise<Record<string, Transformed> | Record<string, Raw>> {
		const res = await this.manager.getRequest<Record<string, Raw>>("readRaw", {}, false);
		if (original) {
			return res;
		}

		const formattedResult: Record<string, Transformed> = {};
		Object.entries(res).forEach(([key, item]) => {
			formattedResult[key] = this.applyTransform(this.withId(item, key));
		});

		return formattedResult;
	}

	/**
	 * Set the entire content of the collection. Very dangerous!
	 * @param value - The value you want to write
	 * @returns Write confirmation
	 */
	public async writeRaw(value: Record<string, Raw>): Promise<WriteConfirmation> {
		if (value === undefined || value === null)
			throw new TypeError("writeRaw value cannot be undefined or null");

		return this.manager.postRequest<WriteConfirmation>("writeRaw", value);
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

		const data = await this.manager.getRequest<Record<string, Pick<Raw, K>>>("select", params);
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

		const data = await this.manager.getRequest<Record<string, unknown>>(
			"values",
			{ values: option },
			false,
		);

		return Object.values(data).filter((d) => d !== null) as unknown as ValueReturnType<
			Raw,
			Key,
			Flatten
		>;
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

		const data = await this.manager.getRequest<Record<string, Raw>>("random", {
			random: params,
		});
		return Object.entries(data).map(([key, item]) => this.applyTransform(this.withId(item, key)));
	}

	/**
	 * Add a value to the collection
	 * @param value - The value to add
	 * @returns The generated key for the added element
	 */
	public async add(value: Raw): Promise<string> {
		const res = await this.manager.postRequest<{ id: string }>("add", value);
		return res.id;
	}

	/**
	 * Add multiple values to the collection
	 * @param values - The values to add
	 * @returns The generated keys of the added elements
	 */
	public async addBulk(values: Raw[]): Promise<string[]> {
		const res = await this.manager.postRequest<{ ids: string[] }>("addBulk", values, true);
		return res.ids;
	}

	/**
	 * Remove an element from the collection by its key
	 * @param key The key from the entry to remove
	 * @returns Write confirmation
	 */
	public async remove(key: IdEncoding): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("remove", String(key), false);
	}

	/**
	 * Remove multiple elements from the collection by their keys
	 * @param keys The key from the entries to remove
	 * @returns Write confirmation
	 */
	public async removeBulk(keys: IdEncoding[]): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("removeBulk", keys.map(String), true);
	}

	/**
	 * Set a value in the collection by key
	 * @param key - The key of the element you want to edit
	 * @param value - The value you want to edit
	 * @returns Write confirmation
	 */
	public async set(key: IdEncoding, value: Raw): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("set", value, false, {
			key: String(key),
		});
	}

	/**
	 * Set multiple values in the collection by their keys
	 * @param keys - The keys of the elements you want to edit
	 * @param values - The values you want to edit
	 * @returns Write confirmation
	 */
	public async setBulk(keys: IdEncoding[], values: Raw[]): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("setBulk", values, true, {
			keys: keys.map(String),
		});
	}

	/**
	 * Edit an element's field in the collection
	 * @param option - The edit object
	 * @returns Edit confirmation
	 */
	public async editField(option: EditFieldOption<Raw>): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("editField", option, false);
	}

	/**
	 * Edit multiple elements' fields in the collection
	 * @param options - The edit objects
	 * @returns Edit confirmation
	 */
	public async editFieldBulk(options: EditFieldOption<Raw>[]): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("editFieldBulk", options, true);
	}
}
