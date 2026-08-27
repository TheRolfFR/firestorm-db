import { expect } from "chai";
import { ID_FIELD } from "../../../dist/esm/types/utils.js";
import type {
	IdEncoding,
	WriteConfirmation,
	MaybeArray,
	CollectionItem,
	Path,
	PathValue,
} from "../../../dist/esm/types/utils.js";
import type { Equal, Expect, Extends } from "../type-helpers.js";

describe("Type Tests: src/client/types/utils.ts", () => {
	it("ID_FIELD and IdEncoding", () => {
		type _TID = Expect<Extends<typeof ID_FIELD, symbol>>;
		type _TEncoding = Expect<Equal<IdEncoding, string | number>>;

		const strId: IdEncoding = "123";
		const numId: IdEncoding = 123;
		expect(strId).to.equal("123");
		expect(numId).to.equal(123);
		expect(typeof ID_FIELD).to.equal("symbol");
		expect(ID_FIELD).to.equal(Symbol.for("firestorm.id"));

		// @ts-expect-error - boolean is not a valid IdEncoding
		const _invalidId: IdEncoding = true;
	});

	it("WriteConfirmation and MaybeArray<T>", () => {
		type _TWrite = Expect<Equal<WriteConfirmation, { message: string }>>;

		type StringOrArray = MaybeArray<string>;
		type _TMaybeSingle = Expect<Extends<string, StringOrArray>>;
		type _TMaybeArray = Expect<Extends<string[], StringOrArray>>;
		// @ts-expect-error - number does not extend MaybeArray<string>
		const _invalid: MaybeArray<string> = 123;
	});

	it("CollectionItem<Item>", () => {
		type BaseUser = { name: string; age: number };

		type UserWithId = CollectionItem<BaseUser>;
		type _TUserWithId = Expect<Equal<UserWithId, BaseUser & { [ID_FIELD]: string }>>;

		const userItem: CollectionItem<BaseUser> = {
			name: "Alice",
			age: 30,
			[ID_FIELD]: "user_123",
		};
		expect(userItem[ID_FIELD]).to.equal("user_123");
		expect(userItem.name).to.equal("Alice");
	});

	it("Path<T> and PathValue<T, P>", () => {
		type Nested = {
			name: string;
			age: number;
			address: {
				street: string;
				city: {
					name: string;
					zip: number;
				};
			};
			tags: string[];
		};

		type AllPaths = Path<Nested>;
		type _TPathName = Expect<Extends<"name", AllPaths>>;
		type _TPathAddr = Expect<Extends<"address", AllPaths>>;
		type _TPathStreet = Expect<Extends<"address.street", AllPaths>>;
		type _TPathCity = Expect<Extends<"address.city", AllPaths>>;
		type _TPathCityName = Expect<Extends<"address.city.name", AllPaths>>;
		type _TPathZip = Expect<Extends<"address.city.zip", AllPaths>>;

		type _TValStreet = Expect<Equal<PathValue<Nested, "address.street">, string>>;
		type _TValZip = Expect<Equal<PathValue<Nested, "address.city.zip">, number>>;
		type _TValName = Expect<Equal<PathValue<Nested, "name">, string>>;

		// @ts-expect-error - invalid path returns never
		type _TInvalidPath = Expect<Equal<PathValue<Nested, "nonexistent">, string>>;
	});
});
