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
				await unconfigured.files.get("test.txt");
				expect.fail("Should have thrown error");
			} catch (err) {
				expect((err as Error).message).to.include("was not configured");
			}
		});

		it("throws error if token is not configured on mutating operations", async () => {
			const noToken = target.createFirestorm({ address: ADDRESS });
			const formData = createFormData(target);

			try {
				await noToken.files.upload(formData);
				expect.fail("Should have thrown error for upload");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.delete("file.txt");
				expect.fail("Should have thrown error for delete");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.copy("src.txt", "dest.txt");
				expect.fail("Should have thrown error for copy");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.move("src.txt", "dest.txt");
				expect.fail("Should have thrown error for move");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}

			try {
				await noToken.files.append("file.txt", "content");
				expect.fail("Should have thrown error for append");
			} catch (err) {
				expect((err as Error).message).to.include("Token for Firestorm instance");
			}
		});

		it("returns 404 for unknown file", async () => {
			try {
				await env.instance.files.get("/path/to/unknown_file.txt");
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

			const res = await env.instance.files.upload(formData);
			expect(res).to.deep.equal({ message: "Written file successfully to /lyrics_matrix.txt" });

			const retrieved = await env.instance.files.get<string>("/lyrics_matrix.txt");
			expect(retrieved).to.equal(fileContent);

			await env.instance.files.delete("/lyrics_matrix.txt");
		});

		it("rejects uploading php files (code injection prevention)", async () => {
			const formData = createFormData(target);
			const payload = createFilePayload(target, "<?php echo 'hello'; ?>", "malicious.php");
			formData.append("path", "/malicious.php");
			formData.append("file", payload, "malicious.php");

			let threw = false;
			try {
				await env.instance.files.upload(formData);
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
			await env.instance.files.upload(formData1);

			const formData2 = createFormData(target);
			const payload2 = createFilePayload(target, "duplicate content", "dup_test.txt");
			formData2.append("path", "/dup_test.txt");
			formData2.append("file", payload2, "dup_test.txt");

			let threw = false;
			try {
				await env.instance.files.upload(formData2);
			} catch (err) {
				threw = true;
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}
			expect(threw).to.be.true;

			await env.instance.files.delete("/dup_test.txt");
		});

		it("checks if file exists", async () => {
			const nonExistent = await env.instance.files.exists("/nonexistent-file.txt");
			expect(nonExistent).to.be.false;

			const formData = createFormData(target);
			const payload = createFilePayload(target, "content", "test-exists.txt");
			formData.append("path", "/test-exists.txt");
			formData.append("overwrite", "true");
			formData.append("file", payload, "test-exists.txt");
			await env.instance.files.upload(formData);

			const existent = await env.instance.files.exists("/test-exists.txt");
			expect(existent).to.be.true;

			await env.instance.files.delete("/test-exists.txt");
		});

		it("appends content to a file", async () => {
			let threw = false;
			try {
				await env.instance.files.append("/append-test.txt", "content", false);
			} catch (err) {
				threw = true;
				expect((err as ErrorWithResponse).response?.status).to.equal(404);
			}
			expect(threw).to.be.true;

			const appendRes1 = await env.instance.files.append("/append-test.txt", "Hello", true);
			expect(appendRes1.message).to.include("Successfully appended");

			await env.instance.files.append("/append-test.txt", " World", false);

			const content = await env.instance.files.get<string>("/append-test.txt");
			expect(content).to.equal("Hello World");

			await env.instance.files.delete("/append-test.txt");
		});

		it("copies file directly", async () => {
			await env.instance.files.append("/copy-src.txt", "copy test content", true);

			const copyRes = await env.instance.files.copy("/copy-src.txt", "/copy-dest.txt");
			expect(copyRes.message).to.include("Successfully copied");

			const destContent = await env.instance.files.get<string>("/copy-dest.txt");
			expect(destContent).to.equal("copy test content");

			let threw = false;
			try {
				await env.instance.files.copy("/copy-src.txt", "/copy-dest.txt", false);
			} catch (err) {
				threw = true;
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}
			expect(threw).to.be.true;

			await env.instance.files.delete("/copy-src.txt");
			await env.instance.files.delete("/copy-dest.txt");
		});

		it("moves file directly", async () => {
			await env.instance.files.append("/move-src.txt", "move test content", true);

			const moveRes = await env.instance.files.move("/move-src.txt", "/move-dest.txt");
			expect(moveRes.message).to.include("Successfully moved");

			const srcExists = await env.instance.files.exists("/move-src.txt");
			expect(srcExists).to.be.false;

			const destExists = await env.instance.files.exists("/move-dest.txt");
			expect(destExists).to.be.true;

			const destContent = await env.instance.files.get<string>("/move-dest.txt");
			expect(destContent).to.equal("move test content");

			await env.instance.files.delete("/move-dest.txt");
		});

		it("deletes file successfully", async () => {
			const formData = createFormData(target);
			const payload = createFilePayload(target, "delete me", "to-delete.txt");
			formData.append("path", "/to-delete.txt");
			formData.append("overwrite", "true");
			formData.append("file", payload, "to-delete.txt");

			await env.instance.files.upload(formData);
			const deleteRes = await env.instance.files.delete("/to-delete.txt");
			expect(deleteRes).to.exist;

			const exists = await env.instance.files.exists("/to-delete.txt");
			expect(exists).to.be.false;
		});

		it("rejects path traversal attempts", async () => {
			try {
				await env.instance.files.get("../../secret.txt");
				expect.fail("Should have rejected path traversal");
			} catch (err) {
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}

			try {
				await env.instance.files.exists("../uploads_private/secret.txt");
				expect.fail("Should have rejected path traversal");
			} catch (err) {
				expect((err as ErrorWithResponse).response?.status).to.equal(403);
			}
		});
	});
}
