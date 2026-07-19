const axios = require("axios").default;
const { applyAddMethods, extractRequest, getData, createPostData } = require("./utils.js");

const ID_FIELD_NAME = "id";

/**
 * @typedef {Object} SearchOption
 * @property {string} field - The field to be searched for
 * @property {"!=" | "==" | ">=" | "<=" | "<" | ">" | "in" | "includes" | "startsWith" | "endsWith" | "array-contains" | "array-contains-none" | "array-contains-any" | "array-contains-all" | "array-length-eq" | "array-length-df" | "array-length-gt" | "array-length-le" | "array-length-lt" | "array-length-ge"} criteria - Search criteria to filter results
 * @property {string | number | boolean | Array} value - The value to be searched for
 * @property {boolean} [ignoreCase] - Is it case sensitive? (default true)
 */

/**
 * @typedef {Object} SearchOption
 * @property {(boolean | number)?} [random] - Random result seed, disabled by default, but can activated with true or a given seed
 * @property {number?} [limit] - Maximum number of results to return
 */

/**
 * @typedef {Object} EditFieldOption
 * @property {string | number} id - The affected element
 * @property {string} field - The field to edit
 * @property {"set" | "remove" | "append" | "invert" | "increment" | "decrement" | "array-push" | "array-delete" | "array-splice"} operation - Operation for the field
 * @property {string | number | boolean | Array} [value] - The value to write
 */

/**
 * @typedef {Object} ValueOption
 * @property {string} field - Field to search
 * @property {boolean} [flatten] - Flatten array fields? (default false)
 */

/**
 * @typedef {Object} SelectOption
 * @property {Array<string>} fields - Selected fields to be returned
 */

/**
 * @typedef {Object} WriteConfirmation
 * @property {string} message - Write status
 */

/**
 * @callback AddMethods
 * @template T
 * @param {T} element - Collection element
 * @param {Collection<T>} collection - Collection
 * @returns {T} - Collection element with added methods
 */

/**
 * Represents a Firestorm Collection
 * @template T - Type of collection element
 */
class Collection {
	/**
	 * Name of the collection
	 * @type {string}
	 */
	collectionName;

	/**
	 * Additional methods and data to add to the objects
	 * @type {AddMethods}
	 */
	addMethods;

	/**
	 * Value for the ID field when searching content
	 * @type {string}
	 */
	ID_FIELD;

	/**
	 * Root Firestorm instance
	 * @type {Firestorm}
	 */
	instance;

	/**
	 * Create a new Firestorm collection instance
	 * @param {Firestorm} instance - Root Firestorm instance
	 * @param {string} name - Name of the collection
	 * @param {AddMethods} [addMethods] - Additional methods and data to add to the objects
	 */
	constructor(instance, name, addMethods = (el) => el) {
		this.instance = instance;
		if (!name) throw new SyntaxError("Collection must have a name");
		if (typeof addMethods !== "function")
			throw new TypeError("Collection add methods must be a function");
		this.collectionName = name;
		this.addMethods = addMethods;
		this.ID_FIELD = ID_FIELD_NAME;
	}

	/** @ignore */
	get __read_address() {
		if (!this.instance.address)
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		return `${this.instance.address}get.php`;
	}

	/** @ignore */
	get __write_address() {
		if (!this.instance.address)
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		return `${this.instance.address}post.php`;
	}

	/**
	 * Get the SHA-1 hash of the JSON
	 * - Can be used to compare file content without downloading the file
	 * @returns {Promise<string>} The SHA-1 hash of the file
	 */
	sha1() {
		// string value is correct so we don't need validation
		return getData(this, "sha1", {}, false);
	}

	/**
	 * Get an element from the collection by its key
	 * @param {string | number} key - Key to search
	 * @returns {Promise<T>} The found element
	 */
	async get(key) {
		const res = await getData(this, "get", {
			id: key,
		});
		// String is more portable than .toString()
		res[this.ID_FIELD] = String(key);
		return applyAddMethods(this, res, false);
	}

