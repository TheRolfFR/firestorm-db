import { expect } from "chai";

import { FirestormError, requestJson } from "../../dist/esm/utils.js";

import type { WriteConfirmation } from "../../dist/esm/types/utils.js";
import type { ResourceLike, ResponseDetails } from "../../dist/esm/utils.js";
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
		type _TResp = Expect<
			Equal<typeof err.response, ResponseDetails<{ error: string }> | undefined>
		>;

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
			name: "users",
		};
		type _TResLike = Expect<Extends<typeof resLike, ResourceLike>>;
	});
});
