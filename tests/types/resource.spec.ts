import { expect } from "chai";
import { ResourceManager } from "../../dist/esm/resource.js";
import { Firestorm } from "../../dist/esm/instance.js";
import type { Equal, Expect, Extends } from "./type-helpers.js";

describe("Type Tests: src/client/resource.ts", () => {
	it("ResourceManager properties and methods typing", () => {
		const instance = new Firestorm({ address: "http://localhost:8000/" });
		const resource = new ResourceManager(instance, "test_col");

		type _TInst = Expect<Equal<typeof resource.instance, Firestorm>>;
		type _TName = Expect<Equal<typeof resource.collectionName, string>>;
		type _TSha1 = Expect<Equal<ReturnType<typeof resource.sha1>, Promise<string>>>;

		expect(resource.collectionName).to.equal("test_col");
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
