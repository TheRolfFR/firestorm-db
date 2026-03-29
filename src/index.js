const IS_NODE = typeof process === "object";

try {
	// ambient axios context in browser
	if (IS_NODE) var axios = require("axios").default;
} catch {}

/**
 * @typedef {Object} SearchOption
 * @property {string} field - The field to be searched for
 * @property {"!=" | "==" | ">=" | "<=" | "<" | ">" | "in" | "includes" | "startsWith" | "endsWith" | "array-contains" | "array-contains-none" | "array-contains-any" | "array-contains-all" | "array-length-eq" | "array-length-df" | "array-length-gt" | "array-length-le" | "array-length-lt" | "array-length-ge"} criteria - Search criteria to filter results
 * @property {string | number | boolean | Array} value - The value to be searched for
 * @property {boolean} [ignoreCase] - Is it case sensitive? (default true)
 */

/**
 * @typedef {Object} SearchResultOptions
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

/** @ignore */
let _address = undefined;

/** @ignore */
let _token = undefined;

const ID_FIELD_NAME = "id";

const readAddress = () => {
	if (!_address) throw new Error("Firestorm address was not configured");
	return _address + "get.php";
};

const writeAddress = () => {
	if (!_address) throw new Error("Firestorm address was not configured");
	return _address + "post.php";
};

const fileAddress = () => {
	if (!_address) throw new Error("Firestorm address was not configured");
	return _address + "files.php";
};

const writeToken = () => {
	if (!_token) throw new Error("Firestorm token was not configured");
	return _token;
};

/**
 * Axios Promise typedef to avoid documentation generation problems
 * @ignore
 * @typedef {require("axios").AxiosPromise} AxiosPromise
 */

/**
 * Auto-extracts data from Axios request
 * @ignore
 * @param {AxiosPromise} request - Axios request promise
 */
const __extract_data = async (request) => {
	// does nothing if request is synchronous
	const res = await request;
	if ("data" in res) return res.data;
	return res;
};

/**
 * Represents a Firestorm Collection
 * @template T - Type of collection element
 */
class Collection {
	/** Name of the Firestorm collection */
	collectionName;

	/**
	 * Create a new Firestorm collection instance
	 * @param {string} name - The name of the collection
	 * @param {Function} [addMethods] - Additional methods and data to add to the objects
	 */
	constructor(name, addMethods = (el) => el) {
		if (!name) throw new SyntaxError("Collection must have a name");
		if (typeof addMethods !== "function")
			throw new TypeError("Collection add methods must be a function");
		this.addMethods = addMethods;
		this.collectionName = name;
	}

	/**
	 * Add user methods to returned data
	 * @private
	 * @ignore
	 * @param {any} el - Value to add methods to
	 * @param {boolean} [nested] - Nest the methods inside an object
	 * @returns {any}
	 */
	__add_methods(el, nested = true) {
		// can't add properties on falsy values
		if (!el) return el;
		if (Array.isArray(el)) return el.map((el) => this.addMethods(el));
		// nested objects
		if (nested && typeof el === "object") {
			Object.keys(el).forEach((k) => {
				el[k] = this.addMethods(el[k]);
			});
			return el;
		}

		// add directly to single object
		return this.addMethods(el);
	}

	/**
	 * Auto-extracts data from Axios request
	 * @private
	 * @ignore
	 * @param {AxiosPromise} request - Axios request promise
	 */
	__extract_data(request) {
		return __extract_data(request);
	}

	/**
	 * Send GET request with provided data and return extracted response
	 * @private
	 * @ignore
	 * @param {string} command - The read command name
	 * @param {Object} [data] - Body data
	 * @param {boolean} [objectLike] - Reject if an object or array isn't being returned
	 * @returns {Promise<any>} Extracted response
	 */
	async __get_request(command, data = {}, objectLike = true) {
		const obj = {
			collection: this.collectionName,
			command: command,
			...data,
		};
		const request = IS_NODE
			? axios.get(readAddress(), { data: obj })
			: axios.post(readAddress(), obj);
		const res = await this.__extract_data(request);
		// reject php error strings if enforcing return type
		if (objectLike && typeof res !== "object") throw res;
		return res;
	}

	/**
	 * Generate POST data with provided data
	 * @private
	 * @ignore
	 * @param {string} command - The write command name
	 * @param {Object} [value] - The value for the command
	 * @param {boolean} [multiple] - Used to delete multiple
	 * @returns {Object} Write data object
	 */
	__write_data(command, value = undefined, multiple = false) {
		const obj = {
			token: writeToken(),
			collection: this.collectionName,
			command: command,
		};

		// clone/serialize data if possible (prevents mutating data)
		if (value) value = JSON.parse(JSON.stringify(value));

		if (multiple && Array.isArray(value)) {
			value.forEach((v) => {
				if (typeof v === "object" && !Array.isArray(v) && v != null) delete v[ID_FIELD_NAME];
			});
		} else if (
			multiple === false &&
			value !== null &&
			value !== undefined &&
			typeof value !== "number" &&
			typeof value !== "string" &&
			!Array.isArray(value)
		) {
			if (typeof value === "object") value = { ...value };
			delete value[ID_FIELD_NAME];
		}

		if (value) {
			if (multiple) obj.values = value;
			else obj.value = value;
		}

		return obj;
	}

