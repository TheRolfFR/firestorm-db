import type { Firestorm } from "./instance.ts";

/**
 * A resource-like object that contains the necessary
 * properties for identifying a resource (Document or Collection).
 */
export interface ResourceLike {
	instance: Partial<Pick<Firestorm, "name" | "address" | "token">>;
	name: string;
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
