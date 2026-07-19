const axios = require("axios").default;

/**
 * Add methods to a collection
 * @ignore
 * @param {require("./collection.js").Collection} collection
 * @param {any} el - Value to call
 * @param {boolean} [nested] - Nest the methods inside an object
 * @returns {any} Mapped value
 */
function applyAddMethods(collection, el, nested = true) {
	// can't map falsy values
	if (!el) return el;
	if (Array.isArray(el)) return el.map((el) => collection.addMethods(el, collection));
	// nested objects
	if (nested && typeof el === "object") {
		Object.keys(el).forEach((k) => {
			el[k] = collection.addMethods(el[k], collection);
		});
		return el;
	}

	// apply directly to single object
	return collection.addMethods(el, collection);
}

/**
 * Extract an Axios request into its returned data
 * @ignore
 * @param {any} request - Incoming Axios request
 * @returns {any} Unwrapped Axios response data
 */
async function extractRequest(request) {
	// does nothing if request is synchronous
	const res = await request;
	if ("data" in res) return res.data;
	return res;
}

/**
 * Send GET request with provided data and return extracted response
 * @ignore
 * @param {require("./collection.js").Collection} collection - Collection
 * @param {string} command - The read command name
 * @param {Object} [data] - Body data
 * @param {boolean} [objectLike] - Reject if an object or array isn't being returned
 * @returns {Promise<any>} Extracted response
 */
async function getData(collection, command, data = {}, objectLike = true) {
	const obj = {
		collection: collection.collectionName,
		command: command,
		...data,
	};
	const request = axios.get(collection.__read_address, { data: obj });
	const res = await extractRequest(request);
	// reject php error strings if enforcing return type
	if (objectLike && typeof res !== "object") throw res;
	return res;
}

/**
 * Generate POST data with provided data
 * @ignore
 * @param {require("./collection.js").Collection} collection - Collection
 * @param {string} command - The write command name
 * @param {Object} [value] - The value for the command
 * @param {boolean} [multiple] - Used to delete multiple
 * @returns {Object} Write data object
 */
function createPostData(collection, command, value = undefined, multiple = false) {
	const obj = {
		collection: collection.collectionName,
		token: collection.instance.token,
		command,
	};

	// clone/serialize data if possible (prevents mutating data)
	if (value) value = JSON.parse(JSON.stringify(value));

	if (multiple && Array.isArray(value)) {
		value.forEach((v) => {
			if (typeof v === "object" && !Array.isArray(v) && v != null) delete v[collection.ID_FIELD];
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
		delete value[collection.ID_FIELD];
	}

	if (value) {
		if (multiple) obj.values = value;
		else obj.value = value;
	}

	return obj;
}

exports.applyAddMethods = applyAddMethods;
exports.extractRequest = extractRequest;
exports.getData = getData;
exports.createPostData = createPostData;
