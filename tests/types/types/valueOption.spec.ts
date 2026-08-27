import { expect } from "chai";
import type { ValueOption, ValueReturnType } from "../../../dist/esm/types/valueOption.js";
import type { Equal, Expect, Extends } from "../type-helpers.js";

type User = {
	name: string;
	age: number;
	tags: string[];
	matrix: number[][];
};

describe("Type Tests: src/client/types/valueOption.ts", () => {
	it("ValueOption<T, Key, Flatten> type checking", () => {
		const op1: ValueOption<User, "name"> = { field: "name" };
		const op2: ValueOption<User, "tags", true> = { field: "tags", flatten: true };
		const op3: ValueOption<User, "tags", false> = { field: "tags", flatten: false };

		expect(op1.field).to.equal("name");
		expect(op2.flatten).to.be.true;
		expect(op3.flatten).to.be.false;

		// @ts-expect-error - 'nonExistent' is not a property of User
		const _invalid: ValueOption<User, "nonExistent"> = { field: "nonExistent" };
	});

	it("ValueReturnType<T, Key, Flatten> with non-array field", () => {
		type RetName = ValueReturnType<User, "name">;
		type _TName = Expect<Equal<RetName, string[]>>;

		type RetAge = ValueReturnType<User, "age">;
		type _TAge = Expect<Equal<RetAge, number[]>>;
	});

	it("ValueReturnType<T, Key, Flatten> with array field", () => {
		// flatten: true extracts element type array
		type RetTagsFlatten = ValueReturnType<User, "tags", true>;
		type _TTagsFlat = Expect<Equal<RetTagsFlatten, string[]>>;

		// flatten: false (or default) leaves array of array
		type RetTagsNoFlat = ValueReturnType<User, "tags", false>;
		type _TTagsNoFlat = Expect<Equal<RetTagsNoFlat, string[][]>>;

		type RetTagsDef = ValueReturnType<User, "tags">;
		type _TTagsDef = Expect<Equal<RetTagsDef, string[][]>>;

		// matrix: number[][] flattened becomes number[][]
		type RetMatrixFlat = ValueReturnType<User, "matrix", true>;
		type _TMatrixFlat = Expect<Equal<RetMatrixFlat, number[][]>>;
	});
});
