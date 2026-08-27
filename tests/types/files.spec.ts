import { expect } from "chai";
import FormDataPkg from "form-data";
import { Firestorm } from "../../dist/esm/instance.js";
import { FileManager } from "../../dist/esm/files.js";
import type { WriteConfirmation } from "../../dist/esm/types/utils.js";
import type { Equal, Expect, Extends } from "./type-helpers.js";

describe("Type Tests: src/client/files.ts", () => {
	const instance = new Firestorm({ address: "http://localhost:8000/", token: "tok" });
	const files = new FileManager(instance);

	it("get<T>() returns Promise<T>", () => {
		type _TStr = Expect<Equal<ReturnType<typeof files.get<string>>, Promise<string>>>;

		type _TBuf = Expect<Equal<ReturnType<typeof files.get<ArrayBuffer>>, Promise<ArrayBuffer>>>;

		type CustomJson = { id: number; data: string };
		type _TJson = Expect<Equal<ReturnType<typeof files.get<CustomJson>>, Promise<CustomJson>>>;

		function _getNegative() {
			// @ts-expect-error - path is required
			files.get();

			// @ts-expect-error - path must be string
			files.get(123);
		}
	});

	it("upload() accepts FormData and FormDataPkg and returns Promise<WriteConfirmation>", () => {
		type _TPkg = Expect<Equal<ReturnType<typeof files.upload>, Promise<WriteConfirmation>>>;

		function _uploadTests() {
			const pkgForm = new FormDataPkg();
			files.upload(pkgForm);

			if (typeof FormData !== "undefined") {
				const stdForm = new FormData();
				files.upload(stdForm);
			}

			// @ts-expect-error - upload requires FormData
			files.upload("not-form-data");
		}
	});

	it("delete() returns Promise<WriteConfirmation>", () => {
		type _TDel = Expect<Equal<ReturnType<typeof files.delete>, Promise<WriteConfirmation>>>;

		function _deleteNegative() {
			// @ts-expect-error - missing path
			files.delete();

			// @ts-expect-error - path must be string
			files.delete(123);
		}
	});

	it("copy() returns Promise<WriteConfirmation>", () => {
		type _TCopy = Expect<Equal<ReturnType<typeof files.copy>, Promise<WriteConfirmation>>>;

		function _copyNegative() {
			// @ts-expect-error - missing newPath
			files.copy("/old.txt");

			// @ts-expect-error - overwrite must be boolean
			files.copy("/old.txt", "/new.txt", "true");
		}
	});

	it("move() returns Promise<WriteConfirmation>", () => {
		type _TMove = Expect<Equal<ReturnType<typeof files.move>, Promise<WriteConfirmation>>>;

		function _moveNegative() {
			// @ts-expect-error - missing newPath
			files.move("/old.txt");

			// @ts-expect-error - overwrite must be boolean
			files.move("/old.txt", "/new.txt", 1);
		}
	});

	it("exists() returns Promise<boolean>", () => {
		type _TExists = Expect<Equal<ReturnType<typeof files.exists>, Promise<boolean>>>;

		function _existsNegative() {
			// @ts-expect-error - missing path
			files.exists();

			// @ts-expect-error - path must be string
			files.exists({});
		}
	});

	it("append() returns Promise<WriteConfirmation>", () => {
		type _TApp = Expect<Equal<ReturnType<typeof files.append>, Promise<WriteConfirmation>>>;

		function _appendNegative() {
			// @ts-expect-error - content must be string
			files.append("/log.txt", 123);

			// @ts-expect-error - create must be boolean
			files.append("/log.txt", "content", "yes");
		}
	});
});