	/**
	 * Get the SHA-1 hash of the JSON
	 * - Can be used to compare file content without downloading the file
	 * @returns {Promise<string>} The SHA-1 hash of the file
	 */
	sha1() {
		// string value is correct so we don't need validation
		return this.__get_request("sha1", {}, false);
	}

	/**
	 * Get an element from the collection by its key
	 * @param {string | number} key - Key to search
	 * @returns {Promise<T>} The found element
	 */
	async get(key) {
		const res = await this.__get_request("get", {
			id: key,
		});
		// String is more portable than .toString()
		res[ID_FIELD_NAME] = String(key);
		return this.__add_methods(res, false);
	}

	/**
	 * Get multiple elements from the collection by their keys
	 * @param {Array<string | number>} keys - Array of keys to search
	 * @returns {Promise<T[]>} The found elements
	 */
	async searchKeys(keys) {
		if (!Array.isArray(keys)) throw new TypeError("Incorrect keys");

		const res = await this.__get_request("searchKeys", {
			search: keys,
		});
		const arr = Object.entries(res).map(([id, value]) => {
			value[ID_FIELD_NAME] = id;
			return value;
		});
		return this.__add_methods(arr);
	}

	/**
	 * Search through the collection
	 * @param {SearchOption[]} options - Array of search options
	 * @param {(boolean|number|SearchResultOptions)?} [resultOptions] - Search result options
	 * @returns {Promise<T[]>} The found elements
	 */
	async search(options, resultOptions = undefined) {
		if (!Array.isArray(options)) throw new TypeError("searchOptions shall be an array");
		if (resultOptions !== undefined && typeof(resultOptions) !== "number" && typeof(resultOptions) !== "boolean"
			&& typeof(resultOptions) !== "object") throw new TypeError("Incorrect search result options");
		
		const { random = false, limit = undefined } = resultOptions || {};

		if (limit !== undefined && (typeof limit !== "number" || limit <= 0 || !Number.isInteger(limit)))
			throw new TypeError(`${JSON.stringify(limit)} search option limit must be a positive integer`);

		if (random !== undefined && random !== false && random !== true && (typeof random !== "number" || !Number.isInteger(random)))
			throw new TypeError(`${JSON.stringify(random)} search option random must be a boolean or an integer`);

		options.forEach((option) => {
			if (option.field === undefined || option.criteria === undefined || option.value === undefined)
				throw new TypeError("Missing fields in searchOptions array");

			if (typeof option.field !== "string")
				throw new TypeError(`${JSON.stringify(option)} search option field is not a string`);

			if (option.criteria == "in" && !Array.isArray(option.value))
				throw new TypeError("in takes an array of values");

			// TODO: add more strict value field warnings in JS and PHP
		});

		const params = {
			search: options,
		};

		if (limit !== undefined) {
			params.limit = limit;
		}

		if(random !== undefined && random !== false) {
			params.random = parseInt(random);
			if (random === true) {
				params.random = {};
			} else {
				const seed = parseInt(random);
				params.random = { seed };
			}
		}

		const res = await this.__get_request("search", params);
		const arr = Object.entries(res).map(([id, value]) => {
			value[ID_FIELD_NAME] = id;
			return value;
		});
		return this.__add_methods(arr);
	}

	/**
	 * Read the entire collection
	 * @param {boolean} [original] - Disable ID field injection for easier iteration (default false)
	 * @returns {Promise<Record<string, T>>} The entire collection
	 */
	async readRaw(original = false) {
		const data = await this.__get_request("read_raw");
		if (original) return this.__add_methods(data);
		// preserve as object
		Object.keys(data).forEach((key) => {
			data[key][ID_FIELD_NAME] = key;
		});
		return this.__add_methods(data);
	}

	/**
	 * Read the entire collection
	 * - ID values are injected for easier iteration, so this may be different from {@link sha1}
	 * @deprecated Use {@link readRaw} instead
	 * @returns {Promise<Record<string, T>>} The entire collection
	 */
	read_raw() {
		return this.readRaw();
	}

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of {@link readRaw}
	 * @param {SelectOption} option - The fields you want to select
	 * @returns {Promise<Record<string, Partial<T>>>} Selected fields
	 */
	async select(option) {
		if (!option) option = {};
		const data = await this.__get_request("select", {
			select: option,
		});
		Object.keys(data).forEach((key) => {
			data[key][ID_FIELD_NAME] = key;
		});
		return this.__add_methods(data);
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

		const data = await this.__get_request("values", {
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

		const data = await this.__get_request("random", {
			random: params,
		});
		Object.keys(data).forEach((key) => {
			data[key][ID_FIELD_NAME] = key;
		});
		return this.__add_methods(data);
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
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("write_raw", value)));
	}

