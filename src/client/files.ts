import type FormDataPkg from "form-data";
import { FirestormError, requestJson } from "./utils.ts";
import type { WriteConfirmation } from "./types/utils.ts";
import type { Firestorm } from "./index.ts";

/** Firestorm file manager */
export class FileManager {
	/**
	 * Create a new Firestorm file manager based on a root instance
	 * @param instance - Root Firestorm instance
	 */
	constructor(private readonly instance: Firestorm) {}

	/** @ignore */
	private get fileAddress(): string {
		const addr = this.instance.address;
		if (!addr) {
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return `${addr}files.php`;
	}

	/**
	 * Get a file by its path
	 * @template T - Type of file content
	 * @param path - The wanted file path
	 * @returns File contents
	 */
	public async get<T>(path: string): Promise<T> {
		const url = `${this.fileAddress}?path=${encodeURIComponent(path)}`;
		const response = await fetch(url, { method: "GET" });

		if (!response.ok) {
			const text = await response.text();
			let message = `Request failed with status code ${response.status}`;
			if (text.length > 0) {
				try {
					const json = JSON.parse(text);
					if (json && typeof json === "object") {
						if (typeof json.error === "string") {
							message = json.error;
						} else if (typeof json.message === "string") {
							message = json.message;
						}
					}
				} catch {
					message = text;
				}
			}
			throw new FirestormError(message, {
				status: response.status,
				statusText: response.statusText,
				data: text,
				headers: response.headers,
			});
		}

		const contentType = response.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			return (await response.json()) as T;
		}
		if (
			contentType.startsWith("text/") ||
			contentType.includes("charset") ||
			contentType.includes("xml") ||
			contentType.includes("javascript")
		) {
			return (await response.text()) as T;
		}

		const arrayBuf = await response.arrayBuffer();
		if (typeof Buffer !== "undefined" && typeof (Buffer as any).from === "function") {
			return Buffer.from(arrayBuf) as unknown as T;
		}
		return arrayBuf as unknown as T;
	}

	/**
	 * Upload a file
	 * @param form - Form data with path, filename, and file
	 * @returns Write confirmation
	 */
	public upload(form: FormData | FormDataPkg): Promise<WriteConfirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		form.append("token", token);

		let init: RequestInit;
		const formAny = form as unknown as {
			getHeaders?: () => Record<string, string>;
			getBuffer?: () => Buffer;
		};
		if (typeof formAny.getHeaders === "function" && typeof formAny.getBuffer === "function") {
			init = {
				method: "POST",
				headers: formAny.getHeaders(),
				body: formAny.getBuffer() as unknown as BodyInit,
			};
		} else {
			init = {
				method: "POST",
				body: form as unknown as BodyInit,
			};
		}

		return requestJson<WriteConfirmation>(this.fileAddress, init);
	}

	/**
	 * Delete a file by its path
	 * @param path - The file path to delete
	 * @returns Write confirmation
	 */
	public delete(path: string): Promise<WriteConfirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return requestJson<WriteConfirmation>(this.fileAddress, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				path,
				token,
			}),
		});
	}

	/**
	 * Copy a file directly without having to get/upload it first
	 * @param oldPath - Source file path
	 * @param newPath - Destination file path
	 * @param overwrite - Whether to overwrite if destination file exists
	 * @returns Write confirmation
	 */
	public copy(oldPath: string, newPath: string, overwrite?: boolean): Promise<WriteConfirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return requestJson<WriteConfirmation>(this.fileAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				action: "copy",
				token,
				oldPath,
				newPath,
				overwrite,
			}),
		});
	}

	/**
	 * Move a file directly without having to get, upload, and delete it first
	 * @param oldPath - Source file path
	 * @param newPath - Destination file path
	 * @param overwrite - Whether to overwrite if destination file exists
	 * @returns Write confirmation
	 */
	public move(oldPath: string, newPath: string, overwrite?: boolean): Promise<WriteConfirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return requestJson<WriteConfirmation>(this.fileAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				action: "move",
				token,
				oldPath,
				newPath,
				overwrite,
			}),
		});
	}

	/**
	 * Checks if a path exists
	 * @param path - The file path to check
	 * @returns True if path exists, false otherwise
	 */
	public async exists(path: string): Promise<boolean> {
		const url = `${this.fileAddress}?path=${encodeURIComponent(path)}&action=exists`;
		const res = await requestJson<{ exists: boolean }>(url, {
			method: "GET",
		});
		return res.exists;
	}

	/**
	 * Append content to a file without having to get/upload/concatenate to it first
	 * @param path - The file path to append to
	 * @param content - Content to append
	 * @param create - Whether to create the file if it does not exist
	 * @returns Write confirmation
	 */
	public append(path: string, content: string, create?: boolean): Promise<WriteConfirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return requestJson<WriteConfirmation>(this.fileAddress, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				action: "append",
				token,
				path,
				content,
				create,
			}),
		});
	}
}
