import { expect } from "chai";

import { ensureServerRunning, TOKEN } from "../matrix/test-target.js";
import { form, formHeaders, probe, raw, sendJson } from "./helpers.js";

// 1x1 transparent PNG
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64",
);

const put = (body: Record<string, unknown>, method = "PUT") => sendJson("files.php", body, method);
const upload = (
	path: string | undefined,
	content: BodyPart,
	token: string | null = TOKEN,
	overwrite = true,
) => {
	const data = new FormData();
	if (path !== undefined) data.append("path", path);
	if (token !== null) data.append("token", token);
	if (overwrite) data.append("overwrite", "true");
	if (content !== null) data.append("file", content, "file.bin");
	return raw("files.php", { method: "POST", body: data });
};
type BodyPart = Blob | null;

describe("Server (raw HTTP): file endpoint files.php", () => {
	before(async function () {
		this.timeout(10000);
		await ensureServerRunning();
	});

	describe("request routing", () => {
		it("answers CORS preflight requests", async () => {
			const res = await raw("files.php", {
				method: "OPTIONS",
				headers: { Origin: "http://example.com" },
			});
			expect(res.status).to.equal(200);
		});

		it("serves the default route for unknown POST actions as an upload", async () => {
			const res = await raw("files.php", {
				method: "POST",
				body: form({ action: "bogus" }),
				headers: formHeaders,
			});
			expect(res.status).to.equal(400);
		});
	});

	describe("reading", () => {
		before(async () => {
			await put({ token: TOKEN, path: "read/note.txt", content: "hello", overwrite: true });
			await put({ token: TOKEN, path: "read/data.json.txt", content: "{}", overwrite: true });
			await upload("read/pixel.png", new Blob([PNG], { type: "image/png" }));
		});

		it("serves text files as downloads", async () => {
			const res = await raw("files.php?path=read/note.txt");
			expect(res.status).to.equal(200);
			expect(res.text).to.equal("hello");
			expect(res.headers.get("content-type")).to.include("text/plain");
			expect(res.headers.get("content-disposition")).to.include("note.txt");
		});

		it("serves images with their mime type", async () => {
			const res = await raw("files.php?path=read/pixel.png");
			expect(res.status).to.equal(200);
			expect(res.headers.get("content-type")).to.equal("image/png");
		});

		it("falls back to octet-stream for unknown extensions", async () => {
			await put({ token: TOKEN, path: "read/blob.txt", content: "x", overwrite: true });
			// storage only accepts allowed extensions, the mime table is covered by txt/other lookups
			const res = await raw("files.php?path=read/blob.txt");
			expect(res.status).to.equal(200);
		});

		it("reports existence", async () => {
			expect((await raw("files.php?action=exists&path=read/note.txt")).json).to.deep.equal({
				exists: true,
			});
			expect((await raw("files.php?action=exists&path=read/ghost.txt")).json).to.deep.equal({
				exists: false,
			});
		});

		for (const [name, query, status, message] of [
			["a missing path", "", 400, "No path provided"],
			["a blank path", "?path=%20%20", 400, "No path provided"],
			["a traversal", "?path=../../etc/passwd", 403, "Path not authorized"],
			["a php script", "?path=script.php", 403, "Cannot read PHP scripts"],
			["an unknown file", "?path=ghost.txt", 404, "File not found"],
		] as const) {
			it(`get rejects ${name}`, async () => {
				const res = await raw(`files.php${query}`);
				expect(res.status).to.equal(status);
				expect(res.json.error).to.include(message);
			});
		}

		for (const [name, query, status, message] of [
			["a missing path", "?action=exists", 400, "No path provided"],
			["a traversal", "?action=exists&path=../x.txt", 403, "Path not authorized"],
			["a php script", "?action=exists&path=a.php", 403, "Cannot access PHP scripts"],
		] as const) {
			it(`exists rejects ${name}`, async () => {
				const res = await raw(`files.php${query}`);
				expect(res.status).to.equal(status);
				expect(res.json.error).to.include(message);
			});
		}
	});

	describe("writing", () => {
		it("writes with JSON and form bodies", async () => {
			expect(
				(await put({ token: TOKEN, path: "w/json.txt", content: "a", overwrite: true })).status,
			).to.equal(200);
			const formRes = await raw("files.php", {
				method: "PUT",
				body: form({ token: TOKEN, path: "w/form.txt", content: "b", overwrite: "1" }),
				headers: formHeaders,
			});
			// PHP does not populate $_POST for PUT, so form bodies are reported as missing credentials
			expect(formRes.status).to.equal(400);
			const post = await raw("files.php", {
				method: "POST",
				body: form({
					action: "write",
					token: TOKEN,
					path: "w/form.txt",
					content: "b",
					overwrite: "1",
				}),
				headers: formHeaders,
			});
			expect(post.status).to.equal(200);
			const put2 = await put(
				{ action: "put", token: TOKEN, path: "w/put.txt", content: "c", overwrite: true },
				"POST",
			);
			expect(put2.status).to.equal(200);
		});

		it("refuses to overwrite without the flag", async () => {
			await put({ token: TOKEN, path: "w/twice.txt", content: "a", overwrite: true });
			const res = await put({ token: TOKEN, path: "w/twice.txt", content: "b" });
			expect(res.status).to.equal(403);
			expect(res.json.error).to.include("File already exists");
		});

		it("appends with PATCH and POST", async () => {
			await put({ token: TOKEN, path: "w/append.txt", content: "a", overwrite: true });
			expect(
				(await put({ token: TOKEN, path: "w/append.txt", content: "b" }, "PATCH")).status,
			).to.equal(200);
			expect(
				(await put({ action: "append", token: TOKEN, path: "w/append.txt", content: "c" }, "POST"))
					.status,
			).to.equal(200);
			const formed = await raw("files.php", {
				method: "POST",
				body: form({
					action: "append",
					token: TOKEN,
					path: "w/append-form.txt",
					content: "d",
					create: "1",
				}),
				headers: formHeaders,
			});
			expect(formed.status).to.equal(200);
			expect((await raw("files.php?path=w/append.txt")).text).to.equal("abc");
		});

		it("appending requires an existing file unless create is set", async () => {
			const missing = await put(
				{ token: TOKEN, path: "w/ghost-append.txt", content: "x" },
				"PATCH",
			);
			expect(missing.status).to.equal(404);
			const created = await put(
				{ token: TOKEN, path: "w/ghost-append.txt", content: "x", create: true },
				"PATCH",
			);
			expect(created.status).to.equal(200);
		});

		it("copies and moves with every overwrite combination", async () => {
			await put({ token: TOKEN, path: "m/src.txt", content: "src", overwrite: true });
			await put({ token: TOKEN, path: "m/dst.txt", content: "dst", overwrite: true });

			const copy = (body: Record<string, unknown>) =>
				put(
					{ action: "copy", token: TOKEN, oldPath: "m/src.txt", newPath: "m/dst.txt", ...body },
					"POST",
				);
			const move = (body: Record<string, unknown>) =>
				put(
					{ action: "move", token: TOKEN, oldPath: "m/src.txt", newPath: "m/dst.txt", ...body },
					"POST",
				);

			expect((await copy({})).status).to.equal(403);
			expect((await copy({ overwrite: true })).status).to.equal(200);
			expect((await copy({ overwrite: true, newPath: "m/sub/dir/copy.txt" })).status).to.equal(200);

			expect((await move({})).status).to.equal(403);
			expect((await move({ newPath: "m/src.txt" })).status).to.equal(200);
			expect((await move({ overwrite: true })).status).to.equal(200);
			expect((await raw("files.php?path=m/dst.txt")).text).to.equal("src");
			expect(
				(await move({ oldPath: "m/dst.txt", newPath: "m/sub/moved/dst.txt" })).status,
			).to.equal(200);

			const formed = await raw("files.php", {
				method: "POST",
				body: form({
					action: "copy",
					token: TOKEN,
					oldPath: "m/sub/moved/dst.txt",
					newPath: "m/formed.txt",
				}),
				headers: formHeaders,
			});
			expect(formed.status).to.equal(200);
		});

		it("deletes files", async () => {
			await put({ token: TOKEN, path: "d/gone.txt", content: "x", overwrite: true });
			const res = await put({ token: TOKEN, path: "d/gone.txt" }, "DELETE");
			expect(res.status).to.equal(200);
			expect((await raw("files.php?action=exists&path=d/gone.txt")).json.exists).to.equal(false);
		});

		it("uploads files with and without overwrite", async () => {
			const blob = new Blob(["upload"], { type: "text/plain" });
			expect((await upload("u/new.txt", blob, TOKEN, false)).status).to.equal(200);
			const duplicate = await upload("u/new.txt", blob, TOKEN, false);
			expect(duplicate.status).to.equal(403);
			expect(duplicate.json.error).to.include("File already exists");
			expect((await upload("u/new.txt", blob)).status).to.equal(200);
		});

		const rows: [string, string, Record<string, unknown>, number, string][] = [
			// [description, method, body, status, message]
			["write: no token", "PUT", { path: "x.txt", content: "x" }, 400, "No token provided"],
			[
				"write: invalid token",
				"PUT",
				{ token: "bad", path: "x.txt", content: "x" },
				403,
				"Invalid token",
			],
			["write: no path", "PUT", { token: TOKEN, content: "x" }, 400, "No path provided"],
			[
				"write: blank path",
				"PUT",
				{ token: TOKEN, path: " ", content: "x" },
				400,
				"No path provided",
			],
			["write: no content", "PUT", { token: TOKEN, path: "x.txt" }, 400, "No content provided"],
			[
				"write: traversal",
				"PUT",
				{ token: TOKEN, path: "../x.txt", content: "x" },
				403,
				"Path not authorized",
			],
			[
				"write: php",
				"PUT",
				{ token: TOKEN, path: "x.php", content: "x" },
				403,
				"Cannot write PHP scripts",
			],
			[
				"write: extension",
				"PUT",
				{ token: TOKEN, path: "x.exe", content: "x" },
				403,
				"Extension not allowed",
			],
			["append: no token", "PATCH", { path: "x.txt", content: "x" }, 400, "No token provided"],
			[
				"append: invalid token",
				"PATCH",
				{ token: "bad", path: "x.txt", content: "x" },
				403,
				"Invalid token",
			],
			["append: no path", "PATCH", { token: TOKEN, content: "x" }, 400, "No path provided"],
			["append: no content", "PATCH", { token: TOKEN, path: "x.txt" }, 400, "No content provided"],
			[
				"append: traversal",
				"PATCH",
				{ token: TOKEN, path: "../x.txt", content: "x" },
				403,
				"Path not authorized",
			],
			[
				"append: php",
				"PATCH",
				{ token: TOKEN, path: "x.php", content: "x" },
				403,
				"Cannot write PHP scripts",
			],
			[
				"append: extension",
				"PATCH",
				{ token: TOKEN, path: "x.exe", content: "x" },
				403,
				"Extension not allowed",
			],
			["delete: no token", "DELETE", { path: "x.txt" }, 400, "No token provided"],
			["delete: invalid token", "DELETE", { token: "bad", path: "x.txt" }, 403, "Invalid token"],
			["delete: no path", "DELETE", { token: TOKEN }, 400, "No path provided"],
			[
				"delete: traversal",
				"DELETE",
				{ token: TOKEN, path: "../x.txt" },
				403,
				"Path not authorized",
			],
			["delete: php", "DELETE", { token: TOKEN, path: "x.php" }, 403, "Cannot delete PHP scripts"],
			[
				"delete: extension",
				"DELETE",
				{ token: TOKEN, path: "x.exe" },
				403,
				"Extension not allowed",
			],
			["delete: unknown", "DELETE", { token: TOKEN, path: "ghost.txt" }, 404, "File not found"],
			[
				"copy: no token",
				"POST",
				{ action: "copy", oldPath: "a.txt", newPath: "b.txt" },
				400,
				"No token provided",
			],
			[
				"copy: invalid token",
				"POST",
				{ action: "copy", token: "bad", oldPath: "a.txt", newPath: "b.txt" },
				403,
				"Invalid token",
			],
			[
				"copy: no oldPath",
				"POST",
				{ action: "copy", token: TOKEN, newPath: "b.txt" },
				400,
				"No oldPath provided",
			],
			[
				"copy: no newPath",
				"POST",
				{ action: "copy", token: TOKEN, oldPath: "a.txt" },
				400,
				"No newPath provided",
			],
			[
				"copy: traversal",
				"POST",
				{ action: "copy", token: TOKEN, oldPath: "../a.txt", newPath: "b.txt" },
				403,
				"Path not authorized",
			],
			[
				"copy: php",
				"POST",
				{ action: "copy", token: TOKEN, oldPath: "a.txt", newPath: "b.php" },
				403,
				"Cannot write PHP scripts",
			],
			[
				"copy: extension",
				"POST",
				{ action: "copy", token: TOKEN, oldPath: "a.txt", newPath: "b.exe" },
				403,
				"Extension not allowed",
			],
			[
				"copy: unknown source",
				"POST",
				{ action: "copy", token: TOKEN, oldPath: "ghost.txt", newPath: "b.txt" },
				404,
				"Source file not found",
			],
			[
				"move: no token",
				"POST",
				{ action: "move", oldPath: "a.txt", newPath: "b.txt" },
				400,
				"No token provided",
			],
			[
				"move: invalid token",
				"POST",
				{ action: "move", token: "bad", oldPath: "a.txt", newPath: "b.txt" },
				403,
				"Invalid token",
			],
			[
				"move: no oldPath",
				"POST",
				{ action: "move", token: TOKEN, newPath: "b.txt" },
				400,
				"No oldPath provided",
			],
			[
				"move: no newPath",
				"POST",
				{ action: "move", token: TOKEN, oldPath: "a.txt" },
				400,
				"No newPath provided",
			],
			[
				"move: traversal",
				"POST",
				{ action: "move", token: TOKEN, oldPath: "../a.txt", newPath: "b.txt" },
				403,
				"Path not authorized",
			],
			[
				"move: php",
				"POST",
				{ action: "move", token: TOKEN, oldPath: "a.txt", newPath: "b.php" },
				403,
				"Cannot write PHP scripts",
			],
			[
				"move: extension",
				"POST",
				{ action: "move", token: TOKEN, oldPath: "a.txt", newPath: "b.exe" },
				403,
				"Extension not allowed",
			],
			[
				"move: unknown source",
				"POST",
				{ action: "move", token: TOKEN, oldPath: "ghost.txt", newPath: "b.txt" },
				404,
				"Source file not found",
			],
			[
				"write via POST: no token",
				"POST",
				{ action: "write", path: "x.txt", content: "x" },
				400,
				"No token provided",
			],
		];
		for (const [name, method, body, status, message] of rows) {
			it(`rejects ${name}`, async () => {
				const res = await put(body, method);
				expect(res.status).to.equal(status);
				expect(res.json.error).to.include(message);
			});
		}

		for (const [name, path, token, status, message] of [
			["a missing token", "u/x.txt", null, 400, "No token provided"],
			["an invalid token", "u/x.txt", "bad", 403, "Invalid token"],
			["a missing path", undefined, TOKEN, 400, "No path provided"],
			["a traversal", "../x.txt", TOKEN, 403, "Path not authorized"],
			["a php script", "u/x.php", TOKEN, 403, "Cannot write PHP scripts"],
			["a forbidden extension", "u/x.exe", TOKEN, 403, "Extension not allowed"],
		] as const) {
			it(`upload rejects ${name}`, async () => {
				const res = await upload(path, new Blob(["x"]), token);
				expect(res.status).to.equal(status);
				expect(res.json.error).to.include(message);
			});
		}

		it("upload rejects a request without file", async () => {
			const res = await upload("u/nofile.txt", null);
			expect(res.status).to.equal(400);
			expect(res.json.error).to.include("No file provided");
		});
	});

	describe("filesystem failures", () => {
		before(async () => {
			// "blocker.txt" becomes a directory, "plain.txt" stays a regular file
			await put({
				token: TOKEN,
				path: "fail/blocker.txt/inner.txt",
				content: "x",
				overwrite: true,
			});
			await put({ token: TOKEN, path: "fail/plain.txt", content: "x", overwrite: true });
		});

		const blockedDir = "fail/plain.txt/sub/file.txt";

		it("reports folders that cannot be created", async () => {
			const bodies: [string, Record<string, unknown>, string][] = [
				["PUT", { path: blockedDir, content: "x", overwrite: true }, "write"],
				["PATCH", { path: blockedDir, content: "x", create: true }, "append"],
				[
					"POST",
					{ action: "copy", oldPath: "fail/plain.txt", newPath: blockedDir, overwrite: true },
					"copy",
				],
				[
					"POST",
					{ action: "move", oldPath: "fail/plain.txt", newPath: blockedDir, overwrite: true },
					"move",
				],
			];
			for (const [method, body, name] of bodies) {
				const res = await put({ token: TOKEN, ...body }, method);
				expect(res.status, name).to.equal(500);
				expect(res.json.error, name).to.include("can't create folder");
			}
			const uploaded = await upload(blockedDir, new Blob(["x"]));
			expect(uploaded.status).to.equal(500);
			expect(uploaded.json.error).to.include("can't create folder");
		});

		it("reports targets that cannot be written", async () => {
			const blocker = "fail/blocker.txt";
			const results = [
				await put({ token: TOKEN, path: blocker, content: "x", overwrite: true }),
				await put({ token: TOKEN, path: blocker, content: "x" }, "PATCH"),
				await put(
					{
						action: "copy",
						token: TOKEN,
						oldPath: "fail/plain.txt",
						newPath: blocker,
						overwrite: true,
					},
					"POST",
				),
				await put(
					{
						action: "move",
						token: TOKEN,
						oldPath: "fail/plain.txt",
						newPath: blocker,
						overwrite: true,
					},
					"POST",
				),
				await put({ token: TOKEN, path: blocker }, "DELETE"),
				await upload(blocker, new Blob(["x"])),
			];
			for (const res of results) expect(res.status).to.equal(500);
		});
	});

	describe("server internals", () => {
		const functions = [
			"get_file",
			"exists_file",
			"delete_file",
			"upload_file",
			"copy_file",
			"move_file",
			"append_file",
			"write_file",
		];
		const requires: Record<string, string[]> = {
			storage: functions,
			tokens: functions.filter((fn) => !["get_file", "exists_file"].includes(fn)),
			extensions: functions.filter((fn) => !["get_file", "exists_file"].includes(fn)),
		};

		for (const [missing, fns] of Object.entries(requires)) {
			for (const fn of fns) {
				it(`${fn} reports a missing ${missing} configuration`, async () => {
					const res = await probe({ mode: "files-config", fn, missing });
					expect(res.status).to.equal(501);
					expect(res.json.error).to.include("Developer");
				});
			}
		}

		const uploadErrors: [number, number, string][] = [
			[1, 500, "File exceeds allowed size."],
			[2, 500, "File too large."],
			[3, 500, "File only partially uploaded."],
			[4, 500, "No file uploaded."],
			[6, 500, "Missing temp folder."],
			[7, 500, "Cannot write file to disk."],
			[8, 500, "File upload blocked by extension."],
			[99, 500, "Unknown error."],
		];
		for (const [error, status, message] of uploadErrors) {
			it(`upload reports PHP upload error ${error}`, async () => {
				const res = await probe({ mode: "upload", error: String(error) });
				expect(res.status).to.equal(status);
				expect(res.json.error).to.equal(message);
			});
		}

		it("upload rejects files that were not uploaded through HTTP", async () => {
			const res = await probe({ mode: "upload", error: "0", tmp: "/etc/hosts" });
			expect(res.status).to.equal(403);
			expect(res.json.error).to.include("Possible file upload attack");
		});
	});
});
