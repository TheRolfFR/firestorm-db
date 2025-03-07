// @ts-check

import { expect } from "chai";
import fs from "fs";
import firestorm from "../src/index.js";
import path from "path";

const TOKEN = "NeverGonnaGiveYouUp";

const DATABASE_NAME = "base";
const DATABASE_FILE = path.join(process.cwd(), "tests", "files", "base.json");

const HOUSE_DATABASE_NAME = "house";
const HOUSE_DATABASE_FILE = path.join(
	process.cwd(),
	"tests",
	"files",
	`${HOUSE_DATABASE_NAME}.json`,
);

let base = firestorm.collection(DATABASE_NAME);
let houseCollection = firestorm.collection(HOUSE_DATABASE_NAME);

const rawContent = fs.readFileSync(DATABASE_FILE).toString();
const content = JSON.parse(rawContent);

let tmp;

const resetDatabaseContent = async () => {
	// reset the content of the database
	await base.writeRaw(content).catch((err) => console.error(err));

	houseCollection = firestorm.collection(HOUSE_DATABASE_NAME);
	const rawHouse = JSON.parse(fs.readFileSync(HOUSE_DATABASE_FILE).toString());
	await houseCollection.writeRaw(rawHouse);
};

describe("POST operations", () => {
	describe("writeRaw operations", () => {
		it("Rejects when incorrect token", (done) => {
			firestorm.token("LetsGoToTheMall");

			base
				.writeRaw({})
				.then((res) => done(res))
				.catch((err) => {
					if ("response" in err && err.response.status == 403) {
						done();
						return;
					}
					done(new Error("Should return 403"));
				})
				.finally(() => firestorm.token(TOKEN));
		});

		describe("You must give a correct value", () => {
			const incorrectBodies = [
				undefined,
				null,
				false,
				42,
				6.9,
				"AC-DC",
				[1, 2, 3],
				["I", "will", "find", "you"],
				{ 5: "is" },
			];

			incorrectBodies.forEach((body, index) => {
				it(`${JSON.stringify(body)} value rejects`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.writeRaw(body)
						.then((res) => done(new Error(`Should not fulfill returning ${JSON.stringify(res)}`)))
						.catch((err) => {
							if (index < 2) {
								expect(err).to.be.an("error");
								done();
							} else {
								if ("response" in err && err.response.status == 400) {
									done();
									return;
								}
								done(
									new Error(
										`Should return 400 not ${JSON.stringify(
											"response" in err && "status" in err.response ? err.response.status : err,
										)}`,
									),
								);
							}
						});
				});
			});

			it("but it can write an empty content : {}", (done) => {
				base
					.writeRaw({})
					.then(() => done())
					.catch((err) => {
						done(err);
					})
					.finally(async () => {
						await base.writeRaw(content);
					});
			});
		});
	});

	describe("add operations", () => {
		it("must fail when not on an auto-key table", (done) => {
			houseCollection
				.add({
					room: "Patio",
					size: 22.2,
					outdoor: true,
					furniture: ["table", "chair", "flowerpot"],
				})
				.then(() => done(new Error("This request should not fulfill")))
				.catch((err) => {
					if ("response" in err && err.response.status == 400) {
						done();
						return;
					}
					done(
						new Error(
							`Should return 400 not ${JSON.stringify(
								"response" in err && "status" in err.response ? err.response.status : err,
							)}`,
						),
					);
				});
		});

		it("must give incremented key when adding on a auto key auto increment", (done) => {
			const lastID = Object.keys(content).pop() ?? "";
			base
				.add({
					name: "Elliot Alderson",
					age: 29,
					handsome: true,
					friends: ["Darlene", "Angela", "Tyrell"],
				})
				.then((id) => {
					expect(id).to.be.a("string");
					expect(id).to.equals(String(parseInt(lastID) + 1));
					done();
				})
				.catch(done);
		});

		describe("It should not accept incorrect values", () => {
			const incorrectValues = [undefined, null, false, 16, "Muse", [1, 2, 3]];
			// I wanted to to test [] but serialized it's the same as an empty object which must be accepted

			incorrectValues.forEach((incor) => {
				it(`${JSON.stringify(incor)} value rejects`, (done) => {
					base
						.add(incor)
						.then((res) => {
							done(new Error(`Should not fulfill with res ${res}`));
						})
						.catch((err) => {
							if ("response" in err && err.response.status == 400) {
								done();
								return;
							}
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		describe("It should accept correct values", () => {
			const correctValues = [
				{},
				{
					name: "Elliot Alderson",
					age: 29,
					handsome: true,
					friends: ["Darlene", "Angela", "Tyrell"],
				},
			];

			correctValues.forEach((co, index) => {
				it(`${index === 0 ? "Empty object" : "Complex object"} should fulfill`, (done) => {
					base
						.add(co)
						.then(() => done())
						.catch(done);
				});
			});
		});
	});

	describe("addBulk operations", () => {
		it("must fulfill with empty array", (done) => {
			base
				.addBulk([])
				.then((res) => {
					expect(res).to.deep.equal([]);
					done();
				})
				.catch((err) => {
					if ("response" in err && err.response.status == 400) {
						done(err.response);
					}
					done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
				});
		});

		describe("must reject with incorrect base values", () => {
			const incorrectValues = [undefined, null, false, 16, "Muse", [1, 2, 3]];

			incorrectValues.forEach((incor) => {
				it(`${JSON.stringify(incor)} value rejects`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.addBulk(incor)
						.then((res) => done(new Error(`Should not fulfill with res ${res}`)))
						.catch((err) => {
							if ("response" in err && err.response.status == 400) return done();
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		describe("must reject with incorrect array", () => {
			const incorrectValues = [undefined, null, false, 16, "Muse", [1, 2, 3]];

			incorrectValues.forEach((incor) => {
				it(`[${JSON.stringify(incor)}] value rejects`, (done) => {
					base
						.addBulk([incor])
						.then((res) => {
							done(new Error(`Should not fulfill with res ${res}`));
						})
						.catch((err) => {
							if ("response" in err && err.response.status == 400) {
								done();
								return;
							}
							done(
								new Error(
									`Should return 400 not ${JSON.stringify("response" in err ? err.response : err)}`,
								),
							);
						});
				});
			});
		});

		describe("Correct value should succeed", () => {
			it("should accept array with an empty object inside", (done) => {
				base
					.addBulk([{}])
					.then((res) => {
						expect(res).to.be.an("array");
						expect(res).to.have.length(1);
						done();
					})
					.catch((err) => {
						console.error(err);
						done(err);
					});
			});

			it("should accept correct array value", (done) => {
				const inValue = [{ a: 1 }, { b: 2 }, { c: 3 }];
				base
					.addBulk(inValue)
					.then((res) => {
						expect(res).to.be.an("array");
						expect(res).to.have.length(3);
						res.forEach((id) => {
							expect(id).to.be.a("string");
						});
						return Promise.all([res, base.searchKeys(res)]);
					})
					.then((results) => {
						const searchResults = results[1];
						expect(searchResults).to.be.an("array");
						expect(searchResults).to.have.length(3);

						const idsGenerated = results[0];
						// modify results and add ID
						inValue.map((el, index) => {
							el[firestorm.ID_FIELD] = idsGenerated[index];
							return el;
						});

						expect(searchResults).to.be.deep.equals(inValue);
						done();
					})
					.catch((err) => {
						done(err);
					});
			});
		});
	});

	describe("remove operations", () => {
		describe("must reject non-keyable values", () => {
			const incorrectValues = [
				undefined,
				null,
				false,
				22.2,
				[],
				[1, 2, 3],
				{},
				{ "i'm": "batman" },
			];

			incorrectValues.forEach((incor) => {
				it(`${JSON.stringify(incor)} value rejects`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.remove(incor)
						.then((res) => {
							done(new Error(`Should not fulfill with value ${JSON.stringify(res)}`));
						})
						.catch((err) => {
							if ("response" in err && err.response.status == 400) {
								done();
								return;
							}
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		it("Succeeds if key entered does not exist", (done) => {
			base
				.remove("666")
				.then(() => done())
				.catch(done);
		});

		it("Succeeds if wanted element is actually deleted", (done) => {
			const ELEMENT_KEY_DELETED = "2";
			base
				.readRaw()
				.then((raw) => {
					delete raw[ELEMENT_KEY_DELETED];

					return Promise.all([raw, base.remove(ELEMENT_KEY_DELETED)]);
				})
				.then((results) => {
					return Promise.all([results[0], base.readRaw()]);
				})
				.then((results) => {
					const expected = results[0];
					const actual = results[1];

					expect(expected).to.be.deep.equal(actual, "Value must match");
					done();
				})
				.catch(done);
		});
	});

	describe("removeBulk operations", () => {
		describe("must accept only string array", () => {
			const incorrectValues = [undefined, null, false, [], [1, 2, 3], {}, { "i'm": "batman" }];

			incorrectValues.forEach((incor) => {
				it(`[${JSON.stringify(incor)}] value rejects`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.removeBulk([incor])
						.then((res) => {
							done(new Error(`Should not fulfill with value ${JSON.stringify(res)}`));
						})
						.catch((err) => {
							if ("response" in err && err.response.status == 400) done();
							else done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		it("Succeeds with empty array", (done) => {
			base
				.removeBulk([])
				.then(() => done())
				.catch(done);
		});

		it("Succeeds if wanted elements are actually deleted", (done) => {
			const ELEMENT_KEY_DELETED = ["0", "2"];
			base
				.readRaw()
				.then((raw) => {
					ELEMENT_KEY_DELETED.forEach((k) => delete raw[k]);

					return Promise.all([raw, base.removeBulk(ELEMENT_KEY_DELETED)]);
				})
				.then((results) => {
					return Promise.all([results[0], base.readRaw()]);
				})
				.then((results) => {
					const expected = results[0];
					const actual = results[1];

					expect(expected).to.be.deep.equal(actual, "Value must match");
					done();
				})
				.catch(done);
		});
	});

	describe("set operations", () => {
		before(() => {
			tmp = {
				name: "Barry Allen",
				age: 27,
				handsome: true,
				friends: ["Iris", "Cisco", "Caitlin", "Joe"],
			};
		});

		it("Should not succeed with no parameters in the methods", (done) => {
			base
				// @ts-expect-error: we're testing incorrect values
				.set()
				.then(() => done(new Error("Should not fulfill")))
				.catch(() => done());
		});

		describe("0 values fulfill", () => {
			const correctValues = ["0", 0, 0.0];

			correctValues.forEach((value) => {
				it(`${JSON.stringify(value)} value fulfills`, (done) => {
					base
						.set(value, tmp)
						.then(() => done())
						.catch((err) => {
							if ("response" in err) console.error(err.response.data);
							done(new Error(err));
						});
				});
			});
		});

		describe("Key must be a string or an integer", () => {
			const incorrectValues = [undefined, null, false, [], [1, 2, 3], {}, { "i'm": "batman" }];

			incorrectValues.forEach((incor) => {
				it(`${JSON.stringify(incor)} value rejects`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.set(incor, tmp)
						.then((res) => {
							done(new Error(`Should not fulfill with value ${JSON.stringify(res)}`));
						})
						.catch((err) => {
							if ("response" in err && err.response.status == 400) {
								done();
								return;
							} else done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		describe("Value must be an object", () => {
			const incorrectValues = [undefined, null, false, 16, 22.2, [1, 2, 3]];

			incorrectValues.forEach((incor) => {
				it(`${JSON.stringify(incor)} value rejects`, (done) => {
					base
						.set("1", incor)
						.then((res) => {
							done(new Error(`Should not fulfill with value ${JSON.stringify(res)}`));
						})
						.catch((err) => {
							if ("response" in err && err.response.status == 400) {
								done();
								return;
							}
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		it("must put the correct value", (done) => {
			base
				.set(42, tmp)
				.then((res) => {
					expect(res).to.deep.equals(
						{ message: "Successful set command" },
						"Message returned should match",
					);
					return base.get(42);
				})
				.then((expected) => {
					tmp[firestorm.ID_FIELD] = "42";
					expect(expected).to.deep.equals(tmp);
					done();
				})
				.catch(done);
		});
	});

	describe("setBulk operations", () => {
		it("rejects with no args", (done) => {
			base
				// @ts-expect-error: we're testing incorrect values
				.setBulk()
				.then((res) => {
					done(res);
				})
				.catch((err) => {
					if ("response" in err && err.response.status == 400) {
						done();
						return;
					}
					done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
				});
		});
		it("fulfills with two empty arrays", (done) => {
			base
				.readRaw()
				.then((before) => {
					return Promise.all([before, base.setBulk([], [])]);
				})
				.then((results) => {
					const before = results[0];
					return Promise.all([before, base.readRaw()]);
				})
				.then((results) => {
					const expected = results[0];
					const after = results[1];

					expect(expected).to.deep.equal(after, "Doing no operation doesn't change the content");
					done();
				})
				.catch((err) => {
					done(err);
				});
		});

		it("Should reject when arrays are not the same size", (done) => {
			base
				.setBulk([], [tmp])
				.then((res) => done(res))
				.catch((err) => {
					if ("response" in err && err.response.status == 400) {
						done();
						return;
					}
					done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
				});
		});

		describe("keys should be an array of string", () => {
			const incorrectValues = [undefined, null, false, [], [1, 2, 3], {}, { "i'm": "batman" }];

			incorrectValues.forEach((incor) => {
				it(`[${JSON.stringify(incor)}] value rejects`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.setBulk([incor], [tmp])
						.then((res) => {
							done(new Error(`Should not fulfill with value ${JSON.stringify(res)}`));
						})
						.catch((err) => {
							if ("response" in err && err.response.status == 400) {
								done();
								return;
							}
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		it("sets things correctly with correct request", (done) => {
			base
				.setBulk(["6"], [tmp])
				.then(() => {
					return base.get("6");
				})
				.then((found) => {
					tmp[firestorm.ID_FIELD] = "6"; // add id field

					expect(tmp).to.deep.equal(found);
					done();
				})
				.catch((err) => {
					done(new Error(err));
				});
		});
	});

	describe("editField operations", () => {
		before(async () => {
			await resetDatabaseContent();
		});

		it("Rejects with unknown operation", (done) => {
			base
				.editField({
					id: "2",
					// @ts-expect-error: we're testing incorrect values
					operation: "smile",
					field: "name",
				})
				.then((res) => done(new Error("Should not fulfill with " + JSON.stringify(res))))
				.catch((err) => {
					if ("response" in err && err.response.status == 400) return done();
					done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
				});
		});

		describe("Edits the correct values", () => {
			// field, operation, value, expected
			/**
			 * @typedef {import("../typings/index.js").EditFieldOption<any>["operation"]} operation
			 * @type {ReadonlyArray<[string, operation, any, any]>}
			 */
			const testArray = [
				["name", "set", "new name", "new name"],
				["name", "append", " yes", "new name yes"],
				["name", "remove", null, undefined],
				["amazing", "invert", null, false],
				["age", "increment", null, 46],
				["age", "increment", 3, 49],
				["age", "decrement", null, 48],
				["age", "decrement", 3, 45],
				["friends", "array-push", "Bob", ["Dwight", "Bob"]],
				["qualities", "array-delete", 2, ["pretty", "wild"]],
			];

			testArray.forEach(([field, operation, value, expected]) => {
				it(`'${operation}' on '${field}' yields ${JSON.stringify(expected)}`, (done) => {
					const obj = {
						id: 2,
						field,
						operation,
					};
					// not required
					if (value !== null) obj.value = value;
					base
						.editField(obj)
						.then((res) => {
							expect(res).to.deep.equal(
								{ message: "Successful editField command" },
								"Should not fail",
							);
							return base.get(2);
						})
						.then((res) => {
							expect(res[field]).to.deep.equal(expected, "Should be the new set values");
							done();
						})
						.catch(done);
				});
			});
		});

		describe("Reject with incorrect values", () => {
			const incorrectValues = [undefined, null, false, 16, 0.5, "", "gg", [], {}];

			incorrectValues.forEach((incor) => {
				it(`'${JSON.stringify(incor)}' value rejects`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.editField(incor)
						.then((res) => done(new Error("Should not fulfill with " + JSON.stringify(res))))
						.catch((err) => {
							if ("response" in err && err.response.status == 400) return done();
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});

		describe("Rejects with missing arguments", () => {
			const args = [
				["id", "2"],
				["field", "name"],
				["operation", "set"],
			];

			for (let i = 0; i < args.length; ++i) {
				const obj = {};
				args.slice(0, i + 1).forEach((el) => {
					obj[el[0]] = el[1];
				});

				it(`${i + 1} args is not enough`, (done) => {
					base
						// @ts-expect-error: we're testing incorrect values
						.editField(obj)
						.then((res) => done(new Error("Should not fulfill with " + JSON.stringify(res))))
						.catch((err) => {
							if ("response" in err && err.response.status == 400) return done();
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			}
		});

		describe("Rejects operations with value required", () => {
			/**
			 * @type {ReadonlyArray<import("../typings/index.js").EditFieldOption<any>["operation"]>}
			 */
			const arr = ["set", "append", "array-push", "array-delete", "array-splice"];

			arr.forEach((op) => {
				it(`${op} operation needs a value`, (done) => {
					base
						.editField({
							id: "2",
							operation: op,
							field: "name",
						})
						.then((res) => done(new Error("Should not fulfill with " + JSON.stringify(res))))
						.catch((err) => {
							if ("response" in err && err.response.status == 400) return done();
							done(new Error(`Should return 400 not ${JSON.stringify(err)}`));
						});
				});
			});
		});
	});
});
