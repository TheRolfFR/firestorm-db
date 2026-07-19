const axios = require("axios").default;
const { extractRequest } = require("./utils.js");

/**
 * Node.js FormData typedef to avoid documentation generation problems
 * @ignore
 * @typedef {require("form-data").FormData} NodeFormData
 */

/** Firestorm file manager */
class FirestormFiles {
	/**
	 * Root Firestorm instance
	 * @type {Firestorm}
	 */
	instance;

	/**
	 * Create a new Firestorm file manager based on a root instance
	 * @param {Firestorm} instance
	 */
	constructor(instance) {
		this.instance = instance;
	}

	/** @ignore */
	get __file_address() {
		if (!this.instance.address)
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		return `${this.instance.address}files.php`;
	}

	/**
	 * Get a file by its path
	 * @template T - Type of file content
	 * @param {string} path - The wanted file path
	 * @returns {Promise<T>} File contents
	 */
	get(path) {
		return extractRequest(
			axios.get(this.__file_address, {
				params: { path },
			}),
		);
	}

	/**
	 * Upload a file
	 * @param {FormData | NodeFormData} form - Form data with path, filename, and file
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	upload(form) {
		form.append("token", this.instance.token);
		return extractRequest(
			axios.post(this.__file_address, form, {
				headers: { ...form.getHeaders() },
			}),
		);
	}

	/**
	 * Delete a file by its path
	 * @param {string} path - The file path to delete
	 * @returns {Promise<WriteConfirmation>} Write confirmation
	 */
	delete(path) {
		return extractRequest(
			axios.delete(this.__file_address, {
				data: {
					path,
					token: this.instance.token,
				},
			}),
		);
	}
}

module.exports = FirestormFiles;
