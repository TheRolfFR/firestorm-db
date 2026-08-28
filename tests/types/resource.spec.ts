import { expect } from "chai";

import { Firestorm } from "../../dist/esm/instance.js";
import { ResourceManager } from "../../dist/esm/managers/resource.js";

import type { Equal, Expect, Extends } from "./type-helpers.js";

describe("Type Tests: src/client/resource.ts", () => {
	it("ResourceManager properties and methods typing", () => {
		const instance = new Firestorm({ address: "http://localhost:8000/" });
		const resource = new ResourceManager(instance, "test_col");

		type _TInst = Expect<Equal<typeof resource.instance, Firestorm>>;
		type _TName = Expect<Equal<typeof resource.name, string>>;

		type _TGet = Expect<
			Equal<ReturnType<typeof resource.get<string, { id: string }>>, Promise<string>>
		>;
		type _TPost = Expect<
			Equal<ReturnType<typeof resource.post<boolean, { data: string }>>, Promise<boolean>>
		>;
		type _TDelete = Expect<Equal<ReturnType<typeof resource.delete<boolean>>, Promise<boolean>>>;
		type _TPut = Expect<
			Equal<ReturnType<typeof resource.put<boolean, { data: string }>>, Promise<boolean>>
		>;
		type _TPatch = Expect<
			Equal<ReturnType<typeof resource.patch<boolean, { data: string }>>, Promise<boolean>>
		>;

		function _resourceOptionsTest() {
			resource.get({ path: "get", params: { id: "123" } });
			resource.post({ path: "add", body: { name: "test" } });
			resource.delete({ path: "remove", options: { additionalData: { key: "123" } } });
			resource.put({ path: "set", body: { name: "test" } });
			resource.patch({
				path: "editField",
				body: { field: "name", operation: "set", value: "test" },
			});
		}

		expect(resource.name).to.equal("test_col");
		expect(typeof resource.get).to.equal("function");
		expect(typeof resource.post).to.equal("function");
		expect(typeof resource.delete).to.equal("function");
		expect(typeof resource.put).to.equal("function");
		expect(typeof resource.patch).to.equal("function");
	});

	it("ResourceManager constructor requires instance and name", () => {
		const instance = new Firestorm();

		expect(() => {
			// @ts-expect-error - missing arguments
			new ResourceManager();
		}).to.throw();

		// @ts-expect-error - name must be string
		new ResourceManager(instance, 123);

		// @ts-expect-error - instance must be Firestorm
		new ResourceManager("not-firestorm", "name");
	});
});
