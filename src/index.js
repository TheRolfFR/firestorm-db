const axios = require("axios").default;

const Collection = require("./collection.js");
const FirestormFiles = require("./files.js");

const { extractRequest } = require("./utils.js");

const ID_FIELD_NAME = "id";

/**
 * @typedef FirestormCreationOption
 * @property {string} [name] - Instance name (can be helpful for debugging)
 * @property {string} [address] - Firestorm server address
 * @property {token} [token] - Firestorm write token
 */

/**
 * Represents a Firestorm-powered server and its collections, tokens, and setup
 */
class Firestorm {
	/** @ignore */
	_name;
	/** @ignore */
	_address;
	/** @ignore */
	_token;

	/**
	 * Firestorm file manager
	 * @type {FirestormFiles}
	 */
	files;

	/**
	 * Create a new Firestorm instance
	 * - All parameters are optional and can be edited using the name, address, and token fields
	 * @param {FirestormCreationOption} [params] - Firestorm instance name, server address, and write token
	 */
	constructor({ name, address, token } = {}) {
		this.name = name;
		this.address = address;
		this.token = token;
		this.files = new FirestormFiles(this);
	}

	/**
	 * Create a new Firestorm collection instance
	 * @template T
	 * @param {string} name - The name of the collection
	 * @param {Function} [addMethods] - Additional methods and data to add to the objects
	 * @returns {Collection<T>} The collection instance
	 */
	collection(name, addMethods = (el) => el) {
		return new Collection(this, name, addMethods);
	}

	// jsdoc has a really hard time dealing with getters/setters so this makes it look decent

	/** @type {string} */
	get name() {
		return this._name || this.address;
	}

	/** @ignore */
	set name(newValue) {
		this._name = String(newValue);
	}

	name(newValue) {
		this.name = newValue;
		return this.name;
	}

	/** @type {string} */
	get token() {
		return this._token;
	}

	/** @ignore */
	set token(newValue) {
		this._token = newValue;
	}

	token(newValue) {
		this.token = newValue;
		return this.token;
	}

	/** @type {string} */
	get address() {
		return this._address;
	}

	/** @ignore */
	set address(newValue) {
		if (newValue && !newValue.endsWith("/")) newValue += "/";
		this._address = newValue;
	}

	address(newValue) {
		this.address = newValue;
		return this.address;
	}

	/**
	 * Get the current version of Firestorm
	 * @type {string}
	 */
	get clientVersion() {
		return require("../package.json").version;
	}

	/**
	 * Get the version of Firestorm used on the provided server
	 * @type {Promise<string>}
	 */
	get serverVersion() {
		if (!this.address)
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);

		return extractRequest(
			axios.get(`${this.address}version.php`, {
				data: {
					token: this.token,
				},
			}),
		);
	}

	/**
	 * Check whether the server-side Firestorm version is compatible with the client
	 * @returns {Promise<boolean>} - Whether the versions match
	 */
	async isCompatibleAddress() {
		const serverVersion = await this.serverVersion;
		const [serverMajor, serverMinor] = serverVersion.split(".");
		const [clientMajor, clientMinor] = this.clientVersion.split(".");

		// minor version keeps server compatibility (only added features), patch version is irrelevant
		return serverMajor === clientMajor && serverMinor >= clientMinor;
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
        const current_address = firestorm.__default_instance.address;
        if (newValue === undefined && current_address === undefined)
            throw new Error("Firestorm address was not configured");

        if (newValue !== undefined && !newValue.endsWith("/")) newValue += "/";
        if (newValue !== undefined) firestorm.__default_instance.address = newValue;

		return firestorm.__default_instance.collection("_").__read_address;
	},

	/**
	 * Change or get the current Firestorm token
	 * @param {string} [newValue] - The new Firestorm write token
	 * @returns {string} The stored Firestorm write token
	 */
    token(newValue = undefined) {
        const current_token = firestorm.__default_instance.token;
        if (newValue === undefined && current_token === undefined) throw new Error("Firestorm token was not configured");
		if (newValue !== undefined) firestorm.__default_instance.token = newValue;
		return firestorm.__default_instance.token;
	},

	/**
	 * Create a new Firestorm collection instance
	 * @template T
	 * @param {string} name - The name of the collection
	 * @param {Function} [addMethods] - Additional methods and data to add to the objects
	 * @returns {Collection<T>} The collection instance
	 */
	collection(name, addMethods = (el) => el) {
		return firestorm.__default_instance.collection(name, addMethods);
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

	/**
	 * Create as new instance of Firestorm
	 *
	 * @param {FirestormCreationOption} [params] - Firestorm instance name, server address, and write token
	 * @returns {Firestorm} New Firestorm instance
	 */
	create: function (params = {}) {
		return new Firestorm(params);
	},

	/** @type {Firestorm} */
	__default_instance: new Firestorm({ name: "__default" }),

	/** Value for the ID field when searching content */
	ID_FIELD: ID_FIELD_NAME,

	/**
	 * Firestorm file manager
	 * @type {FirestormFiles}
	 */
    get files() {
        return new FirestormFiles(firestorm.__default_instance);
	}
};

module.exports = firestorm;
