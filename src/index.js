try {
	if (typeof process === "object") var axios = require("axios").default;
} catch (_error) {}

/**
 * @typedef {Object} SearchOption
 * @property {string} field The field you want to search in
 * @property {"!=" | "==" | ">=" | "<=" | "<" | ">" | "in" | "includes" | "startsWith" | "endsWith" | "array-contains" | "array-contains-any" | "array-length-(eq|df|gt|lt|ge|le)" } criteria filter criteria
 * @property {string | number | boolean | Array } value the value you want to compare
 * @property {boolean} ignoreCase Ignore case on search string
 */

/**
 * @typedef {Object} EditObject
 * @property {string | number } id the affected element
 * @property {string} field The field you want to edit
 * @property {"set" | "remove" | "append" | "increment" | "decrement" | "array-push" | "array-delete" | "array-splice"} operation Wanted operation on field
 * @property {string | number | boolean | Array } [value] // the value you want to compare
 */

/**
 * @typedef {Object} SelectOption
 * @property {Array<string>} fields Chosen fields to eventually return
 */

/**
 * @ignore
 */
let _address = undefined;

/**
 * @ignore
 */
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
 * Auto-extracts data from Axios request
 * @ignore
 * @param {Promise<import("axios").AxiosPromise>} request The Axios concerned request
 */
const __extract_data = (request) => {
	return new Promise((resolve, reject) => {
		request
			.then((res) => {
				if ("data" in res) return resolve(res.data);
				resolve(res);
			})
			.catch((err) => {
				reject(err);
			});
	});
};

/**
 * Class representing a collection
 * @template T
 */
class Collection {
	/**
	 * @param {string} name The name of the Collection
	 * @param {Function} [addMethods] Additional methods and data to add to the objects
	 */
	constructor(name, addMethods = (el) => el) {
		if (name === undefined) throw new SyntaxError("Collection must have a name");
		if (typeof addMethods !== "function")
			throw new TypeError("Collection must have an addMethods of type Function");
		this.addMethods = addMethods;
		this.collectionName = name;
	}

	/**
	 * Add user methods to the returned data
	 * @private
	 * @ignore
	 * @param {import("axios").AxiosPromise} req Incoming request
	 * @returns {Object|Object[]}
	 */
	__add_methods(req) {
		return new Promise((resolve, reject) => {
			req
				.then((el) => {
					if (Array.isArray(el)) {
						return resolve(el.map((e) => this.addMethods(e)));
					}

					el[Object.keys(el)[0]][ID_FIELD_NAME] = Object.keys(el)[0];
					el = el[Object.keys(el)[0]];

					// else on the object itself
					return resolve(this.addMethods(el));
				})
				.catch((err) => reject(err));
		});
	}

	/**
	 * Auto-extracts data from Axios request
	 * @private
	 * @ignore
	 * @param {AxiosPromise} request The Axios concerned request
	 */
	__extract_data(request) {
		return __extract_data(request);
	}

	/**
	 * Send get request and extract data from response
	 * @private
	 * @ignore
	 * @param {Object} data Body data
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
	 * @param {string | number} id The entry ID
	 * @returns {Promise<T>} Result entry you may be looking for
	 */
	get(id) {
		return this.__add_methods(
			this.__get_request({
				collection: this.collectionName,
				command: "get",
				id: id,
			}),
		);
	}

	/**
	 * @returns {string} returns sha1 hash of the file. can be used to see if same file content without downloading the file for example
	 */
	sha1() {
		return this.__get_request({
			collection: this.collectionName,
			command: "sha1",
		});
	}