	/**
	 * Set the entire content of the collection.
	 * - Only use this method if you know what you are doing!
	 * @deprecated Use {@link writeRaw} instead
	 * @param {Record<string, T>} value - The value to write
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	write_raw(value) {
		return this.writeRaw(value);
	}

	/**
	 * Append a value to the collection
	 * - Only works if autoKey is enabled server-side
	 * @param {T} value - The value (without methods) to add
	 * @returns {Promise<string>} The generated key of the added element
	 */
	async add(value) {
		const res = await this.__extract_data(
			axios.post(writeAddress(), this.__write_data("add", value)),
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
		const res = await this.__extract_data(
			axios.post(writeAddress(), this.__write_data("addBulk", values, true)),
		);
		return res.ids;
	}

	/**
	 * Remove an element from the collection by its key
	 * @param {string | number} key The key from the entry to remove
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	remove(key) {
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("remove", key)));
	}

	/**
	 * Remove multiple elements from the collection by their keys
	 * @param {Array<string | number>} keys The key from the entries to remove
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	removeBulk(keys) {
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("removeBulk", keys)));
	}

	/**
	 * Set a value in the collection by key
	 * @param {string | number} key - The key of the element you want to edit
	 * @param {T} value - The value (without methods) you want to edit
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	set(key, value) {
		const data = this.__write_data("set", value);
		data["key"] = key;
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Set multiple values in the collection by their keys
	 * @param {Array<string | number>} keys - The keys of the elements you want to edit
	 * @param {T[]} values - The values (without methods) you want to edit
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	setBulk(keys, values) {
		const data = this.__write_data("setBulk", values, true);
		data["keys"] = keys;
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Edit an element's field in the collection
	 * @param {EditFieldOption} option - The edit object
	 * @returns {Promise<WriteConfirmation>} Edit confirmation
	 */
	editField(option) {
		const data = this.__write_data("editField", option, null);
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Edit multiple elements' fields in the collection
	 * @param {EditFieldOption[]} options - The edit objects
	 * @returns {Promise<WriteConfirmation>} Edit confirmation
	 */
	editFieldBulk(options) {
		const data = this.__write_data("editFieldBulk", options, undefined);
		return this.__extract_data(axios.post(writeAddress(), data));
	}
}

/**
 * @namespace firestorm
 */
const firestorm = {
	/**
	 * Change or get the current Firestorm address
	 * @param {string} [newValue] - The new Firestorm address
	 * @returns {string} The stored Firestorm address
	 */
	address(newValue = undefined) {
		if (newValue === undefined) return readAddress();
		if (!newValue.endsWith("/")) newValue += "/";
		if (newValue) _address = newValue;

		return _address;
	},

	/**
	 * Change or get the current Firestorm token
	 * @param {string} [newValue] - The new Firestorm write token
	 * @returns {string} The stored Firestorm write token
	 */
	token(newValue = undefined) {
		if (newValue === undefined) return writeToken();
		if (newValue) _token = newValue;

		return _token;
	},

	/**
	 * Create a new Firestorm collection instance
	 * @template T
	 * @param {string} name - The name of the collection
	 * @param {Function} [addMethods] - Additional methods and data to add to the objects
	 * @returns {Collection<T>} The collection instance
	 */
	collection(name, addMethods = (el) => el) {
		return new Collection(name, addMethods);
	},

	/**
	 * Create a temporary Firestorm collection with no methods
	 * @deprecated Use {@link collection} with no second argument instead
	 * @template T
	 * @param {string} name - The table name to get
	 * @returns {Collection<T>} The table instance
	 */
	table(name) {
		return this.collection(name);
	},

	/** Value for the ID field when searching content */
	ID_FIELD: ID_FIELD_NAME,

	/**
	 * Firestorm file handler
	 * @memberof firestorm
	 * @type {Object}
	 * @namespace firestorm.files
	 */
	files: {
		/**
		 * Get a file by its path
		 * @memberof firestorm.files
		 * @template T - Type of file content
		 * @param {string} path - The wanted file path
		 * @returns {Promise<T>} File contents
		 */
		get(path) {
			return __extract_data(
				axios.get(fileAddress(), {
					params: {
						path,
					},
				}),
			);
		},

		/**
		 * Upload a file
		 * @memberof firestorm.files
		 * @param {FormData} form - Form data with path, filename, and file
		 * @returns {Promise<WriteConfirmation>} Write confirmation
		 */
		upload(form) {
			form.append("token", firestorm.token());
			return __extract_data(
				axios.post(fileAddress(), form, {
					headers: {
						...form.getHeaders(),
					},
				}),
			);
		},

		/**
		 * Delete a file by its path
		 * @memberof firestorm.files
		 * @param {string} path - The file path to delete
		 * @returns {Promise<WriteConfirmation>} Write confirmation
		 */
		delete(path) {
			return __extract_data(
				axios.delete(fileAddress(), {
					data: {
						path,
						token: firestorm.token(),
					},
				}),
			);
		},
	},
};

// browser check
try {
	if (IS_NODE) module.exports = firestorm;
} catch {}
