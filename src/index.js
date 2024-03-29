try {
	if (typeof process === "object") var axios = require("axios").default;
} catch (_error) {}

/**
 * @typedef {Object} SearchOption
 * @property {string} field - The field to be searched for
 * @property {"!=" | "==" | ">=" | "<=" | "<" | ">" | "in" | "includes" | "startsWith" | "endsWith" | "array-contains" | "array-contains-any" | "array-length-(eq|df|gt|lt|ge|le)"} criteria - Search criteria to filter results
 * @property {string | number | boolean | Array} value - The value to be searched for
 * @property {boolean} [ignoreCase] - Is it case sensitive? (default true)
 */

/**
 * @typedef {Object} EditObject
 * @property {string | number} id - The affected element
 * @property {string} field - The field to edit
 * @property {"set" | "remove" | "append" | "increment" | "decrement" | "array-push" | "array-delete" | "array-splice"} operation - Operation for the field
 * @property {string | number | boolean | Array} [value] - The value to write
 */

/**
 * @typedef {Object} ValueObject
 * @property {string} field - Field to search
 * @property {boolean} [flatten] - Flatten array fields? (default false)
 */

/**
 * @typedef {Object} SelectOption
 * @property {Array<string>} fields - Selected fields to be returned
 */

/**
 * @typedef {WriteConfirmation}
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
 * @param {Promise<AxiosPromise>} request The Axios concerned request
 */
const __extract_data = (request) => {
	if (!(request instanceof Promise)) request = Promise.resolve(request);
	return request.then((res) => {
		if ("data" in res) return res.data;
		return res;
	});
};

/**
 * Class representing a collection
 * @template T
 */
class Collection {
	/**
	 * Create a new Firestorm collection instance
	 * @param {string} name - The name of the collection
	 * @param {Function} [addMethods] - Additional methods and data to add to the objects
	 */
	constructor(name, addMethods = (el) => el) {
		if (name === undefined) throw new SyntaxError("Collection must have a name");
		if (typeof addMethods !== "function")
			throw new TypeError("Collection must have an addMethods of type Function");
		this.addMethods = addMethods;
		this.collectionName = name;
	}

	/**
	 * Add user methods to returned data
	 * @private
	 * @ignore
	 * @param {AxiosPromise} req - Incoming request
	 * @returns {Object | Object[]}
	 */
	__add_methods(req) {
		if (!(req instanceof Promise)) req = Promise.resolve(req);
		return req.then((el) => {
			if (Array.isArray(el)) return el.map((el) => this.addMethods(el));
			el[Object.keys(el)[0]][ID_FIELD_NAME] = Object.keys(el)[0];
			el = el[Object.keys(el)[0]];

			// else on the object itself
			return this.addMethods(el);
		});
	}

	/**
	 * Auto-extracts data from Axios request
	 * @private
	 * @ignore
	 * @param {AxiosPromise} request - The Axios concerned request
	 */
	__extract_data(request) {
		return __extract_data(request);
	}

	/**
	 * Send get request and extract data from response
	 * @private
	 * @ignore
	 * @param {Object} data - Body data
	 * @returns {Promise<Object|Object[]>} data out
	 */
	__get_request(data) {
		const request =
			typeof process === "object"
				? axios.get(readAddress(), {
						data: data,
					})
				: axios.post(readAddress(), data);
		return this.__extract_data(request);
	}

	/**
	 * Get an element from the collection
	 * @param {string | number} id - The ID of the element you want to get
	 * @returns {Promise<T>} Corresponding value
	 */
	get(id) {
		return this.__get_request({
			collection: this.collectionName,
			command: "get",
			id: id,
		}).then((res) => this.__add_methods(res));
	}

	/**
	 * Get the sha1 hash of the file
	 * - Can be used to see if same file content without downloading the file
	 * @returns {string} The sha1 hash of the file
	 */
	sha1() {
		return this.__get_request({
			collection: this.collectionName,
			command: "sha1",
		});
	}