	/**
	 * Search through collection
	 * @param {SearchOption[]} searchOptions Array of search options
	 * @param {(number | false | true)} [random] Random result seed, disabled by default, but can activated with true or a given seed
	 * @returns {Promise<T[]>}
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

		let params = {
			collection: this.collectionName,
			command: "search",
			search: searchOptions,
		};

		if (random !== false) {
			if (random === true) {
				params.random = {};
			} else {
				let seed = parseInt(random);
				if (isNaN(seed))
					return Promise.reject(
						new Error("random takes as parameter true, false or an integer value"),
					);
				params.random = {
					seed: seed,
				};
			}
		}

		return new Promise((resolve, reject) => {
			let raw;
			this.__get_request(params)
				.then((res) => {
					const arr = [];

					raw = res;
					Object.keys(res).forEach((contribID) => {
						const tmp = res[contribID];
						tmp[ID_FIELD_NAME] = contribID;
						arr.push(tmp);
					});

					resolve(this.__add_methods(Promise.resolve(arr)));
				})
				.catch((err) => {
					err.raw = raw;
					reject(err);
				});
		});
	}

	/**
	 * Search specific keys through collection
	 * @param {string[] | number[]} keys Wanted keys
	 * @returns {Promise<T[]>} Search results
	 */
	searchKeys(keys) {
		if (!Array.isArray(keys)) return Promise.reject("Incorrect keys");

		return new Promise((resolve, reject) => {
			this.__get_request({
				collection: this.collectionName,
				command: "searchKeys",
				search: keys,
			})
				.then((res) => {
					const arr = [];
					Object.keys(res).forEach((contribID) => {
						const tmp = res[contribID];
						tmp[ID_FIELD_NAME] = contribID;
						arr.push(tmp);
					});

					resolve(this.__add_methods(Promise.resolve(arr)));
				})
				.catch((err) => reject(err));
		});
	}

	/**
	 * @deprecated use readRaw instead
	 */
	read_raw() {
		return this.readRaw();
	}

	/**
	 * Returns the whole content of the file
	 * @returns {Promise} // the get promise of the collection raw file content
	 */
	readRaw() {
		return new Promise((resolve, reject) => {
			this.__get_request({
				collection: this.collectionName,
				command: "read_raw",
			})
				.then((data) => {
					Object.keys(data).forEach((key) => {
						data[key][ID_FIELD_NAME] = key;
						this.addMethods(data[key]);
					});

					resolve(data);
				})
				.catch(reject);
		});
	}

	/**
	 * Upgraded read raw with field selection
	 * @param {SelectOption} selectOption Select options
	 */
	select(selectOption) {
		if (!selectOption) selectOption = {};
		return new Promise((resolve, reject) => {
			this.__get_request({
				collection: this.collectionName,
				command: "select",
				select: selectOption,
			})
				.then((data) => {
					Object.keys(data).forEach((key) => {
						data[key][ID_FIELD_NAME] = key;
						this.addMethods(data[key]);
					});

					resolve(data);
				})
				.catch(reject);
		});
	}

