import { expect } from "chai";

import { ensureServerRunning } from "../matrix/test-target.js";
import { probe, raw, read, sendJson, write } from "./helpers.js";

/** Expectation table entry: [description, request body, status, error message fragment] */
type Case = [string, Record<string, unknown>, number, string];

const expectErrors = (call: typeof read, base: Record<string, unknown>, cases: Case[]) => {
	for (const [name, body, status, message] of cases) {
		it(name, async () => {
			const res = await call({ ...base, ...body });
			expect(res.status).to.equal(status);
			expect(res.json?.error).to.include(message);
		});
	}
};

describe("Server (raw HTTP): read endpoint read/", () => {
	before(async function () {
		this.timeout(10000);
		await ensureServerRunning();
		await write({ collection: "scratch", command: "writeRaw", value: {} });
		await write({
			collection: "scratch",
			command: "setBulk",
			keys: ["a", "b", "c"],
			values: [
				{ name: "alpha", n: 1, tags: ["x", "y"], flag: true, nested: { deep: "v" } },
				{ name: "beta", n: 2, tags: ["y"], flag: false, nested: { deep: "w" } },
				{ name: "gamma", n: 3, tags: [], flag: true },
			],
		});
	});

	describe("request validation", () => {
		it("answers CORS preflight requests", async () => {
			const res = await raw("read/", {
				method: "OPTIONS",
				headers: {
					Origin: "http://example.com",
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			});
			expect(res.status).to.equal(200);
			expect(res.headers.get("access-control-allow-origin")).to.equal("http://example.com");
			expect(res.headers.get("access-control-allow-methods")).to.include("PATCH");
			expect(res.headers.get("access-control-allow-headers")).to.equal("content-type");
		});

		it("answers a bare OPTIONS request", async () => {
			const res = await raw("read/", { method: "OPTIONS" });
			expect(res.status).to.equal(200);
			expect(res.headers.get("access-control-allow-origin")).to.equal(null);
		});

		it("rejects methods other than GET and POST", async () => {
			const res = await raw("read/", { method: "PUT", body: "{}" });
			expect(res.status).to.equal(400);
			expect(res.json.error).to.include("Incorrect request type");
		});

		it("rejects an empty body", async () => {
			const res = await raw("read/", { method: "POST" });
			expect(res.status).to.equal(400);
			expect(res.json.error).to.include("No JSON body");
		});

		it("rejects an invalid JSON body", async () => {
			const res = await raw("read/", { method: "POST", body: "{not json" });
			expect(res.status).to.equal(400);
		});

		it("rejects a JSON scalar body", async () => {
			const res = await raw("read/", { method: "POST", body: "5" });
			expect(res.status).to.equal(400);
			expect(res.json.error).to.include("No JSON body");
		});

		expectErrors(read, {}, [
			["rejects a missing collection", {}, 400, "No collection provided"],
			["rejects a non string collection", { collection: 5 }, 400, "No collection provided"],
			[
				"rejects an unknown collection",
				{ collection: "nope", command: "sha1" },
				404,
				"Collection not found",
			],
			["rejects a missing command", { collection: "scratch" }, 400, "No command provided"],
			[
				"rejects a non string command",
				{ collection: "scratch", command: 4 },
				400,
				"No command provided",
			],
			[
				"rejects an unknown command",
				{ collection: "scratch", command: "explode" },
				404,
				"Available commands",
			],
		]);
	});

	describe("commands", () => {
		const base = { collection: "scratch" };

		it("hashes and dumps the collection", async () => {
			const sha = await read({ ...base, command: "sha1" });
			expect(sha.status).to.equal(200);
			expect(sha.text).to.match(/^[0-9a-f]{40}$/);

			const dump = await read({ ...base, command: "readRaw" });
			expect(dump.json).to.have.keys("a", "b", "c");
		});

		it("gets one element", async () => {
			const res = await read({ ...base, command: "get", id: "b" });
			expect(res.json.name).to.equal("beta");
		});

		expectErrors(read, base, [
			["get requires an id", { command: "get" }, 400, "No id provided"],
			["get 404s on a missing id", { command: "get", id: "zzz" }, 404, "get failed"],
			["get rejects an array id", { command: "get", id: [] }, 400, "Invalid parameter type"],
		]);

		it("searches with every comparison family", async () => {
			const search = async (field: string, criteria: string, value: unknown, ignoreCase = false) =>
				Object.keys(
					(
						await read({
							...base,
							command: "search",
							search: [{ field, criteria, value, ignoreCase }],
						})
					).json,
				).sort();

			// booleans
			expect(await search("flag", "==", true)).to.deep.equal(["a", "c"]);
			expect(await search("flag", "!=", true)).to.deep.equal(["b"]);
			expect(await search("flag", ">", true)).to.deep.equal([]);
			// numbers
			expect(await search("n", "==", 2)).to.deep.equal(["b"]);
			expect(await search("n", "!=", 2)).to.deep.equal(["a", "c"]);
			expect(await search("n", ">=", 2)).to.deep.equal(["b", "c"]);
			expect(await search("n", "<=", 2)).to.deep.equal(["a", "b"]);
			expect(await search("n", "<", 2)).to.deep.equal(["a"]);
			expect(await search("n", ">", 2)).to.deep.equal(["c"]);
			expect(await search("n", "in", [1, 3])).to.deep.equal(["a", "c"]);
			expect(await search("n", "in", 1)).to.deep.equal([]);
			expect(await search("n", "nonsense", 1)).to.deep.equal([]);
			// strings
			expect(await search("name", "==", "ALPHA", true)).to.deep.equal(["a"]);
			expect(await search("name", "!=", "alpha")).to.deep.equal(["b", "c"]);
			expect(await search("name", ">=", "beta")).to.deep.equal(["b", "c"]);
			expect(await search("name", "<=", "beta")).to.deep.equal(["a", "b"]);
			expect(await search("name", "<", "beta")).to.deep.equal(["a"]);
			expect(await search("name", ">", "beta")).to.deep.equal(["c"]);
			expect(await search("name", "includes", "ET")).to.deep.equal([]);
			expect(await search("name", "contains", "ET", true)).to.deep.equal(["b"]);
			expect(await search("name", "contains", "")).to.deep.equal(["a", "b", "c"]);
			expect(await search("name", "startsWith", "ga")).to.deep.equal(["c"]);
			expect(await search("name", "startsWith", "")).to.deep.equal(["a", "b", "c"]);
			expect(await search("name", "endsWith", "ta")).to.deep.equal(["b"]);
			expect(await search("name", "endsWith", "")).to.deep.equal(["a", "b", "c"]);
			expect(await search("name", "in", ["alpha", "gamma"])).to.deep.equal(["a", "c"]);
			expect(await search("name", "in", "alpha")).to.deep.equal([]);
			expect(await search("name", "nonsense", "alpha")).to.deep.equal([]);
			// arrays
			expect(await search("tags", "array-contains", "x")).to.deep.equal(["a"]);
			expect(await search("tags", "array-contains", "X", true)).to.deep.equal(["a"]);
			expect(await search("tags", "array-contains-none", ["x"])).to.deep.equal(["b", "c"]);
			expect(await search("tags", "array-contains-any", ["x", "q"])).to.deep.equal(["a"]);
			expect(await search("tags", "array-contains-all", ["x", "y"])).to.deep.equal(["a"]);
			expect(await search("tags", "array-length", 1)).to.deep.equal(["b"]);
			expect(await search("tags", "array-length-eq", 2)).to.deep.equal(["a"]);
			expect(await search("tags", "array-length-df", 2)).to.deep.equal(["b", "c"]);
			expect(await search("tags", "array-length-gt", 1)).to.deep.equal(["a"]);
			expect(await search("tags", "array-length-lt", 1)).to.deep.equal(["c"]);
			expect(await search("tags", "array-length-ge", 1)).to.deep.equal(["a", "b"]);
			expect(await search("tags", "array-length-le", 1)).to.deep.equal(["b", "c"]);
			expect(await search("tags", "nonsense", 1)).to.deep.equal([]);
			// nested paths and unsupported field types
			expect(await search("nested.deep", "==", "v")).to.deep.equal(["a"]);
			expect(await search("nested.deep.deeper", "==", "v")).to.deep.equal([]);
			expect(await search("missing.deep", "==", "v")).to.deep.equal([]);
			expect(await search("missing", "==", "v")).to.deep.equal([]);
			expect(await search("nested", "==", "v")).to.deep.equal([]);
		});

		it("ignores conditions without criteria or value", async () => {
			const res = await read({ ...base, command: "search", search: [{ field: "name" }] });
			expect(res.json).to.deep.equal({});
		});

		it("rejects array comparisons against a non array operand", async () => {
			for (const criteria of ["array-contains-any", "array-contains-all", "array-contains-none"]) {
				const res = await read({
					...base,
					command: "search",
					search: [{ field: "tags", criteria, value: "x" }],
				});
				expect(res.status).to.equal(400);
				expect(res.json.error).to.include("not an array");
			}
		});

		it("applies limit and random options", async () => {
			const limited = await read({ ...base, command: "search", search: [], limit: 2 });
			expect(Object.keys(limited.json)).to.have.length(2);

			const seeded = await read({
				...base,
				command: "search",
				search: [],
				random: { seed: 42 },
				limit: 2,
			});
			const again = await read({
				...base,
				command: "search",
				search: [],
				random: { seed: 42 },
				limit: 2,
			});
			expect(Object.keys(seeded.json)).to.have.length(2);
			expect(seeded.json).to.deep.equal(again.json);

			const unseeded = await read({ ...base, command: "search", search: [], random: true });
			expect(Object.keys(unseeded.json)).to.have.length(3);
		});

		expectErrors(read, base, [
			["search requires an array", { command: "search" }, 400, "No search provided"],
			["search rejects a bad limit", { command: "search", search: [], limit: -1 }, 400, "limit"],
			[
				"search rejects a non integer limit",
				{ command: "search", search: [], limit: "2" },
				400,
				"limit",
			],
			[
				"search rejects a non integer seed",
				{ command: "search", search: [], random: { seed: "x" } },
				400,
				"Seed not an integer",
			],
		]);

		it("searches keys", async () => {
			const res = await read({ ...base, command: "searchKeys", search: ["a", "zzz", "c"] });
			expect(res.json).to.have.keys("a", "c");
		});

		expectErrors(read, base, [
			["searchKeys requires a search", { command: "searchKeys" }, 400, "No search provided"],
		]);

		it("searchKeys answers an empty object for a non array search", async () => {
			const res = await read({ ...base, command: "searchKeys", search: "a" });
			expect(res.json).to.deep.equal({});
		});

		it("selects fields, optionally filtered", async () => {
			const all = await read({ ...base, command: "select", select: { fields: ["name", "nope"] } });
			expect(all.json.a).to.deep.equal({ name: "alpha" });

			const filtered = await read({
				...base,
				command: "select",
				select: { fields: ["name"], search: [{ field: "n", criteria: ">", value: 1 }] },
			});
			expect(filtered.json).to.have.keys("b", "c");
		});

		expectErrors(read, base, [
			["select requires an object", { command: "select" }, 400, "No select provided"],
			["select requires fields", { command: "select", select: {} }, 400, "Missing required fields"],
			[
				"select rejects non array fields",
				{ command: "select", select: { fields: "x" } },
				400,
				"Incorrect fields type",
			],
			[
				"select rejects object fields",
				{ command: "select", select: { fields: { a: 1 } } },
				400,
				"Incorrect fields type",
			],
			[
				"select rejects non string fields",
				{ command: "select", select: { fields: [1] } },
				400,
				"string array",
			],
			[
				"select rejects a non array search",
				{ command: "select", select: { fields: ["name"], search: "x" } },
				400,
				"sequential array",
			],
			[
				"select rejects an object search",
				{ command: "select", select: { fields: ["name"], search: { a: 1 } } },
				400,
				"sequential array",
			],
		]);

		it("lists unique values, optionally flattened", async () => {
			const names = await read({ ...base, command: "values", values: { field: "flag" } });
			expect(Object.values(names.json)).to.have.members([true, false]);

			const plain = await read({ ...base, command: "values", values: { field: "tags" } });
			expect(Object.values(plain.json)).to.deep.include.members([["x", "y"], ["y"], []]);

			const flat = await read({
				...base,
				command: "values",
				values: { field: "tags", flatten: true },
			});
			expect(Object.values(flat.json)).to.have.members(["x", "y"]);

			const complex = await read({ ...base, command: "values", values: { field: "nested" } });
			expect(Object.keys(complex.json)).to.have.length(2);
		});

		expectErrors(read, base, [
			["values requires an object", { command: "values" }, 400, "No key provided"],
			["values requires a field", { command: "values", values: {} }, 400, "Missing required field"],
			[
				"values rejects a non string field",
				{ command: "values", values: { field: 1 } },
				400,
				"Incorrect field type",
			],
			[
				"values rejects a non boolean flatten",
				{ command: "values", values: { field: "n", flatten: "yes" } },
				400,
				"Incorrect flatten type",
			],
		]);

		it("picks random elements", async () => {
			const res = await read({
				...base,
				command: "random",
				random: { max: 2, seed: 1, offset: 1 },
			});
			expect(Object.keys(res.json)).to.have.length(2);

			const none = await read({
				...base,
				command: "random",
				random: { max: 1, seed: 1, offset: 10 },
			});
			expect(none.json).to.deep.equal({});

			const all = await read({ ...base, command: "random", random: {} });
			expect(Object.keys(all.json)).to.have.length(3);
		});

		expectErrors(read, base, [
			["random requires an object", { command: "random" }, 400, "No random object"],
			["random rejects a bad max", { command: "random", random: { max: -5 } }, 400, "max"],
			["random rejects a non integer max", { command: "random", random: { max: "2" } }, 400, "max"],
			[
				"random rejects an offset without seed",
				{ command: "random", random: { offset: 1 } },
				400,
				"offset without a seed",
			],
			[
				"random rejects a bad offset",
				{ command: "random", random: { seed: 1, offset: -1 } },
				400,
				"offset",
			],
			["random rejects a bad seed", { command: "random", random: { seed: "a" } }, 400, "seed"],
		]);
	});

	describe("collection files", () => {
		it("creates a missing collection file on first read", async () => {
			await probe({ mode: "collection-file", name: "fresh", action: "delete" });
			const res = await read({ collection: "fresh", command: "readRaw" });
			expect(res.status).to.equal(200);
			expect(res.text).to.equal("[]");
		});

		it("reports a corrupted collection file", async () => {
			await probe({ mode: "collection-file", name: "corrupt", action: "corrupt" });
			const res = await read({ collection: "corrupt", command: "get", id: "a" });
			expect(res.status).to.equal(500);
			expect(res.json.error).to.include("Failed to decode database file");
		});

		it("reports a collection file that is not an object", async () => {
			await probe({ mode: "collection-file", name: "corrupt", action: "scalar" });
			const res = await read({ collection: "corrupt", command: "get", id: "a" });
			expect(res.status).to.equal(500);
			expect(res.json.error).to.include("content is not a JSON object or array");
		});

		it("reports a collection file that cannot be read", async () => {
			await probe({ mode: "collection-file", name: "corrupt", action: "directory" });
			const res = await read({ collection: "corrupt", command: "get", id: "a" });
			expect(res.status).to.be.oneOf([400, 500]);
			await probe({ mode: "collection-file", name: "corrupt", action: "delete" });
		});
	});
});

describe("Server (raw HTTP): write endpoint write/", () => {
	const base = { collection: "scratch" };

	before(async function () {
		this.timeout(10000);
		await ensureServerRunning();
	});

	beforeEach(async () => {
		await write({
			...base,
			command: "writeRaw",
			value: { a: { n: 1, s: "str", b: true, arr: [1, 2, 3], o: { k: 1 } } },
		});
	});

	describe("request validation", () => {
		it("rejects GET requests", async () => {
			const res = await raw("write/");
			expect(res.status).to.equal(400);
			expect(res.json.error).to.include("Incorrect request type");
		});

		it("rejects an empty body", async () => {
			const res = await raw("write/", { method: "POST" });
			expect(res.status).to.equal(400);
		});

		it("rejects invalid JSON", async () => {
			const res = await raw("write/", { method: "POST", body: "{nope" });
			expect(res.status).to.equal(400);
		});

		it("rejects a JSON scalar", async () => {
			const res = await raw("write/", { method: "POST", body: '"text"' });
			expect(res.status).to.equal(400);
		});

		it("rejects a missing token", async () => {
			const res = await sendJson("write/", { ...base, command: "writeRaw", value: {} });
			expect(res.status).to.equal(400);
			expect(res.json.error).to.include("No token provided");
		});

		it("rejects a non string token", async () => {
			const res = await sendJson("write/", { token: 5, ...base, command: "writeRaw", value: {} });
			expect(res.status).to.equal(400);
		});

		it("rejects an invalid token", async () => {
			const res = await sendJson("write/", {
				token: "wrong",
				...base,
				command: "writeRaw",
				value: {},
			});
			expect(res.status).to.equal(403);
			expect(res.json.error).to.include("Invalid token");
		});

		expectErrors(write, {}, [
			[
				"rejects a missing collection",
				{ command: "writeRaw", value: {} },
				400,
				"No collection provided",
			],
			[
				"rejects a non string collection",
				{ collection: 3, command: "writeRaw", value: {} },
				400,
				"No collection provided",
			],
			[
				"rejects an unknown collection",
				{ collection: "nope", command: "writeRaw", value: {} },
				404,
				"Collection not found",
			],
			["rejects a missing command", { ...base }, 400, "No command provided"],
			["rejects a non string command", { ...base, command: 3 }, 400, "No command provided"],
			["rejects an unknown command", { ...base, command: "explode" }, 404, "Available commands"],
			["requires a value", { ...base, command: "add" }, 400, "No value provided"],
			[
				"requires values for bulk commands",
				{ ...base, command: "addBulk", value: [] },
				400,
				"No values provided",
			],
		]);
	});

	describe("commands", () => {
		it("writes raw content", async () => {
			expect((await write({ ...base, command: "writeRaw", value: [{ a: 1 }] })).status).to.equal(
				200,
			);
			expect((await write({ ...base, command: "writeRaw", value: [] })).status).to.equal(200);
			const dump = await read({ ...base, command: "readRaw" });
			expect(dump.text).to.equal("{}");
		});

		expectErrors(write, base, [
			["writeRaw rejects scalars", { command: "writeRaw", value: 5 }, 400, "cannot be a integer"],
			[
				"writeRaw rejects scalar items",
				{ command: "writeRaw", value: [1, 2] },
				400,
				"item cannot be a",
			],
		]);

		it("adds elements with generated keys", async () => {
			const one = await write({ ...base, command: "add", value: { x: 1 } });
			expect(one.json.id).to.be.a("string");
			const empty = await write({ ...base, command: "add", value: [] });
			expect(empty.status).to.equal(200);

			const many = await write({ ...base, command: "addBulk", values: [{ x: 1 }, { y: 2 }] });
			expect(many.json.ids).to.have.length(2);
			expect((await write({ ...base, command: "addBulk", values: [] })).json.ids).to.deep.equal([]);
		});

		it("generates keys for each collection flavour", async () => {
			const secure = await write({ collection: "secure_keys", command: "add", value: { x: 1 } });
			expect(secure.json.id).to.match(/^[0-9a-f]{32}$/);
			const random = await write({ collection: "random_keys", command: "add", value: { x: 1 } });
			expect(random.json.id).to.be.a("string");
			await write({ collection: "secure_keys", command: "remove", value: secure.json.id });
			await write({ collection: "random_keys", command: "remove", value: random.json.id });
		});

		expectErrors(write, base, [
			["add rejects scalars", { command: "add", value: 4 }, 400, "must be an object"],
			["add rejects lists", { command: "add", value: [1] }, 400, "must be an object"],
			["addBulk rejects scalars", { command: "addBulk", values: 5 }, 400, "must be an array"],
			["addBulk rejects objects", { command: "addBulk", values: { a: 1 } }, 400, "not an object"],
			[
				"addBulk rejects scalar items",
				{ command: "addBulk", values: [1] },
				400,
				"must be an object",
			],
			[
				"addBulk rejects list items",
				{ command: "addBulk", values: [[1]] },
				400,
				"must be an object",
			],
		]);

		it("refuses to generate keys when autoKey is disabled", async () => {
			for (const [command, extra] of [
				["add", { value: { x: 1 } }],
				["addBulk", { values: [{ x: 1 }] }],
			] as const) {
				const res = await write({ collection: "house", command, ...extra });
				expect(res.status).to.equal(400);
				expect(res.json.error).to.include("Automatic key generation is disabled");
			}
		});

		it("sets, removes and bulk removes elements", async () => {
			expect((await write({ ...base, command: "set", key: "s", value: { z: 1 } })).status).to.equal(
				200,
			);
			expect((await write({ ...base, command: "set", key: 7, value: { z: 1 } })).status).to.equal(
				200,
			);
			const removed = await write({ ...base, command: "remove", value: "s" });
			expect(removed.status).to.equal(200);
			expect(removed.json).to.deep.equal({ removed: { z: 1 } });
			const missing = await write({ ...base, command: "remove", value: "missing" });
			expect(missing.json).to.deep.equal({ removed: null });
			const bulk = await write({ ...base, command: "removeBulk", values: ["7", 7, "missing"] });
			expect(bulk.status).to.equal(200);
			expect(bulk.json).to.deep.equal({ removed: { 7: { z: 1 } } });
			const empty = await write({ ...base, command: "removeBulk", values: [] });
			expect(empty.json).to.deep.equal({ removed: {} });
			expect((await read({ ...base, command: "readRaw" })).json).to.have.keys("a");
		});

		expectErrors(write, base, [
			["set requires a key", { command: "set", value: {} }, 400, "No key provided"],
			["set rejects a null key", { command: "set", key: null, value: {} }, 400, "null"],
			[
				"set rejects a null value",
				{ command: "set", key: "k", value: null },
				400,
				"Key or value is null",
			],
			[
				"set rejects an array key",
				{ command: "set", key: [1], value: {} },
				400,
				"Incorrect key type",
			],
			[
				"remove rejects an array key",
				{ command: "remove", value: [1] },
				400,
				"Invalid parameter type",
			],
			["removeBulk rejects null", { command: "removeBulk", values: null }, 400, "null-like"],
			[
				"removeBulk rejects objects",
				{ command: "removeBulk", values: { a: 1 } },
				400,
				"keys must be an array",
			],
			[
				"removeBulk rejects scalars",
				{ command: "removeBulk", values: 5 },
				400,
				"keys must be an array",
			],
			[
				"removeBulk rejects non keyable items",
				{ command: "removeBulk", values: [[1]] },
				400,
				"Incorrect key type",
			],
		]);

		it("sets several elements at once", async () => {
			const res = await write({
				...base,
				command: "setBulk",
				keys: ["p", 9],
				values: [{ p: 1 }, { q: 2 }],
			});
			expect(res.status).to.equal(200);
			expect((await read({ ...base, command: "get", id: "9" })).json).to.deep.equal({ q: 2 });
		});

		expectErrors(write, base, [
			["setBulk requires keys", { command: "setBulk", values: [{}] }, 400, "No keys provided"],
			[
				"setBulk rejects non array keys",
				{ command: "setBulk", keys: "k", values: [{}] },
				400,
				"Incorrect keys type",
			],
			[
				"setBulk rejects non array values",
				{ command: "setBulk", keys: ["k"], values: 5 },
				400,
				"not arrays",
			],
			[
				"setBulk rejects mismatched sizes",
				{ command: "setBulk", keys: ["k"], values: [{}, {}] },
				400,
				"sizes are not equal",
			],
			[
				"setBulk rejects object keys",
				{ command: "setBulk", keys: { a: "k" }, values: [{}] },
				400,
				"Undefined key at index",
			],
			[
				"setBulk rejects non keyable keys",
				{ command: "setBulk", keys: [[1]], values: [{}] },
				400,
				"Incorrect key type",
			],
			[
				"setBulk rejects null values",
				{ command: "setBulk", keys: ["k"], values: [null] },
				400,
				"Undefined value",
			],
		]);

		const edit = (obj: Record<string, unknown>) =>
			write({ ...base, command: "editField", value: obj });
		const field = async (name: string) =>
			(await read({ ...base, command: "get", id: "a" })).json[name];

		it("edits fields", async () => {
			expect((await edit({ id: "a", field: "n", operation: "increment" })).status).to.equal(200);
			expect(await field("n")).to.equal(2);
			await edit({ id: "a", field: "n", operation: "increment", value: 5 });
			expect(await field("n")).to.equal(7);
			await edit({ id: "a", field: "n", operation: "decrement" });
			await edit({ id: "a", field: "n", operation: "decrement", value: 2 });
			expect(await field("n")).to.equal(4);

			await edit({ id: "a", field: "s", operation: "append", value: "!" });
			expect(await field("s")).to.equal("str!");
			await edit({ id: "a", field: "b", operation: "invert" });
			expect(await field("b")).to.equal(false);

			await edit({ id: "a", field: "new.deep.key", operation: "set", value: 1 });
			expect((await field("new")).deep.key).to.equal(1);
			await edit({ id: "a", field: "o.k", operation: "remove" });
			expect(await field("o")).to.deep.equal([]);
			await edit({ id: "a", field: "ghost.deep", operation: "remove" });
			await edit({ id: "a", field: "o", operation: "remove" });

			await edit({ id: "a", field: "arr", operation: "array-push", value: 4 });
			await edit({ id: "a", field: "fresh.list", operation: "array-push", value: 1 });
			await edit({ id: "a", field: "created", operation: "array-push", value: 1 });
			expect(await field("arr")).to.deep.equal([1, 2, 3, 4]);
			expect(await field("created")).to.deep.equal([1]);
			await edit({ id: "a", field: "arr", operation: "array-delete", value: 0 });
			expect(await field("arr")).to.deep.equal([2, 3, 4]);
			await edit({ id: "a", field: "arr", operation: "array-splice", value: [0, 1] });
			await edit({ id: "a", field: "arr", operation: "array-splice", value: [0, 0, "ins"] });
			expect(await field("arr")).to.deep.equal(["ins", 3, 4]);
		});

		it("edits the root of a document without an id", async () => {
			await write({ collection: "settings", command: "writeRaw", value: { count: 1 } });
			await write({
				collection: "settings",
				command: "editField",
				value: { field: "count", operation: "increment" },
			});
			expect((await read({ collection: "settings", command: "readRaw" })).json).to.deep.equal({
				count: 2,
			});
			const missing = await write({
				collection: "settings",
				command: "editField",
				value: { field: "ghost", operation: "invert" },
			});
			expect(missing.json.error).to.include("doesn't exist in document");
			const nested = await write({
				collection: "settings",
				command: "editField",
				value: { field: "ghost.deep", operation: "invert" },
			});
			expect(nested.json.error).to.include("doesn't exist in document");
		});

		const editErrors: [string, Record<string, unknown>, string][] = [
			["a scalar edit object", 5 as never, "wrong type"],
			["a list edit object", [1] as never, "wrong type"],
			["an array id", { id: [1], field: "n", operation: "set", value: 1 }, "ID must be"],
			["an unknown id", { id: "zzz", field: "n", operation: "set", value: 1 }, "ID doesn't exist"],
			["a missing field", { id: "a", operation: "set", value: 1 }, "Missing field"],
			[
				"a non string field",
				{ id: "a", field: 4, operation: "set", value: 1 },
				"field must be a string",
			],
			["a missing operation", { id: "a", field: "n" }, "Missing operation"],
			["a missing value", { id: "a", field: "n", operation: "set" }, "A value is required"],
			[
				"a non object path",
				{ id: "a", field: "n.x", operation: "set", value: 1 },
				"is not an object",
			],
			[
				"a missing path",
				{ id: "a", field: "ghost.x", operation: "increment" },
				"doesn't exist in ID a",
			],
			[
				"a missing target",
				{ id: "a", field: "ghost", operation: "increment" },
				"doesn't exist in ID a",
			],
			[
				"appending to a number",
				{ id: "a", field: "n", operation: "append", value: "x" },
				"append requires",
			],
			[
				"appending a number",
				{ id: "a", field: "s", operation: "append", value: 1 },
				"append requires",
			],
			["inverting a number", { id: "a", field: "n", operation: "invert" }, "must be a boolean"],
			["incrementing a string", { id: "a", field: "s", operation: "increment" }, "must be numbers"],
			[
				"incrementing by a string",
				{ id: "a", field: "n", operation: "increment", value: "x" },
				"values must be numbers",
			],
			[
				"pushing to a string",
				{ id: "a", field: "s", operation: "array-push", value: 1 },
				"must be an array",
			],
			[
				"pushing to an object",
				{ id: "a", field: "o", operation: "array-push", value: 1 },
				"must be an array",
			],
			[
				"deleting from a string",
				{ id: "a", field: "s", operation: "array-delete", value: 0 },
				"must be an array",
			],
			[
				"deleting a non index",
				{ id: "a", field: "arr", operation: "array-delete", value: "0" },
				"must be a number",
			],
			[
				"splicing an object",
				{ id: "a", field: "o", operation: "array-splice", value: [0, 1] },
				"must be an array",
			],
			[
				"splicing a scalar value",
				{ id: "a", field: "arr", operation: "array-splice", value: 3 },
				"Incorrect array-splice",
			],
			[
				"splicing an object value",
				{ id: "a", field: "arr", operation: "array-splice", value: { a: 1 } },
				"Incorrect array-splice",
			],
			[
				"splicing too few options",
				{ id: "a", field: "arr", operation: "array-splice", value: [1] },
				"Incorrect array-splice",
			],
			[
				"splicing non integers",
				{ id: "a", field: "arr", operation: "array-splice", value: ["a", 1] },
				"Incorrect array-splice",
			],
			[
				"splicing non integer counts",
				{ id: "a", field: "arr", operation: "array-splice", value: [1, "a"] },
				"Incorrect array-splice",
			],
			["an unknown operation", { id: "a", field: "n", operation: "explode" }, "Unknown operation"],
		];
		for (const [name, obj, message] of editErrors) {
			it(`editField rejects ${name}`, async () => {
				const res = await edit(obj);
				expect(res.status).to.equal(400);
				expect(res.json.error).to.include(message);
			});
		}

		it("edits several fields at once", async () => {
			const res = await write({
				...base,
				command: "editFieldBulk",
				values: [
					{ id: "a", field: "n", operation: "increment" },
					{ id: "a", field: "s", operation: "append", value: "?" },
				],
			});
			expect(res.status).to.equal(200);
			expect(await field("n")).to.equal(2);
		});

		expectErrors(write, base, [
			[
				"editFieldBulk rejects objects",
				{ command: "editFieldBulk", values: { a: 1 } },
				400,
				"Incorrect data provided",
			],
			[
				"editFieldBulk rejects scalars",
				{ command: "editFieldBulk", values: 5 },
				400,
				"Incorrect data provided",
			],
			[
				"editFieldBulk surfaces edit errors",
				{ command: "editFieldBulk", values: [5] },
				400,
				"wrong type",
			],
		]);
	});

	describe("collection files", () => {
		it("creates a missing collection file on first write", async () => {
			await probe({ mode: "collection-file", name: "fresh", action: "delete" });
			const res = await write({ collection: "fresh", command: "add", value: { a: 1 } });
			expect(res.status).to.equal(200);
			expect(res.json.id).to.equal("0");
		});

		it("reports a corrupted collection file", async () => {
			await probe({ mode: "collection-file", name: "corrupt", action: "corrupt" });
			const res = await write({ collection: "corrupt", command: "add", value: { a: 1 } });
			expect(res.status).to.equal(500);
			await probe({ mode: "collection-file", name: "corrupt", action: "delete" });
		});
	});

	describe("server internals", () => {
		it("rejects the missing file in read_json_file without default", async () => {
			const res = await probe({ mode: "read-json-file" });
			expect(res.json.thrown.message).to.include("Could not open file");
		});

		it("rejects writes without a locked descriptor", async () => {
			const res = await probe({ mode: "write-json-file" });
			expect(res.json.thrown.class).to.equal("HTTPException");
			expect(res.json.thrown.message).to.include("Invalid file descriptor");
		});
	});
});