	/**
	 * Search through collection
	 * @param {SearchOption[]} searchOptions - Array of search options
	 * @param {boolean | number} [random] - Random result seed, disabled by default, but can activated with true or a given seed
	 * @returns {Promise<T[]>} The found elements
	 */
	search(searchOptions, random = false) {
		if (!Array.isArray(searchOptions))
			return Promise.reject(new Error("searchOptions shall be an array"));

		searchOptions.forEach((searchOption) => {
			if (
				searchOption.field === undefined ||
				searchOption.criteria === undefined ||
				searchOption.value === undefined
			)
				return Promise.reject(new Error("Missing fields in searchOptions array"));

			if (typeof searchOption.field !== "string")
				return Promise.reject(
					new Error(`${JSON.stringify(searchOption)} search option field is not a string`),
				);

			if (searchOption.criteria == "in" && !Array.isArray(searchOption.value))
				return Promise.reject(new Error("in takes an array of values"));

			//TODO: add more strict value field warnings in JS and PHP
		});

		const params = {
			collection: this.collectionName,
			command: "search",
			search: searchOptions,
		};

		if (random !== false) {
			if (random === true) {
				params.random = {};
			} else {
				const seed = parseInt(random);
				if (isNaN(seed))
					return Promise.reject(
						new Error("random takes as parameter true, false or an integer value"),
					);
				params.random = { seed };
			}
		}

		return this.__get_request(params).then((res) => {
			const arr = Object.entries(res).map(([id, value]) => {
				value[ID_FIELD_NAME] = id;
				return value;
			});

			return this.__add_methods(arr);
		});
	}

	/**
	 * Search specific keys through collection
	 * @param {string[] | number[]} keys - Array of keys to search
	 * @returns {Promise<T[]>} The found elements
	 */
	searchKeys(keys) {
		if (!Array.isArray(keys)) return Promise.reject("Incorrect keys");

		return this.__get_request({
			collection: this.collectionName,
			command: "searchKeys",
			search: keys,
		}).then((res) => {
			const arr = Object.entries(res).map(([id, value]) => {
				value[ID_FIELD_NAME] = id;
				return value;
			});

			return this.__add_methods(arr);
		});
	}

	/**
	 * Returns the whole content of the JSON
	 * @returns {Promise<Record<string, T>>} The entire collection
	 */
	readRaw() {
		return this.__get_request({
			collection: this.collectionName,
			command: "read_raw",
		}).then((data) => {
			// preserve as object
			Object.keys(data).forEach((key) => {
				data[key][ID_FIELD_NAME] = key;
				this.addMethods(data[key]);
			});

			return data;
		});
	}

	/**
	 * Returns the whole content of the JSON
	 * @deprecated Use {@link readRaw} instead
	 * @returns {Promise<Record<string, T>>} The entire collection
	 */
	read_raw() {
		return this.readRaw();
	}

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of readRaw
	 * @param {SelectOption} selectOption - Select options
	 * @returns {Promise<Record<string, Partial<T>>>} Selected fields
	 */
	select(selectOption) {
		if (!selectOption) selectOption = {};
		return this.__get_request({
			collection: this.collectionName,
			command: "select",
			select: selectOption,
		}).then((data) => {
			Object.keys(data).forEach((key) => {
				data[key][ID_FIELD_NAME] = key;
				this.addMethods(data[key]);
			});

			return data;
		});
	}

	/**
	 * Get all distinct non-null values for a given key across a collection
	 * @param {ValueObject} valueOption - Value options
	 * @returns {Promise<T[]>} Array of unique values
	 */
	values(valueOption) {
		if (!valueOption) return Promise.reject("Value option must be provided");
		if (typeof valueOption.field !== "string") return Promise.reject("Field must be a string");
		if (valueOption.flatten !== undefined && typeof valueOption.flatten !== "boolean")
			return Promise.reject("Flatten must be a boolean");

		return this.__get_request({
			collection: this.collectionName,
			command: "values",
			values: valueOption,
		}).then((data) =>
			// no ID_FIELD or method injection since no ids are returned
			Object.values(data).filter((d) => d !== null),
		);
	}

	/**
	 * Returns random max entries offsets with a given seed
	 * @param {number} max - The maximum number of entries
	 * @param {number} seed - The seed to use
	 * @param {number} offset - The offset to use
	 * @returns {Promise<T[]>} The found elements
	 */
	random(max, seed, offset) {
		const params = {};
		if (max !== undefined) {
			if (typeof max !== "number" || !Number.isInteger(max) || max < -1)
				return Promise.reject(new Error("Expected integer >= -1 for the max"));
			params.max = max;
		}

		const hasSeed = seed !== undefined;
		const hasOffset = offset !== undefined;
		if (hasOffset && !hasSeed)
			return Promise.reject(new Error("You can't put an offset without a seed"));

		if (hasOffset && (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0))
			return Promise.reject(new Error("Expected integer >= -1 for the max"));

		if (hasSeed) {
			if (typeof seed !== "number" || !Number.isInteger(seed))
				return Promise.reject(new Error("Expected integer for the seed"));

			if (!hasOffset) offset = 0;
			params.seed = seed;
			params.offset = offset;
		}

		return this.__get_request({
			collection: this.collectionName,
			command: "random",
			random: params,
		}).then((data) => {
			Object.keys(data).forEach((key) => {
				data[key][ID_FIELD_NAME] = key;
				this.addMethods(data[key]);
			});

			return data;
		});
	}

