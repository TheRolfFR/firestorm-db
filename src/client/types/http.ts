import type { Confirmation } from "./utils.ts";

/**
 * Base HTTP request structure adhering to standard HTTP properties.
 */
export interface HttpRequest<Options = unknown> {
	/** Request path or endpoint or firestorm command */
	path?: string;
	/** Request headers */
	headers?: Record<string, string>;
	/** Custom or additional options */
	options?: Options;
}

/**
 * HTTP GET request configuration.
 */
export interface HttpGetRequest<
	Params = unknown,
	Options = Record<string, unknown>,
> extends HttpRequest<Options> {
	/** Request query or parameters */
	params?: Params;
}

/**
 * HTTP Body-bearing request structure.
 */
export interface HttpBodyRequest<
	Body = unknown,
	Options = Record<string, unknown>,
> extends HttpRequest<Options> {
	/** Request payload body */
	body?: Body;
}

/**
 * Common interface representing standard HTTP operations.
 * @internal
 */
export interface HttpHandler {
	/**
	 * Perform a GET request.
	 * @template ReturnType - Expected response data type.
	 * @template Params - Request parameters type.
	 * @template Options - Custom options type.
	 */
	get<ReturnType = unknown, Params = unknown, Options = Record<string, unknown>>(
		request: HttpGetRequest<Params, Options>,
	): Promise<ReturnType>;

	/**
	 * Perform a POST request.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 */
	post<ReturnType = Confirmation, Body = unknown, Options = Record<string, unknown>>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType>;

	/**
	 * Perform a DELETE request.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 */
	delete<ReturnType = Confirmation, Body = unknown, Options = Record<string, unknown>>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType>;

	/**
	 * Perform a PUT request.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 */
	put?<ReturnType = Confirmation, Body = unknown, Options = Record<string, unknown>>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType>;

	/**
	 * Perform a PATCH request.
	 * @template ReturnType - Expected response data type.
	 * @template Body - Request body type.
	 * @template Options - Custom options type.
	 */
	patch?<ReturnType = Confirmation, Body = unknown, Options = Record<string, unknown>>(
		request: HttpBodyRequest<Body, Options>,
	): Promise<ReturnType>;
}
