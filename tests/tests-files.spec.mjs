// @ts-check

import FormData from "form-data";
import { readFileSync, writeFileSync } from "fs";
import { readFile } from "fs/promises";

import { expect } from "chai";
import { join } from "path";

import firestorm from "../src/index.js";

describe("File upload, download and delete", () => {
	it("cannot find an unknown file", (done) => {
		firestorm.files
			.get("/path/to/file.txt")
			.then((res) => {
				done(new Error("Should not succeed, got " + JSON.stringify(res)));
			})
			.catch((requestError) => {
				expect(requestError.response.status).to.equal(
					404,
					"status error incorrect " + String(requestError),
				);
				done();
			})
			.catch((testError) => {
				done(testError);
			});
	});

	it("finds an uploaded file and get it with same content", (done) => {
		const timeoutPromise = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

		const uploaded = readFileSync(join(process.cwd(), "tests", "lyrics.txt"));
		const formData = new FormData();

		formData.append("path", "/lyrics.txt");
		formData.append("overwrite", "true");
		formData.append("file", uploaded, "lyrics.txt");

		firestorm.files
			.upload(formData)
			.then((res) => {
				expect(res).not.to.be.undefined;
				expect(res).to.deep.equal(
					{ message: "Written file successfully to /lyrics.txt" },
					"Message returned should match",
				);
				return timeoutPromise(200);
			})
			.then(() => firestorm.files.get("/lyrics.txt"))
			.then((res) => {
				const downloaded = Buffer.from(res);
				writeFileSync(join(process.cwd(), "tests", "downloaded.txt"), downloaded);

				expect(downloaded).to.deep.equal(uploaded);
				done();
			})
			.catch((err) => {
				err = err.response
					? err.response.status + ": " + JSON.stringify(err.response.data || err.response)
					: err;
				done(err);
			});
	});

	it("cannot upload an already uploaded file with no overwrite", (done) => {
		const formData = new FormData();
		formData.append("path", "/");
		readFile(join(process.cwd(), "tests", "lyrics.txt"))
			.catch(() => done(new Error("Should not succeed at first")))
			.then((res) => {
				formData.append("file", res, "lyrics.txt");
				return firestorm.files.upload(formData);
			})
			.then((res) => done(res))
			.catch((uploadError) => {
				expect(uploadError).not.to.be.undefined;
				expect(uploadError.response).not.to.be.undefined;
				expect(uploadError.response.status).to.equal(403);
				done();
			})
			.catch((err) => {
				err = err.response
					? err.response.status + ": " + JSON.stringify(err.response.data || err.response)
					: err;
				done(err);
			});
	});

	it("can delete file successfully", (done) => {
		// create form data
		const formData = new FormData();
		formData.append("path", "/lyrics.txt");
		formData.append("overwrite", "true");

		// create file read promise
		const lyricsPromise = readFile(join(process.cwd(), "tests", "lyrics.txt"));

		// get done now
		lyricsPromise.catch(() => done("File read should not failed"));

		const uploadPromise = lyricsPromise.then((res) => {
			// add file to form data
			formData.append("file", res, "lyrics.txt");
			return firestorm.files.upload(formData);
		});

		uploadPromise.catch((requestError) => {
			done("Upload should not fail, getting " + JSON.stringify(requestError.response.data));
		});

		// finally i don't need a variable here I take care of then before catch
		uploadPromise
			.then(() => {
				// now delete it
				return firestorm.files.delete("lyrics.txt");
			})
			.then(() => {
				done();
			})
			.catch((err) => {
				err = err.response
					? err.response.status + ": " + JSON.stringify(err.response.data || err.response)
					: err;
				done(err);
			});
	});
});
