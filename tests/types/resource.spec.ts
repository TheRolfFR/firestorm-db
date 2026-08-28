import { expect } from "chai";

import { Firestorm } from "../../dist/esm/instance.js";
import { ResourceManager } from "../../dist/esm/resource.js";

import type { Equal, Expect, Extends } from "./type-helpers.js";

describe("Type Tests: src/client/resource.ts", () => {
	it("ResourceManager properties and methods typing", () => {
		const instance = new Firestorm({ address: "http://localhost:8000/" });
		const resource = new ResourceManager(instance, "test_col");

		type _TInst = Expect<Equal<typeof resource.instance, Firestorm>>;
		type _TName = Expect<Equal<typeof resource.name, string>>;
		type _TReadAddr = Expect<Equal<typeof resource.readAddress, string>>;
		type _TWriteAddr = Expect<Equal<typeof resource.writeAddress, string>>;

		expect(resource.name).to.equal("test_col");
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
