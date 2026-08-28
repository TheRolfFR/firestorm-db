import { expect } from "chai";

import type {
	ArrayCriteria,
	BooleanCriteria,
	ComparisonCriteria,
	NumberCriteria,
	SearchOption,
	SearchResultOptions,
	StringCriteria,
} from "../../../dist/esm/types/searchOption.js";
import type { Equal, Expect, Extends } from "../type-helpers.js";

type User = {
	name: string;
	age: number;
	isActive: boolean;
	roles: string[];
	address: {
		city: string;
		zip: number;
	};
};

describe("Type Tests: src/client/types/searchOption.ts", () => {
	it("Criteria types definitions", () => {
		type _TBool = Expect<Equal<BooleanCriteria, "==" | "!=">>;
		type _TCmp = Expect<Equal<ComparisonCriteria, BooleanCriteria | "<" | "<=" | ">" | ">=">>;
		type _TNum = Expect<Equal<NumberCriteria, ComparisonCriteria | "in">>;
		type _TStr = Expect<
			Equal<StringCriteria, NumberCriteria | "includes" | "contains" | "startsWith" | "endsWith">
		>;
		type _TArr = Expect<
			Equal<
				ArrayCriteria,
				| "array-contains"
				| "array-contains-none"
				| "array-contains-any"
				| "array-contains-all"
				| "array-length-eq"
				| "array-length-df"
				| "array-length-gt"
				| "array-length-lt"
				| "array-length-ge"
				| "array-length-le"
			>
		>;
	});

	it("valid string field search options", () => {
		const s1: SearchOption<User> = {
			field: "name",
			criteria: "==",
			value: "Alice",
			ignoreCase: true,
		};
		const s2: SearchOption<User> = {
			field: "name",
			criteria: "contains",
			value: "lic",
		};
		const s3: SearchOption<User> = {
			field: "name",
			criteria: "in",
			value: ["Alice", "Bob"],
		};
		expect(s1.field).to.equal("name");
		expect(s2.field).to.equal("name");
		expect(s3.field).to.equal("name");

		// @ts-expect-error - 'in' criteria requires array of strings for string field
		const _invalidIn: SearchOption<User> = { field: "name", criteria: "in", value: "not-array" };

		// @ts-expect-error - value must be string for string criteria
		const _invalidVal: SearchOption<User> = { field: "name", criteria: "==", value: 123 };
	});

	it("valid number field search options", () => {
		const n1: SearchOption<User> = { field: "age", criteria: ">=", value: 18 };
		const n2: SearchOption<User> = { field: "age", criteria: "in", value: [20, 30] };
		expect(n1.field).to.equal("age");
		expect(n2.field).to.equal("age");

		// @ts-expect-error - includes is not valid for number field
		const _invalidCrit: SearchOption<User> = { field: "age", criteria: "includes", value: 18 };

		// @ts-expect-error - value must be number
		const _invalidVal: SearchOption<User> = { field: "age", criteria: "==", value: "eighteen" };
	});

	it("valid boolean field search options", () => {
		const b1: SearchOption<User> = { field: "isActive", criteria: "==", value: true };
		const b2: SearchOption<User> = { field: "isActive", criteria: "!=", value: false };
		expect(b1.field).to.equal("isActive");
		expect(b2.field).to.equal("isActive");

		// @ts-expect-error - > is not valid for boolean field
		const _invalidCrit: SearchOption<User> = { field: "isActive", criteria: ">", value: true };
	});

	it("valid array field search options", () => {
		const a1: SearchOption<User> = {
			field: "roles",
			criteria: "array-contains",
			value: "admin",
		};
		const a2: SearchOption<User> = {
			field: "roles",
			criteria: "array-contains-all",
			value: ["admin", "editor"],
		};
		const a3: SearchOption<User> = {
			field: "roles",
			criteria: "array-length-gt",
			value: 0,
		};
		expect(a1.field).to.equal("roles");
		expect(a2.field).to.equal("roles");
		expect(a3.field).to.equal("roles");

		// @ts-expect-error - array-length criteria requires number value
		const _invalidLen: SearchOption<User> = {
			field: "roles",
			criteria: "array-length-eq",
			value: "one",
		};
	});

	it("valid nested path search options", () => {
		const p1: SearchOption<User> = {
			field: "address.city",
			criteria: "==",
			value: "Paris",
		};
		const p2: SearchOption<User> = {
			field: "address.zip",
			criteria: ">=",
			value: 75000,
		};
		expect(p1.field).to.equal("address.city");
		expect(p2.field).to.equal("address.zip");

		const _invalidPath: SearchOption<User> = {
			// @ts-expect-error - invalid nested path
			field: "address.country",
			criteria: "==",
			value: "France",
		};
	});

	it("SearchResultOptions typing", () => {
		const opt1: SearchResultOptions = { limit: 10 };
		const opt2: SearchResultOptions = { random: true, limit: 5 };
		const opt3: SearchResultOptions = { random: 42 };

		type _T = Expect<Extends<typeof opt1, SearchResultOptions>>;
		expect(opt1.limit).to.equal(10);
		expect(opt2.random).to.be.true;
		expect(opt3.random).to.equal(42);

		// @ts-expect-error - limit must be number
		const _invalidLimit: SearchResultOptions = { limit: "10" };
	});
});