	/**
	 * Creates write requests with given value
	 * @private
	 * @ignore
	 * @param {string} command The write command you want
	 * @param {Object} [value] The value for this command
	 * @param {boolean | undefined} multiple if I need to delete multiple
	 * @returns {Object} Write data object
	 */
	__write_data(command, value = undefined, multiple = false) {
		const obj = {
			token: writeToken(),
			collection: this.collectionName,
			command: command,
		};
		if (multiple === true && Array.isArray(value)) {
			// solves errors with undefined and null values
			value.forEach((v) => {
				if (typeof value != "number" && typeof value != "string" && !Array.isArray(value))
					delete v[ID_FIELD_NAME];
			});
		} else if (
			multiple === false &&
			value != null &&
			value != undefined &&
			typeof value != "number" &&
			typeof value != "string" &&
			!Array.isArray(value)
		) {
			// solves errors with undefined and null values
			delete value[ID_FIELD_NAME];
		}
		if (value) {
			if (multiple) obj["values"] = value;
			else obj["value"] = value;
		}

		return obj;
	}

	/**
	 * Set the entire JSON file contents
	 * @param {Record<string, T>} value - The value to write
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	writeRaw(value) {
		if (value === undefined || value === null) {
			return Promise.reject(new Error("writeRaw value must not be undefined or null"));
		}
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("write_raw", value)));
	}

	/**
	 * Set the entire JSON file contents
	 * @deprecated Use {@link writeRaw} instead
	 * @param {Record<string, T>} value - The value to write
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	write_raw(value) {
		return this.writeRaw(value);
	}

	/**
	 * Automatically add a value to the JSON file
	 * @param {T} value - The value (without methods) to add
	 * @returns {Promise<string>} The generated ID of the added element
	 */
	add(value) {
		return axios
			.post(writeAddress(), this.__write_data("add", value))
			.then((res) => this.__extract_data(res))
			.then((res) => {
				if (typeof res != "object" || !("id" in res) || typeof res.id != "string")
					return Promise.reject(new Error("Incorrect result"));
				return res.id;
			});
	}

	/**
	 * Automatically add multiple values to the JSON file
	 * @param {Object[]} values - The values (without methods) to add
	 * @returns {Promise<string[]>} The generated IDs of the added elements
	 */
	addBulk(values) {
		return this.__extract_data(
			axios.post(writeAddress(), this.__write_data("addBulk", values, true)),
		).then((res) => res.ids);
	}

	/**
	 * Remove an element from the collection by its ID
	 * @param {string | number} key The key from the entry to remove
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	remove(key) {
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("remove", key)));
	}

	/**
	 * Remove multiple elements from the collection by their IDs
	 * @param {string[] | number[]} keys The key from the entries to remove
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	removeBulk(keys) {
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("removeBulk", keys)));
	}

	/**
	 * Set a value in the collection by ID
	 * @param {string} key - The ID of the element you want to edit
	 * @param {T} value - The value (without methods) you want to edit
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	set(key, value) {
		const data = this.__write_data("set", value);
		data["key"] = key;
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Set multiple values in the collection by their IDs
	 * @param {string[]} keys - The IDs of the elements you want to edit
	 * @param {T[]} values - The values (without methods) you want to edit
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	setBulk(keys, values) {
		const data = this.__write_data("setBulk", values, true);
		data["keys"] = keys;
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Edit one field of the collection
	 * @param {EditObject} obj - The edit object
	 * @returns {Promise<{ success: boolean }>} Edit confirmation
	 */
	editField(obj) {
		const data = this.__write_data("editField", obj, null);
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Changes one field from an element in this collection
	 * @param {EditObject[]} objArray The edit object array with operations
	 * @returns {Promise<{ success: boolean[] }>} Edit confirmation
	 */
	editFieldBulk(objArray) {
		const data = this.__write_data("editFieldBulk", objArray, undefined);
		return this.__extract_data(axios.post(writeAddress(), data));
	}
}

/**
 * @namespace firestorm
 */
const firestorm = {
	/**
	 * Change the current Firestorm address
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
	 * Change the current Firestorm token
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
	 * @returns {Collection<T>} The collection
	 */
	collection(name, addMethods = (el) => el) {
		return new Collection(name, addMethods);
	},

	/**
	 * Create a temporary Firestorm collection with no methods
	 * @template T
	 * @param {string} name - The table name to get
	 * @returns {Collection<T>} The collection
	 */
	table(name) {
		return this.collection(name);
	},

	/** Value for the id field when researching content */
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
		 * @param {string} path - The file path wanted
		 * @returns {Promise<any>} File contents
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
		 * @param {FormData} form - The form data with path, filename, and file
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
		 * Deletes a file by path
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

try {
	if (typeof process === "object") module.exports = firestorm;
} catch (_error) {
	// normal browser
}
