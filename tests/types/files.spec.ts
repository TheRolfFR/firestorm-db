import FormDataPkg from "form-data";

import { Firestorm } from "../../dist/esm/instance.js";
import { FileManager } from "../../dist/esm/managers/files.js";

import type { Confirmation } from "../../dist/esm/index.js";
import type { Equal, Expect } from "./type-helpers.js";

describe("Type Tests: src/client/files.ts", () => {
	const instance = new Firestorm({ address: "http://localhost:8000/", token: "tok" });
	const files = new FileManager(instance);

	it("get<T>() returns Promise<T>", () => {
		type _TStr = Expect<Equal<ReturnType<typeof files.get<string>>, Promise<string>>>;

		type _TBuf = Expect<Equal<ReturnType<typeof files.get<ArrayBuffer>>, Promise<ArrayBuffer>>>;

		type CustomJson = { id: number; data: string };
		type _TJson = Expect<Equal<ReturnType<typeof files.get<CustomJson>>, Promise<CustomJson>>>;

		files.get("/test.txt");
		files.get("/test.txt", { headers: { Accept: "text/plain" } });
	});

	it("upload() accepts FormData or FormDataPkg and returns Promise<Confirmation>", () => {
		type _TPkg = Expect<Equal<ReturnType<typeof files.upload>, Promise<Confirmation>>>;

		function _uploadTests() {
			const pkgForm = new FormDataPkg();
			files.upload(pkgForm);

			if (typeof FormData !== "undefined") {
				const stdForm = new FormData();
				files.upload(stdForm);
			}

			// @ts-expect-error - upload requires FormData
			files.upload(123);
		}
	});

	it("delete() returns Promise<Confirmation>", () => {
		type _TDel = Expect<Equal<ReturnType<typeof files.delete>, Promise<Confirmation>>>;

		files.delete("/old.txt");
	});

	it("copy() returns Promise<Confirmation>", () => {
		type _TCopy = Expect<Equal<ReturnType<typeof files.copy>, Promise<Confirmation>>>;

		files.copy({ oldPath: "/old.txt", newPath: "/new.txt", overwrite: true });
	});

	it("move() returns Promise<Confirmation>", () => {
		type _TMove = Expect<Equal<ReturnType<typeof files.move>, Promise<Confirmation>>>;

		files.move({ oldPath: "/old.txt", newPath: "/new.txt", overwrite: true });
	});

	it("exists() returns Promise<boolean>", () => {
		type _TExists = Expect<Equal<ReturnType<typeof files.exists>, Promise<boolean>>>;

		files.exists("/old.txt");
	});

	it("append() returns Promise<Confirmation>", () => {
		type _TApp = Expect<Equal<ReturnType<typeof files.append>, Promise<Confirmation>>>;

		files.append("/log.txt", "data", { create: true });
	});

	it("uploadText() returns Promise<Confirmation>", () => {
		type _TWrite = Expect<Equal<ReturnType<typeof files.uploadText>, Promise<Confirmation>>>;

		files.uploadText("/log.txt", "data", { overwrite: true });
	});
});
