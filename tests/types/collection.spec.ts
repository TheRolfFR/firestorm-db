import { expect } from "chai";
import { createFirestorm, Collection, ID_FIELD } from "../../dist/esm/index.js";
import type {
	CollectionItem,
	WriteConfirmation,
	EditFieldOption,
	SearchOption,
	SearchResultOptions,
	SelectOption,
	ValueOption,
	ValueReturnType,
} from "../../dist/esm/index.js";
import type { Equal, Expect, Extends } from "./type-helpers.js";

type User = {
	name: string;
	age: number;
	sex: "female" | "male" | "other";
	emails: string[];
	isActive: boolean;
};

interface UserMethods {
	getNameAsLowerCase: () => string;
}

interface UserExtraMethods {
	getNameAsUpperCase: () => string;
}

describe("Type Tests: src/client/collection.ts", () => {
	const instance = createFirestorm();
	const users = instance.collection<User>({ name: "users" });

	it("Collection instance properties and constructor types", () => {
		type _TUsers = Expect<Equal<typeof users, Collection<User, CollectionItem<User>>>>;

		expect(users.collectionName).to.equal("users");

		// Test non-collision when document has its own 'id' field
		type ItemWithDbId = { id: number; val: string };
		const customCollection = instance.collection<ItemWithDbId>({
			name: "custom",
		});
		type _TDbItem = Expect<
			Equal<Awaited<ReturnType<typeof customCollection.get>>, ItemWithDbId & { [ID_FIELD]: string }>
		>;
		expect(customCollection.collectionName).to.equal("custom");
	});

	it("transform() and chaining fluent API typing", () => {
		const usersWithMethods = instance.collection<User, CollectionItem<User> & UserMethods>({
			name: "users",
			transform: (el) => ({
				...el,
				getNameAsLowerCase: (): string => el.name.toLowerCase(),
			}),
		});
		type _TMethodsCollection = Expect<
			Equal<typeof usersWithMethods, Collection<User, CollectionItem<User> & UserMethods>>
		>;

		const usersWithFluentMethods = instance
			.collection<User>({ name: "users" })
			.transform<CollectionItem<User> & UserMethods>((el, col) => ({
				...el,
				getNameAsLowerCase: (): string => col.collectionName + el.name.toLowerCase(),
			}));
		type _TFluentCollection = Expect<
			Equal<typeof usersWithFluentMethods, Collection<User, CollectionItem<User> & UserMethods>>
		>;

		const usersWithCombinedMethods = usersWithFluentMethods.transform<
			CollectionItem<User> & UserMethods & UserExtraMethods
		>((el) => ({
			...el,
			getNameAsUpperCase: (): string => el.name.toUpperCase(),
		}));
		type _TCombinedCollection = Expect<
			Equal<
				typeof usersWithCombinedMethods,
				Collection<User, CollectionItem<User> & UserMethods & UserExtraMethods>
			>
		>;

		function _staticCheck(res: CollectionItem<User> & UserMethods & UserExtraMethods) {
			const lower: string = res.getNameAsLowerCase();
			const upper: string = res.getNameAsUpperCase();
			const id: string = res[ID_FIELD];
			const name: string = res.name;
			const age: number = res.age;
			expect(lower).to.exist;
			expect(upper).to.exist;
			expect(id).to.exist;
			expect(name).to.exist;
			expect(age).to.exist;
		}

		// Transforming to custom OOP Class Model
		class UserModel {
			constructor(public readonly raw: CollectionItem<User>) {}
			get uppercaseName(): string {
				return this.raw.name.toUpperCase();
			}
		}

		const usersWithClass = instance.collection<User, UserModel>({
			name: "users",
			transform: (el) => new UserModel(el),
		});

		type _TOopCollection = Expect<Equal<typeof usersWithClass, Collection<User, UserModel>>>;
		type _TOopItem = Expect<Equal<Awaited<ReturnType<typeof usersWithClass.get>>, UserModel>>;

		// Computed properties and non-method fields typing
		interface UserComputed {
			fullName: string;
			magicConstant: number;
		}

		const usersWithComputed = instance.collection<User, CollectionItem<User> & UserComputed>({
			name: "users",
			transform: (el) => ({
				...el,
				fullName: `User ${el.name}`,
				magicConstant: 42,
			}),
		});

		type _TComputedCollection = Expect<
			Equal<typeof usersWithComputed, Collection<User, CollectionItem<User> & UserComputed>>
		>;
		type _TItemWithComputed = Expect<
			Equal<Awaited<ReturnType<typeof usersWithComputed.get>>, CollectionItem<User> & UserComputed>
		>;
	});

	it("get() and searchKeys() return types", () => {
		type _TGet = Expect<Equal<ReturnType<typeof users.get>, Promise<CollectionItem<User>>>>;

		type _TSearchKeys = Expect<
			Equal<ReturnType<typeof users.searchKeys>, Promise<CollectionItem<User>[]>>
		>;

		function _negativeTests() {
			// @ts-expect-error - get requires an IdEncoding argument
			users.get();

			// @ts-expect-error - searchKeys requires an array of IdEncoding
			users.searchKeys("123");
		}
	});

	it("search() typing and @ts-expect-error validations", () => {
		type _TSearch = Expect<Equal<ReturnType<typeof users.search>, Promise<CollectionItem<User>[]>>>;

		function _searchValidations() {
			// Valid searches
			users.search([{ field: "name", criteria: "==", value: "John", ignoreCase: true }]);
			users.search([{ field: "age", criteria: ">=", value: 18 }]);
			users.search([{ field: "emails", criteria: "array-contains", value: "test@domain.com" }]);
			users.search([{ field: "name", criteria: "in", value: ["John", "Jane"] }]);
			users.search([], { limit: 10, random: true });
			users.search([], true);
			users.search([], 42);

			// @ts-expect-error - 'invalidField' is not a property of User
			users.search([{ field: "invalidField", criteria: "==", value: "test" }]);

			// @ts-expect-error - 'includes' is not a valid criteria for number field 'age'
			users.search([{ field: "age", criteria: "includes", value: 20 }]);

			// @ts-expect-error - value must be number for number field 'age'
			users.search([{ field: "age", criteria: "==", value: "twenty" }]);

			// @ts-expect-error - value for 'in' criteria must be an array
			users.search([{ field: "name", criteria: "in", value: 123 }]);

			// @ts-expect-error - search options must be an array
			users.search({ field: "name", criteria: "==", value: "John" });
		}
	});

	it("select() typing and field projection", () => {
		type _TSelect = Expect<
			Equal<
				ReturnType<typeof users.select<"name" | "age">>,
				Promise<Record<string, CollectionItem<Pick<User, "name" | "age">>>>
			>
		>;

		function _selectValidations(res: Record<string, CollectionItem<Pick<User, "name" | "age">>>) {
			const first = res["0"];
			if (first) {
				const name: string = first.name;
				const age: number = first.age;
				const id: string = first[ID_FIELD];
				// @ts-expect-error - 'emails' was not selected
				const _emails = first.emails;
			}

			// @ts-expect-error - 'invalidKey' is not a property of User
			users.select({ fields: ["name", "invalidKey"] });
		}
	});

	it("values() typing with and without flatten", () => {
		type _TValFlat = Expect<
			Equal<ReturnType<typeof users.values<"emails", true>>, Promise<string[]>>
		>;

		type _TValNoFlat = Expect<
			Equal<ReturnType<typeof users.values<"emails", false>>, Promise<string[][]>>
		>;

		type _TValAge = Expect<Equal<ReturnType<typeof users.values<"age">>, Promise<number[]>>>;

		function _valuesValidations() {
			// @ts-expect-error - 'nonExistent' is not a property of User
			users.values({ field: "nonExistent" });
		}
	});

	it("random(), readRaw(), writeRaw() typing", () => {
		type _TRand = Expect<Equal<ReturnType<typeof users.random>, Promise<CollectionItem<User>[]>>>;

		type _TRaw = Expect<
			Equal<
				ReturnType<typeof users.readRaw>,
				Promise<Record<string, CollectionItem<User>> | Record<string, User>>
			>
		>;

		type _TWriteRaw = Expect<Equal<ReturnType<typeof users.writeRaw>, Promise<WriteConfirmation>>>;

		function _rawValidations() {
			// @ts-expect-error - writeRaw value must be Record<string, User>
			users.writeRaw("invalid");
		}
	});

	it("add(), addBulk(), set(), setBulk(), remove(), removeBulk() typing", () => {
		type _TAdd = Expect<Equal<ReturnType<typeof users.add>, Promise<string>>>;
		type _TAddBulk = Expect<Equal<ReturnType<typeof users.addBulk>, Promise<string[]>>>;
		type _TSet = Expect<Equal<ReturnType<typeof users.set>, Promise<WriteConfirmation>>>;
		type _TSetBulk = Expect<Equal<ReturnType<typeof users.setBulk>, Promise<WriteConfirmation>>>;
		type _TRem = Expect<Equal<ReturnType<typeof users.remove>, Promise<WriteConfirmation>>>;
		type _TRemBulk = Expect<Equal<ReturnType<typeof users.removeBulk>, Promise<WriteConfirmation>>>;

		function _crudValidations() {
			// @ts-expect-error - add requires full User object
			users.add({ name: "Incomplete" });

			// @ts-expect-error - set requires User object as second argument
			users.set("123", { invalid: true });
		}
	});

	it("editField() and editFieldBulk() typing", () => {
		type _TEf1 = Expect<Equal<ReturnType<typeof users.editField>, Promise<WriteConfirmation>>>;
		type _TEfBulk = Expect<
			Equal<ReturnType<typeof users.editFieldBulk>, Promise<WriteConfirmation>>
		>;

		function _editFieldValidations() {
			users.editField({
				id: "123",
				field: "name",
				operation: "set",
				value: "Alice",
			});

			users.editField({
				id: "123",
				field: "isActive",
				operation: "invert",
			});

			users.editFieldBulk([
				{ id: "1", field: "age", operation: "decrement", value: 1 },
				{ id: "2", field: "emails", operation: "array-push", value: "new@email.com" },
			]);

			// @ts-expect-error - operation 'increment' requires number field ('name' is string)
			users.editField({ id: "123", field: "name", operation: "increment", value: 1 });

			// @ts-expect-error - operation 'invalid-op' does not exist
			users.editField({ id: "123", field: "name", operation: "invalid-op" });

			// @ts-expect-error - operation 'array-push' requires array field ('age' is number)
			users.editField({ id: "123", field: "age", operation: "array-push", value: 1 });
		}
	});
});
