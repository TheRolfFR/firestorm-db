import { expect } from "chai";
import {
	FirestormError,
	requestJson,
	documentPostRequest,
	documentGetRequest,
	colPostRequest,
	colGetRequest,
} from "../../dist/esm/utils.js";
import type { ResponseDetails, ResourceLike } from "../../dist/esm/utils.js";
import type { WriteConfirmation } from "../../dist/esm/types/utils.js";
import type { Equal, Expect, Extends } from "./type-helpers.js";

describe("Type Tests: src/client/utils.ts", () => {
	it("FirestormError class and ResponseDetails typing", () => {
		const err = new FirestormError("Request failed", {
			status: 404,
			statusText: "Not Found",
			data: { error: "File not found" },
			headers: new Headers(),
		});

		type _TErr = Expect<Extends<typeof err, Error>>;
		type _TName = Expect<Equal<typeof err.name, string>>;
		type _TResp = Expect<Equal<typeof err.response, ResponseDetails | undefined>>;

		expect(err.name).to.equal("FirestormError");
		expect(err.response?.status).to.equal(404);
	});

	it("requestJson<T>() generic typing", () => {
		type MyData = { count: number };
		type _TP1 = Expect<Equal<ReturnType<typeof requestJson<MyData>>, Promise<MyData>>>;
		type _TPDef = Expect<Equal<ReturnType<typeof requestJson>, Promise<unknown>>>;
	});

	it("ResourceLike interface", () => {
		const resLike: ResourceLike = {
			instance: { name: "test", address: "http://localhost/", token: "tok" },
			collectionName: "users",
		};
		type _TResLike = Expect<Extends<typeof resLike, ResourceLike>>;
	});

	it("document and collection HTTP request helpers typing", () => {
		type _TDocPost = Expect<
			Equal<ReturnType<typeof documentPostRequest<WriteConfirmation>>, Promise<WriteConfirmation>>
		>;

		type _TDocGet = Expect<
			Equal<ReturnType<typeof documentGetRequest<{ theme: string }>>, Promise<{ theme: string }>>
		>;

		type User = { name: string };
		type _TColPost = Expect<
			Equal<ReturnType<typeof colPostRequest<User, WriteConfirmation>>, Promise<WriteConfirmation>>
		>;

		type _TColGet = Expect<Equal<ReturnType<typeof colGetRequest<User[]>>, Promise<User[]>>>;
	});
});
