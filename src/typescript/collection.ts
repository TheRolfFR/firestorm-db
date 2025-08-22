import axios from "axios";

import { GET, ID_FIELD_NAME, token, POST } from "./settings.js";
import { extractData } from "./utils.js";

import type { SearchOption } from "./types/searchOption.js";
import type { SelectOption } from "./types/selectOption.js";
import type { ValueOption } from "./types/valueOption.js";
import type { Id, ItemBase, MaybeArray, MethodsOnly, WriteConfirmation } from "./types/utils.js";
import type { EditFieldOption } from "./types/editFieldOption.js";

/**
 * Represents a Firestorm Collection.
 * @template Item - Type of the documents in the collection.
 */
export class Collection<
	Item extends ItemBase,
	ItemMethods extends MethodsOnly<ItemMethods> = Record<string, never>,
> {
	/**
	 * @param name - Name of the collection stored in Firestorm.
	 * @param methods - Optional methods to add to the collection elements when retrieved.
	 */
	constructor(
		private readonly name: string,
		private readonly methods?: (el: Item) => ItemMethods,
	) {
		if (!name) throw new Error("Collection must have a name");
		if (methods && typeof methods !== "function")
			throw new TypeError("Collection addMethods must be a function");
	}

	/**
	 * Identify the element by its key and add the ID field
	 * @param el - The element to identify
	 * @param key - The key to identify the element
	 * @returns The element with the ID field added
	 */
	private identify(el: Item, key: Id): Item;
	private identify(el: Partial<Item>, key: Id): Partial<Item>;
	private identify(el: Item | Partial<Item>, key: Id): Item | Partial<Item> {
		el[ID_FIELD_NAME] = String(key);
		return el;
	}

	/**
	 * Add methods to the element if they were provided in the constructor
	 * @param el - The element to which methods will be added
	 * @returns The element with added methods (if any were provided)
	 */
	private addMethods(el: Item): Item & ItemMethods;
	private addMethods(el: Partial<Item>): Partial<Item> & ItemMethods;
	private addMethods(el: Item | Partial<Item>): (Item | Partial<Item>) & ItemMethods {
		if (!this.methods) return el as Item & ItemMethods;

		return {
			...el,
			...this.methods(el as Item),
		};
	}

	/**
	 * Send GET request with the provided data and return extracted response
	 * @param command - The read command name
	 * @param params - Body data
	 * @param objectLike - Reject if an object or array isn't being returned
	 * @returns Extracted response
	 */
	private async getRequest<ReturnType>(
		command: string,
		params: Record<string, any>,
		objectLike = true,
	): Promise<ReturnType> {
		const obj = {
			collection: this.name,
			command: command,
			...params,
		};

		const req = axios.get(GET(), { data: obj });
		const res = await extractData<ReturnType>(req);

		if (objectLike && typeof res !== "object") throw res;
		return res;
	}

	/**
	 * Generate POST data with provided data
	 * @private
	 * @ignore
	 * @param command - The write command name
	 * @param value - The value for the command
	 * @param multiple - Used to delete multiple
	 * @returns Write data object
	 */
	private writeData(
		command: string,
		value: Record<string, Item> | MaybeArray<Item> | MaybeArray<Id> | MaybeArray<EditFieldOption<Item>> | undefined = undefined,
		multiple: undefined | null | boolean = false,
	) {
		const obj: Record<string, unknown> = {
			token: token(),
			collection: this.name,
			command: command,
		};

		// clone/serialize data if possible (prevents mutating data)
		if (value) value = JSON.parse(JSON.stringify(value));

		if (multiple && Array.isArray(value)) {
			value.forEach((v) => {
				if (typeof v === "object" && !Array.isArray(v) && v != null) {
					// @ts-expect-error -ID_FIELD_NAME is readonly in ItemBase but we need to 
					// delete it here as we don't store it server-side
					delete v[ID_FIELD_NAME];
				}
			});
		} 
		
		else if (
			multiple === false &&
			value !== null &&
			value !== undefined &&
			typeof value !== "number" &&
			typeof value !== "string" &&
			!Array.isArray(value)
		) {
			if (typeof value === "object") value = { ...value };

			// @ts-expect-error -ID_FIELD_NAME is readonly in ItemBase but we need to 
			// delete it here as we don't store it server-side
			delete value[ID_FIELD_NAME];
		}

		if (value) {
			if (multiple) obj.values = value;
			else obj.value = value;
		}

		return obj;
	}

	/**
	 * Returns the SHA-1 hash of the JSON
	 * - Can be used to compare file content without downloading the file
	 *
	 * @returns The SHA-1 hash of the JSON.
	 */
	public sha1(): Promise<string> {
		return this.getRequest<string>("sha1", {}, false);
	}

	/**
	 * Get an element from the collection by its key
	 * @param key - The key of the element to retrieve
	 * @returns The element with the specified key
	 */
	public async get(key: Id): Promise<Item & ItemMethods> {
		const item = await this.getRequest<Item>("get", { id: key }, false);
		const itemWithId = this.identify(item, key);

		return this.addMethods(itemWithId);
	}

	/**
	 * Get multiple elements from the collection by their keys
	 * @param keys - Array of keys to search
	 * @returns The found elements
	 */
	public async searchKeys(keys: Id[]): Promise<Item[]> {
		if (!Array.isArray(keys)) throw new TypeError("Keys must be an array");

		const res = await this.getRequest<Record<string, Item>>("searchKeys", { search: keys });

		return Object.entries(res)
			.map(([id, value]) => this.identify(value, id))
			.map((el) => this.addMethods(el));
	}

	/**
	 * Search trough the collection
	 * @param options - Array of search options
	 * @param random - Random result seed, disabled by default, but can activated with true or a given seed
	 * @returns The found elements
	 */
	public async search(
		options: SearchOption<Item>[],
		random: boolean | number = false,
	): Promise<(Item & ItemMethods)[]> {
		if (!Array.isArray(options)) throw new TypeError("Search options must be an array");

		options.forEach((option) => {
			if (option.field === undefined || option.criteria === undefined || option.value === undefined)
				throw new TypeError("Missing fields in search options array");

			if (typeof option.field !== "string")
				throw new TypeError("Search option field must be a string");

			if (option.criteria === "in" && !Array.isArray(option.value))
				throw new TypeError("Search option value must be an array when criteria is 'in'");

			// TODO: add more checks for criteria and value types
		});

		const params: Record<string, unknown> = {
			search: options,
		};

		if (random !== false) {
			if (random === true) params.random = {};
			else {
				const seed = parseInt(String(random));
				if (isNaN(seed)) throw new TypeError("'random' takes as parameter a boolean or a number");

				params.random = { seed };
			}
		}

		const res = await this.getRequest<Item[]>("search", params);
		return Object.entries(res).map(([id, item]) => this.addMethods(this.identify(item, id)));
	}

	/**
	 * Read the entire collection
	 * @param original - Disable ID field injection for easier iteration (default false)
	 * @returns The entire collection
	 */
	public async readRaw(original = false): Promise<Record<string, Item>> {
		const res = await this.getRequest<Record<string, Item>>("read_raw", {}, false);

		Object.entries(res).forEach(
			([key, item]) => (res[key] = this.addMethods(original ? item : this.identify(item, key))),
		);

		return res;
	}

	/**
	 * Set the entire content of the collection.
	 * - Only use this method if you know what you are doing!
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	public async writeRaw(value: Record<string, Item>): Promise<WriteConfirmation> {
		if (value === undefined || value === null)
			throw new TypeError("writeRaw value cannot be undefined or null");

		return extractData(axios.post(POST(), this.writeData("write_raw", value)));
	}

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of {@link readRaw}
	 * @param option - The fields you want to select
	 * @returns Selected fields
	 */
	public async select(option: SelectOption<Item>): Promise<Record<string, Partial<Item>>> {
		const data = await this.getRequest<Record<string, Partial<Item>>>("select", {
			select: option ?? {},
		});

		if (this.methods) {
			Object.entries(data).forEach(([key, item]) => {
				data[key] = this.addMethods(this.identify(item, key));
			});
		}

		return data;
	}

	/**
	 * Get all distinct non-null values for a given key across a collection
	 * @param option - Value options
	 * @returns Array of unique values
	 *
	 * TODO: add return type to this method
	 */
	public async values<Keys extends keyof Item>(option: ValueOption<Keys>): Promise<any> {
		if (!option) throw new TypeError("Value option must be provided");

		if (typeof option.field !== "string") throw new TypeError("Field must be a string");

		if (option.flatten !== undefined && typeof option.flatten !== "boolean")
			throw new TypeError("Flatten must be a boolean");

		const data = await this.getRequest<Record<string, unknown>>("values", {
			values: option,
		});

		// no ID_FIELD or method injection since no ids are returned
		return Object.values(data).filter((d) => d !== null) as Item[Keys][];
	}

	/**
	 * Read random collection elements
	 * @param max - The maximum number of entries
	 * @param seed - The seed to use
	 * @param offset - The offset to use
	 * @returns The found elements
	 */
	public async random(max?: number, seed?: number, offset?: number): Promise<Item[]> {
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

		const data = await this.getRequest<Record<string, Item>>("random", { random: params });
		return Object.entries(data).map(([key, item]) => this.addMethods(this.identify(item, key)));
	}

	/**
	 * Append a value to the collection.
	 * @remarks Only works if the autoKey is enabled server-side.
	 * @param value - The value to add
	 * @returns The generated key for the added element
	 */
	public async add(value: Item): Promise<Id> {
		const res = await extractData<{ id: Id }>(axios.post(POST(), this.writeData("add", value)));
		if (typeof res !== "object" || !("id" in res) || typeof res.id !== "string") throw res;
		return res.id;
	}
	
	/**
	 * Append multiple values to the collection
	 * @remarks Only works if autoKey is enabled server-side
	 * @param values - The values to add
	 * @returns The generated keys of the added elements
	 */
	public async addBulk(values: Item[]): Promise<Id[]> {
		const res = await extractData<{ ids: Id[] }>(
			axios.post(POST(), this.writeData("addBulk", values, true)),
		);
		return res.ids;
	}

	/**
	 * Remove an element from the collection by its key
	 * @param key The key from the entry to remove
	 * @returns Write confirmation
	 */
	public async remove(key: Id): Promise<WriteConfirmation> {
		return extractData(axios.post(POST(), this.writeData("remove", key)));
	}
	
	/**
	 * Remove multiple elements from the collection by their keys
	 * @param keys The key from the entries to remove
	 * @returns Write confirmation
	 */
	public async removeBulk(keys: Id[]): Promise<WriteConfirmation> {
		return extractData(axios.post(POST(), this.writeData("removeBulk", keys)));
	}

	/**
	 * Set a value in the collection by key
	 * @param key - The key of the element you want to edit
	 * @param value - The value you want to edit
	 * @returns Write confirmation
	 */
	public async set(key: Id, value: Item): Promise<WriteConfirmation> {
		const data = this.writeData("set", value);
		data["key"] = key;

		return extractData(axios.post(POST(), data));
	}
	
	/**
	 * Set multiple values in the collection by their keys
	 * @param keys - The keys of the elements you want to edit
	 * @param values - The values you want to edit
	 * @returns Write confirmation
	 */
	public async setBulk(keys: Id[], values: Item[]): Promise<WriteConfirmation> {
		const data = this.writeData("setBulk", values, true);

		data["keys"] = keys;
		return extractData(axios.post(POST(), data));
	}

	/**
	 * Edit an element's field in the collection
	 * @param option - The edit object
	 * @returns Edit confirmation
	 */
	public async editField(option: EditFieldOption<Item>): Promise<WriteConfirmation> {
		const data = this.writeData("editField", option, null);
		return extractData(axios.post(POST(), data));
	}

	/**
	 * Edit multiple elements' fields in the collection
	 * @param options - The edit objects
	 * @returns  Edit confirmation
	 */
	public async editFieldBulk(options: EditFieldOption<Item>[]): Promise<WriteConfirmation> {
		const data = this.writeData("editFieldBulk", options, undefined);
		return extractData(axios.post(POST(), data));
	}
}
