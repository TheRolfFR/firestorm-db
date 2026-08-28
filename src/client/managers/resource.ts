import { FirestormError, requestJson } from "../utils.ts";

import type { Firestorm } from "../instance.ts";
import type { HttpBodyRequest, HttpGetRequest, HttpHandler } from "../types/http.ts";
import type { Confirmation } from "../types/utils.ts";

/**
 * Options specific to ResourceManager GET requests.
 */
export interface ResourceGetOptions {
	/** Whether to reject non-object responses */
	objectLike?: boolean;
}

/**
 * Options specific to ResourceManager mutation requests (POST, PUT, PATCH, DELETE).
 */
export interface ResourceMutationOptions {
	/** Whether operation applies to multiple items */
	multiple?: boolean | null;
	/** Additional payload data */
	additionalData?: Record<string, unknown>;
}

/**
 * Manages resource-level HTTP requests and encapsulates endpoint communication.
 */
export class ResourceManager implements HttpHandler {
	/**
	 * @param instance - Root Firestorm instance.
	 * @param name - Name of the resource stored in Firestorm.
	 */
	constructor(
		public readonly instance: Firestorm,
		public readonly name: string,
	) {
		if (!name) throw new Error("Resource must have a name");
	}

	/**
	 * Get the name of the resource.
	 */
	public get resourceName(): string {
		return this.name;
	}

	/**
	 * Read API endpoint address (get.php)
	 * @ignore
	 */
	private get readAddress(): string {
		const addr = this.instance.address;
		if (!addr) {
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return `${addr}get.php`;
	}

	/**
	 * Write API endpoint address (post.php)
	 * @ignore
	 */
	private get writeAddress(): string {
		const addr = this.instance.address;
		if (!addr) {
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return `${addr}post.php`;
	}

	/**
	 * Send read request for the resource and return extracted response.
	 * @template ReturnType - Expected response data type.
	 * @template Params - Request parameters type.
	 * @template Options - Custom options type.
	 * @param request - Request configuration (path, params, headers, options).
	 * @returns Extracted response.
	 */
	public async get<ReturnType = unknown, Params = unknown, Options = ResourceGetOptions>(
		request: HttpGetRequest<Params, Options>,
	): Promise<ReturnType> {
		const obj = {
			collection: this.resourceName,
			command: request.path,
			...((request.params || {}) as Record<string, unknown>),
		};

		const extracted = await requestJson<ReturnType>(this.readAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(request.headers || {}),
			},
			body: JSON.stringify(obj),
		});

		const objectLike = (request.options as ResourceGetOptions | undefined)?.objectLike ?? true;
		if (objectLike && (typeof extracted !== "object" || extracted === null)) {
			throw new FirestormError(
				typeof extracted === "string" ? extracted : "Unexpected non-object response from server",
			);
		}
		return extracted;
	}

	/**
	 * Send write request using HTTP POST.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 * @param request - Request configuration (path, body, headers, options).
	 * @returns Extracted response.
	 */
	public post<ReturnType = Confirmation, Body = unknown, Options = ResourceMutationOptions>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		return this.sendMutation<ReturnType, Body, Options>("POST", request);
	}

	/**
	 * Send delete request using HTTP DELETE.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 * @param request - Request configuration (path, body, headers, options).
	 * @returns Extracted response.
	 */
	public delete<ReturnType = Confirmation, Body = unknown, Options = ResourceMutationOptions>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		return this.sendMutation<ReturnType, Body, Options>("DELETE", request);
	}

	/**
	 * Send update request using HTTP PUT.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 * @param request - Request configuration (path, body, headers, options).
	 * @returns Extracted response.
	 */
	public put<ReturnType = Confirmation, Body = unknown, Options = ResourceMutationOptions>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		return this.sendMutation<ReturnType, Body, Options>("PUT", request);
	}

	/**
	 * Send patch request using HTTP PATCH.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 * @param request - Request configuration (path, body, headers, options).
	 * @returns Extracted response.
	 */
	public patch<ReturnType = Confirmation, Body = unknown, Options = ResourceMutationOptions>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		return this.sendMutation<ReturnType, Body, Options>("PATCH", request);
	}

	/**
	 * Sends a mutation request with the specified HTTP verb and standard JSON headers.
	 */
	private sendMutation<ReturnType, Body, Options>(
		method: "POST" | "PUT" | "PATCH" | "DELETE",
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType> {
		const customOpts = (request.options || {}) as ResourceMutationOptions;
		const data: Record<string, unknown> = {
			token: this.instance.token,
			collection: this.resourceName,
			command: request.path,
			...(customOpts.additionalData || {}),
		};

		if (request.body !== undefined) {
			const serialized = JSON.parse(JSON.stringify(request.body));
			if (customOpts.multiple) data.values = serialized;
			else data.value = serialized;
		}

		return requestJson<ReturnType>(this.writeAddress, {
			method,
			headers: {
				"Content-Type": "application/json",
				...(request.headers || {}),
			},
			body: JSON.stringify(data),
		});
	}
}
