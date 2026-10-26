import { ADDRESS, TOKEN } from "../matrix/test-target.js";

export interface RawResponse {
	status: number;
	headers: Headers;
	text: string;
	json: any;
}

/** Sends a raw HTTP request and parses the body as JSON when possible. */
export async function raw(
	endpoint: string,
	init: { method?: string; body?: BodyInit; headers?: Record<string, string> } = {},
): Promise<RawResponse> {
	const res = await fetch(ADDRESS + endpoint, init);
	const text = await res.text();
	let json: any;
	try {
		json = JSON.parse(text);
	} catch {
		json = undefined;
	}
	return { status: res.status, headers: res.headers, text, json };
}

export const sendJson = (endpoint: string, body: unknown, method = "POST") =>
	raw(endpoint, {
		method,
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});

/** POST to read/ (read commands) */
export const read = (body: Record<string, unknown>) => sendJson("read/", body);

/** POST to write/ (write commands), authenticated by default */
export const write = (body: Record<string, unknown>) =>
	sendJson("write/", { token: TOKEN, ...body });

/** Calls the test-only probe endpoint (tests/php/probe.php) */
export const probe = (params: Record<string, string>) =>
	raw(`probe.php?${new URLSearchParams(params).toString()}`);

export const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

export const formHeaders = { "Content-Type": "application/x-www-form-urlencoded" };

export { TOKEN };
