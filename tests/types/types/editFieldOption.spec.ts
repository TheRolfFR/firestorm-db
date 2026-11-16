import { expect } from "chai";

import type {
	DocumentEditFieldOption,
	EditFieldOption,
} from "../../../dist/esm/types/editFieldOption.js";
import type { Equal, Expect, Extends } from "../type-helpers.js";

type Model = {
	name: string;
	age: number;
	isActive: boolean;
	tags: string[];
	metadata: { role: string };
};

describe("Type Tests: src/client/types/editFieldOption.ts", () => {
	describe("EditFieldOption<T>", () => {
		it("valid operation: set", () => {
			const op1: EditFieldOption<Model> = {
				id: "1",
				field: "name",
				operation: "set",
				value: "Bob",
			};
			const op2: EditFieldOption<Model> = {
				id: "2",
				field: "age",
				operation: "set",
				value: 30,
			};
			expect(op1.operation).to.equal("set");
			expect(op2.operation).to.equal("set");
		});

		it("valid operation: increment and decrement on number fields", () => {
			const inc: EditFieldOption<Model> = {
				id: "1",
				field: "age",
				operation: "increment",
				value: 1,
			};
			const dec: EditFieldOption<Model> = {
				id: "1",
				field: "age",
				operation: "decrement",
			};
			expect(inc.operation).to.equal("increment");
			expect(dec.operation).to.equal("decrement");

			// @ts-expect-error - increment not allowed on string field 'name'
			const _invalidInc: EditFieldOption<Model> = {
				id: "1",
				field: "name",
				operation: "increment",
				value: 1,
			};
		});

		it("valid operation: invert on boolean fields", () => {
			const inv: EditFieldOption<Model> = {
				id: "1",
				field: "isActive",
				operation: "invert",
			};
			expect(inv.operation).to.equal("invert");

			// @ts-expect-error - invert not allowed on number field 'age'
			const _invalidInv: EditFieldOption<Model> = {
				id: "1",
				field: "age",
				operation: "invert",
			};
		});

		it("valid operation: append on string fields", () => {
			const app: EditFieldOption<Model> = {
				id: "1",
				field: "name",
				operation: "append",
				value: " Jr.",
			};
			expect(app.operation).to.equal("append");
		});

		it("valid operations: array-push, array-delete, array-splice on array fields", () => {
			const push: EditFieldOption<Model> = {
				id: "1",
				field: "tags",
				operation: "array-push",
				value: "admin",
			};
			const del: EditFieldOption<Model> = {
				id: "1",
				field: "tags",
				operation: "array-delete",
				value: 0,
			};
			const splice: EditFieldOption<Model> = {
				id: "1",
				field: "tags",
				operation: "array-splice",
				value: [0, 1, "moderator"],
			};
			expect(push.operation).to.equal("array-push");
			expect(del.operation).to.equal("array-delete");
			expect(splice.operation).to.equal("array-splice");

			// @ts-expect-error - array-push not allowed on string field 'name'
			const _invalidPush: EditFieldOption<Model> = {
				id: "1",
				field: "name",
				operation: "array-push",
				value: "test",
			};
		});

		it("valid operation: remove on any field", () => {
			const rem: EditFieldOption<Model> = {
				id: "1",
				field: "metadata",
				operation: "remove",
			};
			expect(rem.operation).to.equal("remove");
		});

		it("rejects unknown operations", () => {
			const _invalid: EditFieldOption<Model> = {
				id: "1",
				field: "name",
				// @ts-expect-error - unknown operation
				operation: "unknown_op",
			};
		});
	});

	describe("DocumentEditFieldOption<T>", () => {
		it("does not require an id property", () => {
			const op: DocumentEditFieldOption<Model> = {
				field: "age",
				operation: "increment",
				value: 5,
			};
			expect(op.operation).to.equal("increment");

			const inv: DocumentEditFieldOption<Model> = {
				field: "isActive",
				operation: "invert",
			};
			expect(inv.operation).to.equal("invert");

			// @ts-expect-error - increment not allowed on boolean field
			const _invalidDocOp: DocumentEditFieldOption<Model> = {
				field: "isActive",
				operation: "increment",
				value: 1,
			};
		});
	});
});