	/**
	 * Get multiple elements from the collection by their keys
	 * @param {Array<string | number>} keys - Array of keys to search
	 * @returns {Promise<T[]>} The found elements
	 */
	async searchKeys(keys) {
		if (!Array.isArray(keys)) throw new TypeError("Incorrect keys");

		const res = await getData(this, "searchKeys", {
			search: keys,
		});
		const arr = Object.entries(res).map(([id, value]) => {
			value[this.ID_FIELD] = id;
			return value;
		});
		return applyAddMethods(this, arr);
	}

	/**
	 * Search through the collection
	 * @param {SearchOption[]} filter - Array of search options
	 * @param {(boolean|number|SearchResultOptions)?} [resultOptions] - Search result options
	 * @returns {Promise<T[]>} The found elements
	 */
	async search(filter, resultOptions = undefined) {
		if (!Array.isArray(filter)) throw new TypeError("searchOptions shall be an array");
		if (
			resultOptions !== undefined &&
			typeof resultOptions !== "number" &&
			typeof resultOptions !== "boolean" &&
			typeof resultOptions !== "object"
		)
			throw new TypeError("Incorrect search result options");

		const { random = false, limit = undefined } = resultOptions || {};

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

		filter.forEach((option) => {
			if (option.field === undefined || option.criteria === undefined || option.value === undefined)
				throw new TypeError("Missing fields in filter array");

			if (typeof option.field !== "string")
				throw new TypeError(`${JSON.stringify(option)} filter field is not a string`);

			if (option.criteria == "in" && !Array.isArray(option.value))
				throw new TypeError("in takes an array of values");

			// TODO: add more strict value field warnings in JS and PHP
		});

		const params = {
			search: filter,
		};

		if (limit !== undefined) params.limit = limit;

		if (random !== undefined && random !== false) {
			params.random = parseInt(random);
			if (random === true) {
				params.random = {};
			} else {
				const seed = parseInt(random);
				params.random = { seed };
			}
		}

		const res = await getData(this, "search", params);
		const arr = Object.entries(res).map(([id, value]) => {
			value[this.ID_FIELD] = id;
			return value;
		});
		return applyAddMethods(this, arr);
	}

	/**
	 * Read the entire collection
	 * @param {boolean} [original] - Disable ID field injection for easier iteration (default false)
	 * @returns {Promise<Record<string, T>>} The entire collection
	 */
	async readRaw(original = false) {
		const data = await getData(this, "readRaw");
		if (original) return applyAddMethods(this, data);
		// preserve as object
		Object.keys(data).forEach((key) => {
			data[key][this.ID_FIELD] = key;
		});
		return applyAddMethods(this, data);
	}

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of {@link readRaw}
	 * @param {SelectOption} option - The fields you want to select
	 * @returns {Promise<Record<string, Partial<T>>>} Selected fields
	 */
	async select(option) {
		if (!option) option = {};
		const data = await getData(this, "select", {
			select: option,
		});
		Object.keys(data).forEach((key) => {
			data[key][this.ID_FIELD] = key;
		});
		return applyAddMethods(this, data);
	}

	/**
	 * Get all distinct non-null values for a given key across a collection
	 * @param {ValueOption} option - Value options
	 * @returns {Promise<T[]>} Array of unique values
	 */
	async values(option) {
		if (!option) throw new TypeError("Value option must be provided");
		if (typeof option.field !== "string") throw new TypeError("Field must be a string");
		if (option.flatten !== undefined && typeof option.flatten !== "boolean")
			throw new TypeError("Flatten must be a boolean");

		const data = await getData(this, "values", {
			values: option,
		});
		// no ID_FIELD or method injection since no ids are returned
		return Object.values(data).filter((d) => d !== null);
	}

