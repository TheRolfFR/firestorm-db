import { request } from "node:http";
import { expect } from "chai";

import { ADDRESS, ensureServerRunning, TOKEN } from "../matrix/test-target.js";
import { probe, raw, sendJson } from "./helpers.js";

/** fetch cannot send a body with GET requests, which the version endpoint accepts */
const getWithBody = (endpoint: string, body: unknown) =>
	new Promise<{ status: number; text: string }>((resolve, reject) => {
		const payload = JSON.stringify(body);
		const req = request(
			ADDRESS + endpoint,
			{ method: "GET", headers: { "Content-Length": Buffer.byteLength(payload) } },
			(res) => {
				let text = "";
				res.on("data", (chunk) => (text += chunk));
				res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
			},
		);
		req.on("error", reject);
		req.end(payload);
	});

describe("Server (raw HTTP): version endpoint version.php", () => {
	before(async function () {
		this.timeout(10000);
		await ensureServerRunning();
	});

	it("answers CORS preflight requests", async () => {
		const res = await raw("version.php", {
			method: "OPTIONS",
			headers: { Origin: "http://example.com", "Access-Control-Request-Method": "POST" },
		});
		expect(res.status).to.equal(200);
	});

	it("returns the version for GET and POST requests carrying a valid token", async () => {
		const post = await sendJson("version.php", { token: TOKEN });
		expect(post.status).to.equal(200);
		expect(post.text).to.match(/\d+\.\d+\.\d+/);

		const get = await getWithBody("version.php", { token: TOKEN });
		expect(get.status).to.equal(200);
		expect(get.text).to.equal(post.text);
	});

	it("rejects other methods", async () => {
		const res = await raw("version.php", { method: "PUT", body: "{}" });
		expect(res.status).to.equal(400);
		expect(res.json.error).to.include("Incorrect request type");
	});

	for (const [name, body, status, message] of [
		["an empty body", "", 400, "No JSON body"],
		["invalid JSON", "{nope", 400, "No JSON body"],
		["a JSON scalar", "5", 400, "No JSON body"],
		["a missing token", "{}", 400, "No token provided"],
		["a non string token", '{"token": 5}', 400, "No token provided"],
		["an invalid token", '{"token": "bad"}', 403, "Invalid token"],
	] as const) {
		it(`rejects ${name}`, async () => {
			const res = await raw("version.php", { method: "POST", body });
			expect(res.status).to.equal(status);
			expect(res.json.error).to.include(message);
		});
	}
});

describe("Server (raw HTTP): logging", () => {
	before(async function () {
		this.timeout(10000);
		await ensureServerRunning();
	});

	it("writes to the default path", async () => {
		expect((await probe({ mode: "log" })).json.result).to.equal(true);
	});

	it("writes to the configured $log_path", async () => {
		expect((await probe({ mode: "log", config: "configured.log" })).json.result).to.equal(true);
	});

	it("ignores a blank configured $log_path", async () => {
		expect((await probe({ mode: "log", config: "   " })).json.result).to.equal(true);
	});

	it("writes to the FIRESTORM_LOG_PATH environment variable", async () => {
		expect(
			(await probe({ mode: "log", env: "env.log", config: "ignored.log" })).json.result,
		).to.equal(true);
	});

	it("throws when the log cannot be opened", async () => {
		const res = await probe({ mode: "log", env: "/nonexistent-dir/x.log" });
		expect(res.json.thrown.message).to.include("Could not open log path");
	});
});
