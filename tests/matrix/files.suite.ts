import { expect } from "chai";

import { ADDRESS, createTestEnv, TestTarget } from "./test-target.js";

interface ErrorWithResponse {
	response?: { status: number };
}

function createFormData(target: TestTarget): any {
	if (target.isBrowser || typeof (globalThis as any).window !== "undefined") {
		return new (globalThis as any).FormData();
	}
	try {
		const FormDataPkg = require("form-data");
		return new FormDataPkg();
	} catch {
		return new (globalThis as any).FormData();
	}
}

function createFilePayload(target: TestTarget, text: string, filename: string) {
	if (target.isBrowser || typeof (globalThis as any).window !== "undefined") {
		return new Blob([text], { type: "text/plain" });
	}
	return text;
}

export function runFilesSuite(target: TestTarget) {
	describe(`[${target.name}] Firestorm File Manager (FileManager)`, () => {
		const env = createTestEnv(target);

		it("throws error if instance address is not configured", async () => {
			const unconfigured = target.createFirestorm({});
			try {
				await unconfigured.files.get({ path: "test.txt" });
				expect.fail("Should have thrown error");
			} catch (err) {
				expect((err as Error).message).to.include("was not configured");
			}
		});

		it("throws error if token is not configured on mutating operations", async () => {
			const noToken = target.createFirestorm({ address: ADDRESS });
			const formData = createFormData(target);

			try {
				await noToken.files.post({ body: formData });
				expect.fail("Should have thrown error for upload");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.delete({ path: "file.txt" });
				expect.fail("Should have thrown error for delete");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.copy({ oldPath: "src.txt", newPath: "dest.txt" });
				expect.fail("Should have thrown error for copy");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.move({ oldPath: "src.txt", newPath: "dest.txt" });
				expect.fail("Should have thrown error for move");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.patch({ path: "file.txt", body: "content" });
				expect.fail("Should have thrown error for append");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.put({ path: "file.txt", body: "content" });
				expect.fail("Should have thrown error for put");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}
		});

		it("returns 404 for unknown file", async () => {
			try {
				await env.instance.files.get({ path: "/path/to/unknown_file.txt" });
				expect.fail("Should have thrown error");
			} catch (err) {
				expect((err as ErrorWithResponse).response?.status).to.equal(404);
			}
		});

		it("uploads, retrieves, and downloads a file", async () => {
			const formData = createFormData(target);
			const fileContent = "This is a test lyric file content for Firestorm DB";
			const payload = createFilePayload(target, fileContent, "lyrics.txt");

			formData.append("path", "/lyrics_matrix.txt");
			formData.append("overwrite", "true");
			formData.append("file", payload, "lyrics_matrix.txt");

			const res = await env.instance.files.post({ body: formData });
			expect(res).to.deep.equal({ response: "Written file successfully to /lyrics_matrix.txt" });

			const retrieved = await env.instance.files.get<string>({ path: "/lyrics_matrix.txt" });
			expect(retrieved).to.equal(fileContent);

			await env.instance.files.delete({ path: "/lyrics_matrix.txt" });
		});

		it("rejects uploading php files (code injection prevention)", async () => {
			const formData = createFormData(target);
			const payload = createFilePayload(target, "<?php echo 'hello'; ?>", "malicious.php");
			formData.append("path", "/malicious.php");
			formData.append("file", payload, "malicious.php");

			let threw = false;
			try {
				await env.instance.files.post({ body: formData });
			} catch {
				threw = true;
			}
			expect(threw).to.be.true;
		});

		it("rejects uploading duplicate file without overwrite=true", async () => {
			const formData1 = createFormData(target);
			const payload1 = createFilePayload(target, "initial content", "dup_test.txt");
			formData1.append("path", "/dup_test.txt");
			formData1.append("overwrite", "true");
			formData1.append("file", payload1, "dup_test.txt");
			await env.instance.files.post({ body: formData1 });

			const formData2 = createFormData(target);
			const payload2 = createFilePayload(target, "duplicate content", "dup_test.txt");
			formData2.append("path", "/dup_test.txt");
			formData2.append("file", payload2, "dup_test.txt");

			let threw = false;
			try {
				await env.instance.files.post({ body: formData2 });
			} catch (err) {
				threw = true;
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}
			expect(threw).to.be.true;

			await env.instance.files.delete({ path: "/dup_test.txt" });
		});

		it("checks if file exists", async () => {
			const nonExistent = await env.instance.files.exists({ path: "/nonexistent-file.txt" });
			expect(nonExistent).to.be.false;

			const formData = createFormData(target);
			const payload = createFilePayload(target, "content", "test-exists.txt");
			formData.append("path", "/test-exists.txt");
			formData.append("overwrite", "true");
			formData.append("file", payload, "test-exists.txt");
			await env.instance.files.post({ body: formData });

			const existent = await env.instance.files.exists({ path: "/test-exists.txt" });
			expect(existent).to.be.true;

			await env.instance.files.delete({ path: "/test-exists.txt" });
		});

		it("appends content to a file", async () => {
			let threw = false;
			try {
				await env.instance.files.patch({
					path: "/append-test.txt",
					body: "content",
					options: { create: false },
				});
			} catch (err) {
				threw = true;
				expect((err as ErrorWithResponse).response?.status).to.equal(404);
			}
			expect(threw).to.be.true;

			const appendRes1 = await env.instance.files.patch({
				path: "/append-test.txt",
				body: "Hello",
				options: { create: true },
			});
			expect(appendRes1.response).to.include("Successfully appended");

			await env.instance.files.patch({
				path: "/append-test.txt",
				body: " World",
				options: { create: false },
			});

			const content = await env.instance.files.get<string>({ path: "/append-test.txt" });
			expect(content).to.equal("Hello World");

			await env.instance.files.delete({ path: "/append-test.txt" });
		});

		it("copies file directly", async () => {
			await env.instance.files.patch({
				path: "/copy-src.txt",
				body: "copy test content",
				options: { create: true },
			});

			const copyRes = await env.instance.files.copy({
				oldPath: "/copy-src.txt",
				newPath: "/copy-dest.txt",
			});
			expect(copyRes.response).to.include("Successfully copied");

			const destContent = await env.instance.files.get<string>({ path: "/copy-dest.txt" });
			expect(destContent).to.equal("copy test content");

			let threw = false;
			try {
				await env.instance.files.copy({
					oldPath: "/copy-src.txt",
					newPath: "/copy-dest.txt",
					overwrite: false,
				});
			} catch (err) {
				threw = true;
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}
			expect(threw).to.be.true;

			await env.instance.files.delete({ path: "/copy-src.txt" });
			await env.instance.files.delete({ path: "/copy-dest.txt" });
		});

		it("moves file directly", async () => {
			await env.instance.files.patch({
				path: "/move-src.txt",
				body: "move test content",
				options: { create: true },
			});

			const moveRes = await env.instance.files.move({
				oldPath: "/move-src.txt",
				newPath: "/move-dest.txt",
			});
			expect(moveRes.response).to.include("Successfully moved");

			const srcExists = await env.instance.files.exists({ path: "/move-src.txt" });
			expect(srcExists).to.be.false;

			const destExists = await env.instance.files.exists({ path: "/move-dest.txt" });
			expect(destExists).to.be.true;

			const destContent = await env.instance.files.get<string>({ path: "/move-dest.txt" });
			expect(destContent).to.equal("move test content");

			await env.instance.files.delete({ path: "/move-dest.txt" });
		});

		it("writes and overwrites file content directly with put()", async () => {
			const putRes = await env.instance.files.put({
				path: "/put-test.txt",
				body: "initial put content",
				options: { overwrite: true },
			});
			expect(putRes.response).to.include("Written file successfully");

			const retrieved = await env.instance.files.get<string>({ path: "/put-test.txt" });
			expect(retrieved).to.equal("initial put content");

			let threw = false;
			try {
				await env.instance.files.put({
					path: "/put-test.txt",
					body: "new content without overwrite",
					options: { overwrite: false },
				});
			} catch (err) {
				threw = true;
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}
			expect(threw).to.be.true;

			await env.instance.files.put({
				path: "/put-test.txt",
				body: "overwritten put content",
				options: { overwrite: true },
			});

			const retrievedAfter = await env.instance.files.get<string>({ path: "/put-test.txt" });
			expect(retrievedAfter).to.equal("overwritten put content");

			await env.instance.files.delete({ path: "/put-test.txt" });
		});

		it("deletes file successfully", async () => {
			const formData = createFormData(target);
			const payload = createFilePayload(target, "delete me", "to-delete.txt");
			formData.append("path", "/to-delete.txt");
			formData.append("overwrite", "true");
			formData.append("file", payload, "to-delete.txt");

			await env.instance.files.post({ body: formData });
			const deleteRes = await env.instance.files.delete({ path: "/to-delete.txt" });
			expect(deleteRes).to.exist;

			const exists = await env.instance.files.exists({ path: "/to-delete.txt" });
			expect(exists).to.be.false;
		});

		it("rejects path traversal attempts", async () => {
			try {
				await env.instance.files.get({ path: "../../secret.txt" });
				expect.fail("Should have rejected path traversal");
			} catch (err) {
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}

			try {
				await env.instance.files.exists({ path: "../uploads_private/secret.txt" });
				expect.fail("Should have rejected path traversal");
			} catch (err) {
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}
		});
	});
}
