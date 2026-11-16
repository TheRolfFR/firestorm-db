import { FirestormError, requestJson } from "../utils.ts";

import type FormDataPkg from "form-data";
import type { Firestorm } from "../index.ts";
import type { Confirmation } from "../types/utils.ts";

/** Options for file copy */
export interface FileCopyOptions {
	oldPath: string;
	newPath: string;
	overwrite?: boolean;
}

/** Options for file move */
export interface FileMoveOptions {
	oldPath: string;
	newPath: string;
	overwrite?: boolean;
}

/** Options for file append */
export interface FileAppendOptions {
	/** Create the file if it does not exist yet */
	create?: boolean;
}

/** Options for text file upload */
export interface FileUploadTextOptions {
	/** Replace the file if it already exists */
	overwrite?: boolean;
}

/** Optional request settings shared by file methods */
export interface FileRequestOptions {
	/** Additional request headers */
	headers?: Record<string, string>;
}

/** Firestorm file manager */
export class FileManager {
	/**
	 * Create a new Firestorm file manager based on a root instance
	 * @param instance - Root Firestorm instance
	 */
	constructor(private readonly instance: Firestorm) {}

	/**
	 * Files API endpoint address (files.php)
	 * @ignore
	 */
	private get fileAddress(): string {
		const addr = this.instance.address;
		if (!addr) {
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return `${addr}files.php`;
	}

	/**
	 * Get a file by its path
	 * @template ReturnType - Type of file content
	 * @param path - Path of the file
	 * @param options - Request settings
	 * @returns File contents
	 */
	public async get<ReturnType = unknown>(
		path: string,
		options: FileRequestOptions = {},
	): Promise<ReturnType> {
		const url = `${this.fileAddress}?path=${encodeURIComponent(path)}`;
		const response = await fetch(url, { method: "GET", headers: options.headers });

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
						} else if (typeof json.response === "string") {
							message = json.response;
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
			return response.json() as Promise<ReturnType>;
		}
		if (
			contentType.startsWith("text/") ||
			contentType.includes("charset") ||
			contentType.includes("xml") ||
			contentType.includes("javascript")
		) {
			return response.text() as Promise<ReturnType>;
		}

		const arrayBuf = await response.arrayBuffer();
		if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
			return Buffer.from(arrayBuf) as ReturnType;
		}
		return arrayBuf as ReturnType;
	}

	/**
	 * Upload a file
	 * @param form - FormData holding the `path`, `file` and optional `overwrite` fields
	 * @param options - Request settings
	 * @returns Mutation confirmation
	 */
	public upload(
		form: FormData | FormDataPkg,
		options: FileRequestOptions = {},
	): Promise<Confirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		if (!form || typeof form.append !== "function") {
			throw new TypeError("upload requires FormData");
		}

		form.append("token", token);

		let init: RequestInit;
		const formAny = form as {
			getHeaders?: () => Record<string, string>;
			getBuffer?: () => Buffer;
		};
		if (typeof formAny.getHeaders === "function" && typeof formAny.getBuffer === "function") {
			init = {
				method: "POST",
				headers: { ...formAny.getHeaders(), ...(options.headers || {}) },
				body: formAny.getBuffer() as BodyInit,
			};
		} else {
			init = {
				method: "POST",
				headers: options.headers,
				body: form as BodyInit,
			};
		}

		return requestJson<Confirmation>(this.fileAddress, init);
	}

	/**
	 * Delete a file by its path
	 * @param path - Path of the file
	 * @param options - Request settings
	 * @returns Mutation confirmation
	 */
	public delete(path: string, options: FileRequestOptions = {}): Promise<Confirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return requestJson<Confirmation>(this.fileAddress, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				...(options.headers || {}),
			},
			body: JSON.stringify({
				path,
				token,
			}),
		});
	}

	/**
	 * Copy a file directly without having to get/upload it first
	 * @param options - Copy options
	 * @returns Mutation confirmation
	 */
	public copy(options: FileCopyOptions): Promise<Confirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		return requestJson<Confirmation>(this.fileAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				action: "copy",
				token,
				...options,
			}),
		});
	}

	/**
	 * Move a file directly without having to get, upload, and delete it first
	 * @param options - Move options
	 * @returns Mutation confirmation
	 */
	public move(options: FileMoveOptions): Promise<Confirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		return requestJson<Confirmation>(this.fileAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				action: "move",
				token,
				...options,
			}),
		});
	}

	/**
	 * Checks if a path exists
	 * @param path - Path to check
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
	 * @param path - Path of the file
	 * @param content - Text to append
	 * @param options - Append and request settings
	 * @returns Mutation confirmation
	 */
	public append(
		path: string,
		content: string,
		options: FileAppendOptions & FileRequestOptions = {},
	): Promise<Confirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		return requestJson<Confirmation>(this.fileAddress, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...(options.headers || {}),
			},
			body: JSON.stringify({
				action: "append",
				token,
				path,
				content,
				create: options.create,
			}),
		});
	}

	/**
	 * Write (create or replace) the content of a file
	 * @param path - Path of the file
	 * @param content - Text to upload
	 * @param options - Upload and request settings
	 * @returns Mutation confirmation
	 */
	public uploadText(
		path: string,
		content: string,
		options: FileUploadTextOptions & FileRequestOptions = {},
	): Promise<Confirmation> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		return requestJson<Confirmation>(this.fileAddress, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...(options.headers || {}),
			},
			body: JSON.stringify({
				token,
				path,
				content,
				overwrite: options.overwrite,
			}),
		});
	}
}
