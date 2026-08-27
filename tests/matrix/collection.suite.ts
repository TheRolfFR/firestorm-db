import { expect } from "chai";
import { TestTarget, createTestEnv } from "./test-target.js";

export function runCollectionSuite(target: TestTarget) {
	describe(`[${target.name}] Firestorm Collection Resource`, () => {
		const env = createTestEnv(target);

		beforeEach(async () => {
			await env.resetDatabaseContent();
		});

		describe("Constructor & Resource Configuration", () => {
			it("throws TypeError if options is not an object", () => {
				expect(() => {
					// @ts-expect-error - testing invalid non-object options argument
					new target.Collection(env.instance, "base" as any);
				}).to.throw(TypeError, "Collection options must be an object");
			});

			it("throws Error if resource name is missing or empty", () => {
				expect(() => new target.Collection(env.instance, { name: "" })).to.throw(
					Error,
					"Resource must have a name",
				);
			});

			it("throws TypeError if transform parameter is not a function", () => {
				expect(() => {
					// @ts-expect-error - testing invalid non-function transform argument
					new target.Collection(env.instance, { name: "base", transform: "not-a-function" as any });
				}).to.throw(TypeError, "Collection transform must be a function");
			});

			it("exposes collectionName and manager", () => {
				expect(env.base.collectionName).to.equal("base");
				expect(env.base.manager).to.be.an.instanceOf(target.ResourceManager);
				expect(env.base.manager.collectionName).to.equal("base");
			});
		});

		describe("Read Operations (get, searchKeys, search, readRaw, select, values, random, sha1)", () => {
			it("get retrieves single item with injected ID_FIELD", async () => {
				const item = await env.base.get("0");
				expect(item[target.ID_FIELD]).to.equal("0");
				expect(item.name).to.equal("Joy Harper");
				expect(item.age).to.equal(23);
			});

			it("searchKeys retrieves multiple items", async () => {
				const items = await env.base.searchKeys(["0", "1"]);
				expect(items).to.be.an("array").with.lengthOf(2);
				expect(items[0]?.[target.ID_FIELD]).to.equal("0");
				expect(items[1]?.[target.ID_FIELD]).to.equal("1");
			});

			it("searchKeys throws TypeError if keys parameter is not an array", async () => {
				let threw = false;
				try {
					// @ts-expect-error - testing non-array keys argument
					await env.base.searchKeys("0");
				} catch (err) {
					threw = true;
					expect(err).to.be.an.instanceOf(TypeError);
					expect((err as Error).message).to.equal("Keys must be an array");
				}
				expect(threw).to.be.true;
			});

			it("search filters items correctly with criteria and limit", async () => {
				const results = await env.base.search(
					[{ field: "name", criteria: "contains", value: "Joy", ignoreCase: true }],
					{ limit: 2 },
				);
				expect(results).to.be.an("array");
				expect(results.length).to.be.at.most(2);
				results.forEach((item) => {
					expect(item.name.toLowerCase()).to.include("joy");
				});
			});

			it("search supports criteria 'in'", async () => {
				const results = await env.base.search([
					{ field: "name", criteria: "in", value: ["Joy Harper", "Joy papa Buttercup"] },
				]);
				expect(results).to.be.an("array").with.lengthOf(2);
			});

			it("search supports criteria 'array-contains'", async () => {
				const results = await env.houseCollection.search([
					{ field: "furniture", criteria: "array-contains", value: "sofa" },
				]);
				expect(results).to.be.an("array").with.lengthOf(1);
				expect(results[0]?.name).to.equal("Living Room");
			});

			it("search supports criteria 'array-contains-all'", async () => {
				const results = await env.houseCollection.search([
					{ field: "furniture", criteria: "array-contains-all", value: ["sofa", "table"] },
				]);
				expect(results).to.be.an("array").with.lengthOf(1);
				expect(results[0]?.name).to.equal("Living Room");

				const noResults = await env.houseCollection.search([
					{ field: "furniture", criteria: "array-contains-all", value: ["sofa", "bed"] },
				]);
				expect(noResults).to.be.an("array").with.lengthOf(0);
			});

			it("search options runtime validation for invalid parameters", async () => {
				try {
					// @ts-expect-error - search options must be an array
					await env.base.search({ field: "name", criteria: "==", value: "Joy" });
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("Search options must be an array");
				}

				try {
					// @ts-expect-error - search result options invalid type
					await env.base.search([], "invalid");
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("Incorrect search result options");
				}

				try {
					await env.base.search([], { limit: -1 });
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.include("limit must be a positive integer");
				}

				try {
					await env.base.search([], { random: "invalid" as unknown as boolean });
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.include("random must be a boolean or an integer");
				}

				try {
					// @ts-expect-error - missing criteria and value
					await env.base.search([{ field: "name" }]);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("Missing fields in search options array");
				}

				try {
					// @ts-expect-error - field must be string
					await env.base.search([{ field: 123, criteria: "==", value: "Joy" }]);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("Search option field must be a string");
				}

				try {
					// @ts-expect-error - field 'invalidField' does not exist on BaseItem
					await env.base.search([{ field: "invalidField", criteria: "==", value: "Joy" }]);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect(err).to.exist;
				}
			});

			it("readRaw retrieves all items", async () => {
				const raw = await env.base.readRaw();
				expect(raw).to.have.property("0");
				expect(raw["0"]?.[target.ID_FIELD]).to.equal("0");

				const rawOriginal = await env.base.readRaw(true);
				expect(rawOriginal["0"]).to.not.have.property("id");
				expect((rawOriginal["0"] as any)?.[target.ID_FIELD]).to.be.undefined;
			});

			it("select retrieves specified fields only with injected ID_FIELD", async () => {
				const res = await env.base.select({ fields: ["name", "age"] });
				expect(res).to.have.property("0");
				expect(res["0"]?.[target.ID_FIELD]).to.equal("0");
				expect(res["0"]).to.have.property("name");
				expect(res["0"]).to.have.property("age");
			});

			it("values retrieves unique non-null values for a key", async () => {
				const ages = await env.base.values({ field: "age" });
				expect(ages).to.be.an("array");
				expect(ages).to.include(23);

				const friendsFlattened = await env.base.values({ field: "friends", flatten: true });
				expect(friendsFlattened).to.be.an("array");
				expect(friendsFlattened).to.include("Monica");
			});

			it("values runtime validation for invalid parameters", async () => {
				try {
					// @ts-expect-error - missing option argument
					await env.base.values();
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("Value option must be provided");
				}

				try {
					// @ts-expect-error - non-string field
					await env.base.values({ field: 123 });
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("Field must be a string");
				}

				try {
					// @ts-expect-error - non-boolean flatten
					await env.base.values({ field: "age", flatten: "true" });
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("Flatten must be a boolean");
				}
			});

			it("random retrieves elements with optional max, seed, offset", async () => {
				const items = await env.base.random();
				expect(items).to.be.an("array");

				const seeded = await env.base.random(2, 42, 0);
				expect(seeded).to.be.an("array");
			});

			it("random runtime validation for invalid parameters", async () => {
				const invalidMax = [null, false, "invalid", 5.5, -2];
				for (const max of invalidMax) {
					try {
						// @ts-expect-error - testing invalid max parameter
						await env.base.random(max);
						expect.fail(`Should have thrown for max ${max}`);
					} catch (err) {
						expect((err as Error).message).to.equal("Expected integer >= -1 for the max");
					}
				}

				const invalidSeed = [null, false, "invalid", 5.5];
				for (const seed of invalidSeed) {
					try {
						// @ts-expect-error - testing invalid seed parameter
						await env.base.random(5, seed);
						expect.fail(`Should have thrown for seed ${seed}`);
					} catch (err) {
						expect((err as Error).message).to.equal("Expected integer for the seed");
					}
				}

				try {
					await env.base.random(5, undefined, 2);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("You can't put an offset without a seed");
				}

				const invalidOffset = [null, false, "invalid", 5.5, -1];
				for (const offset of invalidOffset) {
					try {
						// @ts-expect-error - testing invalid offset parameter
						await env.base.random(5, 42, offset);
						expect.fail(`Should have thrown for offset ${offset}`);
					} catch (err) {
						expect((err as Error).message).to.equal("Expected integer >= 0 for the offset");
					}
				}
			});

			it("sha1 calculates SHA-1 hash of the collection", async () => {
				const hash = await env.base.sha1();
				expect(hash).to.be.a("string");
				expect(hash.length).to.equal(40);
			});
		});

		describe("Write Operations (add, addBulk, set, setBulk, remove, removeBulk, editField, editFieldBulk, writeRaw)", () => {
			it("add creates a new entry and returns key", async () => {
				const newId = await env.base.add({
					name: "New Person",
					age: 30,
					amazing: true,
					qualities: ["fast"],
					friends: ["None"],
				});
				expect(newId).to.be.a("string");

				const item = await env.base.get(newId);
				expect(item.name).to.equal("New Person");
			});

			it("add generates uniqid keys by default when autoIncrement is false", async () => {
				const randomCollection = env.instance.collection<{ test: string }>({ name: "random_keys" });
				const newId = await randomCollection.add({ test: "uniqid_value" });
				expect(newId).to.be.a("string");
				expect(newId).to.match(/^[0-9a-f]{13}$/);
			});

			it("add generates 32-character cryptographically secure keys when secureKeys is enabled", async () => {
				const secureCollection = env.instance.collection<{ test: string }>({ name: "secure_keys" });
				const newId = await secureCollection.add({ test: "secure_value" });
				expect(newId).to.be.a("string");
				expect(newId).to.match(/^[0-9a-f]{32}$/);
			});

			it("addBulk creates multiple new entries", async () => {
				const ids = await env.base.addBulk([
					{
						name: "Bulk 1",
						age: 20,
						amazing: false,
						qualities: [],
						friends: [],
					},
					{
						name: "Bulk 2",
						age: 21,
						amazing: true,
						qualities: [],
						friends: [],
					},
				]);
				expect(ids).to.be.an("array").with.lengthOf(2);
			});

			it("set updates or replaces entry by key", async () => {
				await env.base.set("0", {
					name: "Joy Updated",
					age: 24,
					amazing: true,
					qualities: ["updated"],
					friends: ["Monica"],
				});

				const updated = await env.base.get("0");
				expect(updated.name).to.equal("Joy Updated");
				expect(updated.age).to.equal(24);
			});

			it("setBulk updates multiple entries by keys", async () => {
				await env.base.setBulk(
					["0", "1"],
					[
						{
							name: "Joy Bulk 0",
							age: 24,
							amazing: true,
							qualities: [],
							friends: [],
						},
						{
							name: "Joy Bulk 1",
							age: 14,
							amazing: false,
							qualities: [],
							friends: [],
						},
					],
				);

				const item0 = await env.base.get("0");
				const item1 = await env.base.get("1");
				expect(item0.name).to.equal("Joy Bulk 0");
				expect(item1.name).to.equal("Joy Bulk 1");
			});

			it("remove deletes an entry by key", async () => {
				await env.base.remove("0");
				try {
					await env.base.get("0");
					expect.fail("Should have failed to find deleted key");
				} catch (err) {
					expect(err).to.exist;
				}
			});

			it("removeBulk deletes multiple entries by keys", async () => {
				await env.base.removeBulk(["0", "1"]);
				const remaining = await env.base.readRaw();
				expect(remaining).to.not.have.property("0");
				expect(remaining).to.not.have.property("1");
			});

			it("editField and editFieldBulk mutate specific fields", async () => {
				await env.resetDatabaseContent();

				await env.base.editField({
					id: "1",
					field: "age",
					operation: "increment",
					value: 5,
				});

				const item = await env.base.get("1");
				expect(item.age).to.equal(18);

				await env.base.editFieldBulk([
					{
						id: "1",
						field: "amazing",
						operation: "invert",
					},
					{
						id: "2",
						field: "name",
						operation: "set",
						value: "Buttercup",
					},
				]);

				const item1 = await env.base.get("1");
				const item2 = await env.base.get("2");
				expect(item1.amazing).to.be.true;
				expect(item2.name).to.equal("Buttercup");
			});

			it("writeRaw sets entire collection content and throws on null/undefined", async () => {
				try {
					// @ts-expect-error - writeRaw value cannot be null
					await env.base.writeRaw(null);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("writeRaw value cannot be undefined or null");
				}

				try {
					// @ts-expect-error - writeRaw value cannot be undefined
					await env.base.writeRaw(undefined);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("writeRaw value cannot be undefined or null");
				}
			});
		});

		describe("Custom Methods & Method Injection Fluent API", () => {
			it("injects methods into collection items via constructor", async () => {
				interface GreetMethod {
					id: string | number;
					name: string;
					greet(): string;
				}
				const collectionWithMethods = env.instance.collection<Record<string, unknown>, GreetMethod>(
					{
						name: "base",
						transform: (el) => ({
							...el,
							name: String(el.name),
							greet: () => `Hello ${el.name}`,
						}),
					},
				);

				const item = await collectionWithMethods.get("0");
				expect(item).to.have.property("greet");
				expect(item.greet()).to.equal("Hello Joy Harper");
			});

			it("chains custom methods via transform fluent API", async () => {
				interface MethodsA {
					id: string | number;
					name: string;
					sayHello(): string;
				}
				interface MethodsB extends MethodsA {
					sayBye(): string;
				}

				const collectionA = env.instance.collection<Record<string, unknown>, MethodsA>({
					name: "base",
					transform: (el) => ({
						...el,
						name: String(el.name),
						sayHello: () => `Hi ${el.name}`,
					}),
				});

				const collectionAB = collectionA.transform<MethodsB>((el) => ({
					...el,
					sayBye: () => `Bye ${el.name}`,
				}));

				const item = await collectionAB.get("0");
				expect(item.sayHello()).to.equal("Hi Joy Harper");
				expect(item.sayBye()).to.equal("Bye Joy Harper");
			});

			it("transforms items into custom OOP class instances", async () => {
				class UserModel {
					constructor(
						public readonly id: string,
						public readonly name: string,
						public readonly age: number,
					) {}

					get formatted(): string {
						return `${this.name} (${this.age})`;
					}

					greet(): string {
						return `Hello from ${this.name}!`;
					}
				}

				const oopCollection = env.instance.collection<{ name: string; age: number }, UserModel>({
					name: "base",
					transform: (el) => new UserModel(el[target.ID_FIELD], el.name, el.age),
				});

				const user = await oopCollection.get("0");
				expect(user).to.be.an.instanceOf(UserModel);
				expect(user.id).to.equal("0");
				expect(user.formatted).to.equal("Joy Harper (23)");
				expect(user.greet()).to.equal("Hello from Joy Harper!");
			});

			it("transforms items by sanitizing and stripping sensitive fields", async () => {
				interface SafeUser {
					id: string | number;
					name: string;
				}

				const safeCollection = env.instance.collection<{ name: string; age: number }, SafeUser>({
					name: "base",
					transform: (el) => ({ id: el[target.ID_FIELD], name: el.name }),
				});

				const safeUser = await safeCollection.get("0");
				expect(safeUser).to.deep.equal({ id: "0", name: "Joy Harper" });
				expect((safeUser as any).age).to.be.undefined;
			});

			it("passes collection instance to transform callback", async () => {
				const collectionWithRef = env.instance
					.collection({ name: "base" })
					.transform((el, col) => ({
						...el,
						getColName: () => col.collectionName,
					}));

				const item = await collectionWithRef.get("0");
				expect(item.getColName()).to.equal("base");
			});

			it("injects computed values and constants into collection items", async () => {
				const collectionWithComputed = env.instance.collection<{ name: string; age: number }>({
					name: "base",
					transform: (el) => ({
						...el,
						veryUsefulConstant: 123,
						fullName: `Person: ${el.name}`,
						isAdult: el.age >= 18,
					}),
				});

				const item = await collectionWithComputed.get("0");
				expect(item.veryUsefulConstant).to.equal(123);
				expect(item.fullName).to.equal("Person: Joy Harper");
				expect(item.isAdult).to.be.true;
			});
		});
	});
}
