import axios from "axios";
import FormData from "form-data";

import { Collection } from "./collection.js";
import { extractData } from "./utils.js";
import { address, FILES, ID_FIELD_NAME, token } from "./settings.js";

import type { ItemBase, MethodsOnly, WriteConfirmation } from "./types/utils.js";

/**
 * @namespace firestorm
 */
const firestorm = {
	/**
	 * Change or get the current Firestorm address
	 * @memberof firestorm
	 * @param newValue - The new Firestorm address
	 * @returns The stored Firestorm address
	 */
	address,

	/**
	 * Change or get the current Firestorm token
	 * @memberof firestorm
	 * @param newValue - The new Firestorm write token
	 * @returns The stored Firestorm write token
	 */
	token,

	/**
	 * Create a new Firestorm collection instance
	 * @memberof firestorm
	 * @template Item - Type of the documents in the collection.
	 * @template ItemMethods - Type of the methods to add to the collection elements.
	 *
	 * @param name - The name of the collection
	 * @param addMethods - Additional methods and data to add to the objects
	 * @returns The collection instance
	 */
	collection<
		Item extends ItemBase,
		ItemMethods extends MethodsOnly<ItemMethods> = Record<string, never>,
	>(name: string, addMethods?: (el: Item) => ItemMethods) {
		return new Collection<Item, ItemMethods>(name, addMethods);
	},

	/** Value for the ID field when searching content */
	ID_FIELD: ID_FIELD_NAME,

	/**
	 * Firestorm file handler
	 * @memberof firestorm
	 * @type
	 * @namespace firestorm.files
	 */
	files: {
		/**
		 * Get a file by its path
		 * @memberof firestorm.files
		 * @template T - Type of file content
		 * @param path - The wanted file path
		 * @returns File contents
		 */
		get<T>(path: string): Promise<T> {
			return extractData(axios.get(FILES(), { params: { path } }));
		},

		/**
		 * Upload a file
		 * @memberof firestorm.files
		 * @param form - Form data with path, filename, and file
		 * @returns Write confirmation
		 */
		upload(form: FormData): Promise<WriteConfirmation> {
			form.append("token", firestorm.token());
			return extractData(
				axios.post(FILES(), form, {
					headers: {
						...form.getHeaders(),
					},
				}),
			);
		},

		/**
		 * Delete a file by its path
		 * @memberof firestorm.files
		 * @param path - The file path to delete
		 * @returns Write confirmation
		 */
		delete(path: string): Promise<WriteConfirmation> {
			return extractData(
				axios.delete(FILES(), {
					data: {
						path,
						token: firestorm.token(),
					},
				}),
			);
		},
	},
} as const;

export default firestorm;

export type * from "./types/searchOption.js";
export type * from "./types/utils.js";

export { Collection } from "./collection.js";
