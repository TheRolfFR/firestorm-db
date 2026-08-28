import { FirestormError, requestJson } from "../utils.ts";

import type FormDataPkg from "form-data";
import type { Firestorm } from "../index.ts";
import type { HttpBodyRequest, HttpGetRequest, HttpHandler } from "../types/http.ts";
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

/** Options for file existence check */
export interface FileExistsOptions {
	path: string;
}

/** Options specific to file patch (append) */
export interface FilePatchCustomOptions {
	create?: boolean;
}

/** Options specific to file put (write) */
export interface FilePutCustomOptions {
	overwrite?: boolean;
}

/** Firestorm file manager */
export class FileManager implements HttpHandler {
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
	 * Get a file by its path or request configuration
	 * @template ReturnType - Type of file content
	 * @template Params - Request parameters type
	 * @template Options - Custom options type
	 * @param request - Request configuration
	 * @returns File contents
	 */
	public async get<ReturnType = unknown, Params = unknown, Options = Record<string, unknown>>(
		request: HttpGetRequest<Params, Options>,
	): Promise<ReturnType> {
		const path = request.path || "";
		const url = `${this.fileAddress}?path=${encodeURIComponent(path)}`;
		const response = await fetch(url, { method: "GET", headers: request.headers });

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
			return (await response.json()) as ReturnType;
		}
		if (
			contentType.startsWith("text/") ||
			contentType.includes("charset") ||
			contentType.includes("xml") ||
			contentType.includes("javascript")
		) {
			return (await response.text()) as ReturnType;
		}

		const arrayBuf = await response.arrayBuffer();
		if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
			return Buffer.from(arrayBuf) as ReturnType;
		}
		return arrayBuf as ReturnType;
	}

	/**
	 * Post (upload) a file
	 * @template ReturnType - Return confirmation type
	 * @template Body - Request body type
	 * @template Options - Custom options type
	 * @param request - Request configuration containing FormData body
	 * @returns Mutation confirmation
	 */
	public post<ReturnType = Confirmation, Body = unknown, Options = Record<string, unknown>>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		const form = request.body as FormData | FormDataPkg;

		if (!form || typeof form.append !== "function") {
			throw new TypeError("post requires FormData");
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
				headers: { ...formAny.getHeaders(), ...(request.headers || {}) },
				body: formAny.getBuffer() as BodyInit,
			};
		} else {
			init = {
				method: "POST",
				headers: request.headers,
				body: form as BodyInit,
			};
		}

		return requestJson<ReturnType>(this.fileAddress, init);
	}

	/**
	 * Delete a file by its request configuration
	 * @template ReturnType - Return confirmation type
	 * @template Body - Request body type
	 * @template Options - Custom options type
	 * @param request - Delete request configuration
	 * @returns Mutation confirmation
	 */
	public delete<ReturnType = Confirmation, Body = unknown, Options = Record<string, unknown>>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		const path = request.path || "";
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return requestJson<ReturnType>(this.fileAddress, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				...(request.headers || {}),
			},
			body: JSON.stringify({
				path,
				token,
			}),
		});
	}

	/**
	 * Copy a file directly without having to get/upload it first
	 * @template ReturnType - Return confirmation type
	 * @param options - Copy options
	 * @returns Mutation confirmation
	 */
	public copy<ReturnType = Confirmation>(options: FileCopyOptions): Promise<ReturnType> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		return requestJson<ReturnType>(this.fileAddress, {
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
	 * @template ReturnType - Return confirmation type
	 * @param options - Move options
	 * @returns Mutation confirmation
	 */
	public move<ReturnType = Confirmation>(options: FileMoveOptions): Promise<ReturnType> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}

		return requestJson<ReturnType>(this.fileAddress, {
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
	 * @param options - Existence check options
	 * @returns True if path exists, false otherwise
	 */
	public async exists(options: FileExistsOptions): Promise<boolean> {
		const path = options.path;
		const url = `${this.fileAddress}?path=${encodeURIComponent(path)}&action=exists`;
		const res = await requestJson<{ exists: boolean }>(url, {
			method: "GET",
		});
		return res.exists;
	}

	/**
	 * Patch (append) content to a file without having to get/upload/concatenate to it first
	 * @template ReturnType - Return confirmation type
	 * @template Body - Request body type
	 * @template Options - Custom options type
	 * @param request - Patch request configuration
	 * @returns Mutation confirmation
	 */
	public patch<ReturnType = Confirmation, Body = unknown, Options = FilePatchCustomOptions>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		const path = request.path || "";
		const content = String(request.body ?? "");
		const customOpts = request.options as FilePatchCustomOptions | undefined;
		const create = customOpts?.create;

		return requestJson<ReturnType>(this.fileAddress, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...(request.headers || {}),
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

	/**
	 * Put (write/replace) content of a file
	 * @template ReturnType - Return confirmation type
	 * @template Body - Request body type
	 * @template Options - Custom options type
	 * @param request - Put request configuration
	 * @returns Mutation confirmation
	 */
	public put<ReturnType = Confirmation, Body = unknown, Options = FilePutCustomOptions>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		const token = this.instance.token;
		if (!token) {
			throw new Error(`Token for Firestorm instance "${this.instance.name}" was not configured`);
		}
		const path = request.path || "";
		const content = String(request.body ?? "");
		const customOpts = request.options as FilePutCustomOptions | undefined;
		const overwrite = customOpts?.overwrite;

		return requestJson<ReturnType>(this.fileAddress, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...(request.headers || {}),
			},
			body: JSON.stringify({
				token,
				path,
				content,
				overwrite,
			}),
		});
	}
}