	/**
	 * Returns random max entries offsets with a given seed
	 * @param {number} max integer
	 * @param {number} seed integer
	 * @param {number} offset integer
	 * @returns {Promise} entries
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

			return Promise.resolve(data);
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
	 * Writes the raw JSON file
	 * @param {Object} value The whole JSON to write
	 * @returns {Promise<any>}
	 */
	writeRaw(value) {
		if (value === undefined || value === null) {
			return Promise.reject(new Error("writeRaw value must not be undefined or null"));
		}
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("write_raw", value)));
	}

	/**
	 * Writes the raw JSON file
	 * @param {Object} value
	 * @deprecated use writeRaw instead
	 * @returns {Promise<any>}
	 */
	write_raw(value) {
		return this.writeRaw(value);
	}

	/**
	 * Add automatically a value to the JSON
	 * @param {Object} value The value to add
	 * @returns {Promise<any>}
	 */
	add(value) {
		return new Promise((resolve, reject) => {
			axios
				.post(writeAddress(), this.__write_data("add", value))
				.then((res) => {
					return this.__extract_data(Promise.resolve(res));
				})
				.then((res) => {
					if (typeof res != "object" || !("id" in res) || typeof res.id != "string")
						throw new Error("Incorrect result");
					resolve(res.id);
				})
				.catch((err) => {
					reject(err);
				});
		});
	}

	/**
	 * Add automatically multiple values to the JSON
	 * @param {Object[]} values The values to add
	 * @returns {Promise<any>}
	 */
	addBulk(values) {
		return new Promise((resolve, reject) => {
			this.__extract_data(axios.post(writeAddress(), this.__write_data("addBulk", values, true)))
				.then((res) => {
					resolve(res.ids);
				})
				.catch(reject);
		});
	}

	/**
	 * Remove entry with its key from the JSON
	 * @param {string | number} key The key from the entry to remove
	 * @returns {Promise<any>}
	 */
	remove(key) {
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("remove", key)));
	}

	/**
	 * Remove entry with their keys from the JSON
	 * @param {string[] | number[]} keys The key from the entries to remove
	 * @returns {Promise<any>}
	 */
	removeBulk(keys) {
		return this.__extract_data(axios.post(writeAddress(), this.__write_data("removeBulk", keys)));
	}

	/**
	 * Sets an entry in the JSON
	 * @param {string} key The key of the value you want to set
	 * @param {Object} value The value you want for this key
	 * @returns {Promise<any>}
	 */
	set(key, value) {
		const data = this.__write_data("set", value);
		data["key"] = key;
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Sets multiple entries in the JSON
	 * @param {string[]} keys The array of keys of the values you want to set
	 * @param {Object[]} values The values you want for these keys
	 * @returns {Promise<any>}
	 */
	setBulk(keys, values) {
		const data = this.__write_data("setBulk", values, true);
		data["keys"] = keys;
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Changes one field from an element in this collection
	 * @param {EditObject} obj The edit object
	 * @returns {Promise<any>}
	 */
	editField(obj) {
		const data = this.__write_data("editField", obj, null);
		return this.__extract_data(axios.post(writeAddress(), data));
	}

	/**
	 * Changes one field from an element in this collection
	 * @param {EditObject[]} objArray The edit object array with operations
	 * @returns {Promise<any>}
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
	 * @param {string} newValue The new address value
	 * @returns {string} The stored address value
	 * @memberof firestorm
	 */
	address(newValue = undefined) {
		if (newValue === undefined) return readAddress();
		if (newValue) _address = newValue;

		return _address;
	},

	/**
	 * @param {string} newValue The new write token
	 * @returns {string} The stored write token
	 */
	token(newValue = undefined) {
		if (newValue === undefined) return writeToken();
		if (newValue) _token = newValue;

		return _token;
	},
	/**
	 * @param {string} name Collection name to get
	 * @param {Function} addMethods Additional methods and data to add to the objects
	 * @returns {Collection}
	 */
	collection(name, addMethods = (el) => el) {
		return new Collection(name, addMethods);
	},

	/**
	 *
	 * @param {string} name Table name to get
	 */
	table(name) {
		return this.collection(name);
	},

	/**
	 * Value for the id field when researching content
	 */
	ID_FIELD: ID_FIELD_NAME,

	/**
	 * Test child object with child namespace
	 * @memberof firestorm
	 * @type {Object}
	 * @namespace firestorm.files
	 */
	files: {
		/**
		 * gets file back
		 * @memberof firestorm.files
		 * @param {string} path File path wanted
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
		 * Uploads file
		 * @memberof firestorm.files
		 * @param {FormData} form formData with path, filename and file
		 * @returns {Promise} http response
		 */
		upload(form) {
			form.append("token", firestorm.token());
			return axios.post(fileAddress(), form, {
				headers: {
					...form.getHeaders(),
				},
			});
		},

		/**
		 * Deletes a file given its path
		 * @memberof firestorm.files
		 * @param {string} path File path to delete
		 * @returns {Promise} http response
		 */
		delete(path) {
			return axios.delete(fileAddress(), {
				data: {
					path,
					token: firestorm.token(),
				},
			});
		},
	},
};

try {
	if (typeof process === "object") module.exports = firestorm;
} catch (_error) {
	// normal browser
}