	/**
	 * Read random collection elements
	 * @param {number} [max] - The maximum number of entries
	 * @param {number} [seed] - The seed to use
	 * @param {number} [offset] - The offset to use
	 * @returns {Promise<T[]>} The found elements
	 */
	async random(max, seed, offset) {
		const params = {};
		if (max !== undefined) {
			if (typeof max !== "number" || !Number.isInteger(max) || max < -1)
				throw new TypeError("Expected integer >= -1 for the max");
			params.max = max;
		}

		const hasSeed = seed !== undefined;
		const hasOffset = offset !== undefined;
		if (hasOffset && !hasSeed) throw new TypeError("You can't put an offset without a seed");

		if (hasOffset && (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0))
			throw new TypeError("Expected integer >= -1 for the max");

		if (hasSeed) {
			if (typeof seed !== "number" || !Number.isInteger(seed))
				throw new TypeError("Expected integer for the seed");

			if (!hasOffset) offset = 0;
			params.seed = seed;
			params.offset = offset;
		}

		const data = await getData(this, "random", {
			random: params,
		});
		Object.keys(data).forEach((key) => {
			data[key][this.ID_FIELD] = key;
		});
		return applyAddMethods(this, data);
	}

	/**
	 * Set the entire content of the collection.
	 * - Only use this method if you know what you are doing!
	 * @param {Record<string, T>} value - The value to write
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	async writeRaw(value) {
		if (value === undefined || value === null)
			throw new TypeError("writeRaw value cannot be undefined or null");
		return extractRequest(
			axios.post(this.__write_address, createPostData(this, "writeRaw", value)),
		);
	}

	/**
	 * Append a value to the collection
	 * - Only works if autoKey is enabled server-side
	 * @param {T} value - The value (without methods) to add
	 * @returns {Promise<string>} The generated key of the added element
	 */
	async add(value) {
		const res = await extractRequest(
			axios.post(this.__write_address, createPostData(this, "add", value)),
		);
		if (typeof res !== "object" || !("id" in res) || typeof res.id !== "string") throw res;
		return res.id;
	}

	/**
	 * Append multiple values to the collection
	 * - Only works if autoKey is enabled server-side
	 * @param {T[]} values - The values (without methods) to add
	 * @returns {Promise<string[]>} The generated keys of the added elements
	 */
	async addBulk(values) {
		const res = await extractRequest(
			axios.post(this.__write_address, createPostData(this, "addBulk", values, true)),
		);
		return res.ids;
	}

	/**
	 * Remove an element from the collection by its key
	 * @param {string | number} key The key from the entry to remove
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	remove(key) {
		return extractRequest(axios.post(this.__write_address, createPostData(this, "remove", key)));
	}

	/**
	 * Remove multiple elements from the collection by their keys
	 * @param {Array<string | number>} keys The key from the entries to remove
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	removeBulk(keys) {
		return extractRequest(
			axios.post(this.__write_address, createPostData(this, "removeBulk", keys)),
		);
	}

	/**
	 * Set a value in the collection by key
	 * @param {string | number} key - The key of the element you want to edit
	 * @param {T} value - The value (without methods) you want to edit
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	set(key, value) {
		const data = createPostData(this, "set", value);
		data["key"] = key;
		return extractRequest(axios.post(this.__write_address, data));
	}

	/**
	 * Set multiple values in the collection by their keys
	 * @param {Array<string | number>} keys - The keys of the elements you want to edit
	 * @param {T[]} values - The values (without methods) you want to edit
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	setBulk(keys, values) {
		const data = createPostData(this, "setBulk", values, true);
		data["keys"] = keys;
		return extractRequest(axios.post(this.__write_address, data));
	}

	/**
	 * Edit an element's field in the collection
	 * @param {EditFieldOption} option - The edit object
	 * @returns {Promise<WriteConfirmation>} Edit confirmation
	 */
	editField(option) {
		const data = createPostData(this, "editField", option, null);
		return extractRequest(axios.post(this.__write_address, data));
	}

	/**
	 * Edit multiple elements' fields in the collection
	 * @param {EditFieldOption[]} options - The edit objects
	 * @returns {Promise<WriteConfirmation>} Edit confirmation
	 */
	editFieldBulk(options) {
		const data = createPostData(this, "editFieldBulk", options, undefined);
		return extractRequest(axios.post(this.__write_address, data));
	}
}

module.exports = Collection;
