import type { IdEncoding, MaybeArray, WriteConfirmation } from "./types/utils.ts";
import type { EditFieldOption } from "./types/editFieldOption.ts";

import { ResourceManager } from "./resource.ts";

/**
 * A resource-like object that contains the necessary
 * properties for identifying a resource (Document or Collection).
 */
export interface ResourceLike {
	instance: { name?: string; address?: string; token?: string };
	collectionName: string;
}

/**
 * HTTP response details attached to a FirestormError.
 */
export interface ResponseDetails<T = unknown> {
	status: number;
	statusText: string;
	data: T;
	headers: Headers;
}

/**
 * Error thrown when an HTTP request fails.
 */
export class FirestormError<T = unknown> extends Error {
	public readonly response?: ResponseDetails<T>;

	constructor(message: string, response?: ResponseDetails<T>) {
		super(message);
		this.name = "FirestormError";
		this.response = response;
	}
}

/**
 * Perform an HTTP request and parse JSON or text response.
 * Throws a FirestormError if response.ok is false.
 */
export async function requestJson<ReturnType = unknown>(
	url: string,
	init: RequestInit = {},
): Promise<ReturnType> {
	const response = await fetch(url, init);
	const text = await response.text();

	let body: unknown = text;
	if (text.length > 0) {
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
	}

	if (!response.ok) {
		let message = `Request failed with status code ${response.status}`;
		if (body && typeof body === "object") {
			const obj = body as Record<string, unknown>;
			if (typeof obj.error === "string") {
				message = obj.error;
			} else if (typeof obj.message === "string") {
				message = obj.message;
			}
		} else if (typeof body === "string" && body.trim().length > 0) {
			message = body;
		}

		throw new FirestormError(message, {
			status: response.status,
			statusText: response.statusText,
			data: body,
			headers: response.headers,
		});
	}

	return body as ReturnType;
}

/**
 * Send POST request for Document operations and return extracted response
 * @param doc - The document instance
 * @param command - The write command name
 * @param value - The value for the command
 * @param multiple - Used for bulk operations
 * @param additionalData - Additional payload fields
 * @returns Extracted response
 */
export async function documentPostRequest<ReturnType = WriteConfirmation>(
	doc: ResourceLike,
	command: string,
	value: unknown = undefined,
	multiple: boolean | null = false,
	additionalData: Record<string, unknown> = {},
): Promise<ReturnType> {
	const mgr = new ResourceManager(doc.instance as any, doc.collectionName);
	return mgr.postRequest<ReturnType>(command, value, multiple, additionalData);
}

/**
 * Send GET request for Document operations and return extracted response
 * @param doc - The document instance
 * @param command - The read command name
 * @param params - Body data
 * @param objectLike - Reject if an object or array isn't being returned
 * @returns Extracted response
 */
export async function documentGetRequest<ReturnType>(
	doc: ResourceLike,
	command: string,
	params: Record<string, unknown> = {},
	objectLike = true,
): Promise<ReturnType> {
	const mgr = new ResourceManager(doc.instance as any, doc.collectionName);
	return mgr.getRequest<ReturnType>(command, params, objectLike);
}

/**
 * Send POST request for Collection operations and return extracted response
 * @param collection - The collection instance
 * @param command - The write command name
 * @param value - The value for the command
 * @param multiple - Used for bulk operations
 * @param additionalData - Additional payload fields
 * @returns Extracted response
 */
export async function colPostRequest<
	Item extends Record<string, unknown>,
	ReturnType = WriteConfirmation,
>(
	collection: ResourceLike,
	command: string,
	value:
		| Record<string, Item>
		| MaybeArray<Item>
		| MaybeArray<IdEncoding>
		| MaybeArray<EditFieldOption<Item>>
		| undefined = undefined,
	multiple: boolean | null = false,
	additionalData: Record<string, unknown> = {},
): Promise<ReturnType> {
	const mgr = new ResourceManager(collection.instance as any, collection.collectionName);
	return mgr.postRequest<ReturnType>(command, value, multiple, additionalData);
}

/**
 * Send GET request for Collection operations and return extracted response
 * @param collection - The collection instance
 * @param command - The read command name
 * @param params - Body data
 * @param objectLike - Reject if an object or array isn't being returned
 * @returns Extracted response
 */
export async function colGetRequest<ReturnType>(
	collection: ResourceLike,
	command: string,
	params: Record<string, unknown> = {},
	objectLike = true,
): Promise<ReturnType> {
	const mgr = new ResourceManager(collection.instance as any, collection.collectionName);
	return mgr.getRequest<ReturnType>(command, params, objectLike);
}
