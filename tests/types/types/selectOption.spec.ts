import { expect } from "chai";
import type { SelectOption } from "../../../dist/esm/types/selectOption.js";
import type { Equal, Expect, Extends } from "../type-helpers.js";

type User = {
	name: string;
	age: number;
	email: string;
};

describe("Type Tests: src/client/types/selectOption.ts", () => {
	it("SelectOption<T, K> with valid keys", () => {
		const sel1: SelectOption<User, "name" | "age"> = {
			fields: ["name", "age"],
		};
		expect(sel1.fields).to.deep.equal(["name", "age"]);

		const selWithSearch: SelectOption<User, "name"> = {
			fields: ["name"],
			search: [{ field: "age", criteria: ">=", value: 18 }],
		};
		expect(selWithSearch.fields).to.deep.equal(["name"]);
		expect(selWithSearch.search).to.be.an("array");

		// @ts-expect-error - 'invalidKey' is not a property of User
		const _invalidField: SelectOption<User, "name" | "invalidKey"> = {
			fields: ["name", "invalidKey"],
		};

		const _invalidSearch: SelectOption<User, "name"> = {
			fields: ["name"],
			// @ts-expect-error - search field 'nonExistent' is not a property of User
			search: [{ field: "nonExistent", criteria: "==", value: 1 }],
		};
	});
});
