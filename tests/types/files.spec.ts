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

		files.get({ path: "/test.txt" });
	});

	it("post() accepts object with FormData or FormDataPkg body and returns Promise<Confirmation>", () => {
		type _TPkg = Expect<Equal<ReturnType<typeof files.post<Confirmation>>, Promise<Confirmation>>>;

		function _postTests() {
			const pkgForm = new FormDataPkg();
			files.post({ body: pkgForm });

			if (typeof FormData !== "undefined") {
				const stdForm = new FormData();
				files.post({ body: stdForm });
			}

			// @ts-expect-error - post requires valid HttpBodyRequest
			files.post(123);
		}
	});

	it("delete() returns Promise<Confirmation>", () => {
		type _TDel = Expect<
			Equal<ReturnType<typeof files.delete<Confirmation>>, Promise<Confirmation>>
		>;

		files.delete({ path: "/old.txt" });
	});

	it("copy() returns Promise<Confirmation>", () => {
		type _TCopy = Expect<Equal<ReturnType<typeof files.copy<Confirmation>>, Promise<Confirmation>>>;

		files.copy({ oldPath: "/old.txt", newPath: "/new.txt", overwrite: true });
	});

	it("move() returns Promise<Confirmation>", () => {
		type _TMove = Expect<Equal<ReturnType<typeof files.move<Confirmation>>, Promise<Confirmation>>>;

		files.move({ oldPath: "/old.txt", newPath: "/new.txt", overwrite: true });
	});

	it("exists() returns Promise<boolean>", () => {
		type _TExists = Expect<Equal<ReturnType<typeof files.exists>, Promise<boolean>>>;

		files.exists({ path: "/old.txt" });
	});

	it("patch() returns Promise<Confirmation>", () => {
		type _TApp = Expect<Equal<ReturnType<typeof files.patch<Confirmation>>, Promise<Confirmation>>>;
		type _TCustom = Expect<
			Equal<ReturnType<typeof files.patch<{ success: boolean }>>, Promise<{ success: boolean }>>
		>;

		files.patch({ path: "/log.txt", body: "data", options: { create: true } });
	});

	it("put() returns Promise<Confirmation>", () => {
		type _TPut = Expect<Equal<ReturnType<typeof files.put<Confirmation>>, Promise<Confirmation>>>;
		type _TCustom = Expect<
			Equal<ReturnType<typeof files.put<{ written: boolean }>>, Promise<{ written: boolean }>>
		>;

		files.put({ path: "/log.txt", body: "data", options: { overwrite: true } });
	});
});
