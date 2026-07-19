import * as NodeFormData from "form-data";
import type { Firestorm } from "./index.d.ts";
import type { WriteConfirmation } from "./utils.d.ts";

/**
 * Firestorm file manager
 */
export declare interface FirestormFiles {
	/** Root Firestorm instance where the file address and token are based on */
	readonly instance: Firestorm;

	/**
	 * Get a file by its path
	 * @template T - Type of file content
	 * @param path - The wanted file path
	 * @returns File contents
	 */
	get<T>(path: string): Promise<T>;

	/**
	 * Upload a file
	 * @param form - Form data with path, filename, and file
	 * @returns Write confirmation
	 */
	upload(form: FormData | NodeFormData): Promise<WriteConfirmation>;

	/**
	 * Delete a file by its path
	 * @param path - The file path to delete
	 * @returns Write confirmation
	 */
	delete(path: string): Promise<WriteConfirmation>;
}
