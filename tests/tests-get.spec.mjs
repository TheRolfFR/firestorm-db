// @ts-check

import path from "path";
import fs from "fs";
import crypto from "crypto";
import { expect } from "chai";

import firestorm from "../src/index.js";

const DATABASE_NAME = "base";
const DATABASE_FILE = path.join(process.cwd(), "tests", "files", "base.json");

const HOUSE_DATABASE_NAME = "house";
const HOUSE_DATABASE_FILE = path.join(
	process.cwd(),
	"tests",
	"files",
	`${HOUSE_DATABASE_NAME}.json`,
);

let base; // = undefined
let content;
let houseCollection; // = undefined

const resetDatabaseContent = async () => {
	// reset the content of the database
	await base.writeRaw(content).catch((err) => console.error(err));

	houseCollection = firestorm.collection(HOUSE_DATABASE_NAME);
	const rawHouse = JSON.parse(fs.readFileSync(HOUSE_DATABASE_FILE).toString());
	await houseCollection.writeRaw(rawHouse);
};

describe("GET operations", () => {
	before(async () => {
		base = firestorm.collection(DATABASE_NAME);

		const rawContent = fs.readFileSync(DATABASE_FILE).toString();
		content = JSON.parse(rawContent);

		await resetDatabaseContent();
	});

	describe("readRaw()", () => {
		it("fails if table not found", (done) => {
			firestorm
				.collection("unknown")
				.readRaw()
				.then(() => done(new Error("Request should not fulfill")))
				.catch((err) => {
					if ("response" in err && err.response.status == 404) {
						done();
						return;
					}
					done(new Error("Should return 404"));
				});
		});

		it("returns the exact contents of the file", (done) => {
			base
				.readRaw(true)
				.then((res) => {
					expect(res).deep.equals(content, "Content different");
					done();
				})
				.catch(done);
		});

		it("injects ID values into every item", (done) => {
			base
				.readRaw()
				.then((res) => {
					Object.entries(res).forEach(([k, v]) =>
						expect(v).to.have.property(firestorm.ID_FIELD, k, "Missing ID field"),
					);
					Object.keys(res).forEach((key) => delete res[key][firestorm.ID_FIELD]);
					expect(res).deep.equals(content, "Content different");
					done();
				})
				.catch(done);
		});
	});

	describe("sha1()", () => {
		it("sha1 content hash is the same", (done) => {
			base
				.sha1()
				.then((res) => {
					const sha1 = crypto.createHash("sha1").update(JSON.stringify(content)).digest("hex");
					expect(res).equals(sha1, "Content hash different");
					done();
				})
				.catch((err) => {
					done(err);
				});
		});
	});

	describe("get(key)", () => {
		it("string parameter should return the correct value", (done) => {
			base
				.get("0")
				.then((res) => {
					delete res[firestorm.ID_FIELD]; // normal, get gives an id field
					expect(res).deep.equals(content[0], "Content different");
					done();
				})
				.catch(done);
		});

		it("number parameter should return the correct value", (done) => {
			base
				.get(0)
				.then((res) => {
					delete res[firestorm.ID_FIELD]; // normal, get gives an id field
					expect(res).deep.equals(content[0], "Content different");
					done();
				})
				.catch(done);
		});

		it("string and number parameters gives the same result", (done) => {
			const ID = 1;
			Promise.all([base.get(ID), base.get(String(ID))])
				.then((results) => {
					expect(results[0]).deep.equals(results[1], "Content different");
					done();
				})
				.catch(done);
		});
	});

	describe("searchKeys(arrayKey)", () => {
		it("fails with incorrect parameters", (done) => {
			base
				.searchKeys(1, 2, 3)
				.then(() => {
					done(new Error("Parameter should be an array of string or number"));
				})
				.catch(() => done());
		});

		it("returns empty results when no found", (done) => {
			base
				.searchKeys([5, 7])
				.then((res) => {
					// expected []
					expect(res).to.be.an("array", "Value should be an array");
					expect(res).to.have.lengthOf(0, "Value should be empty array");
					done();
				})
				.catch(() => done(new Error("Should not reject")));
		});

		it("returns correct content", (done) => {
			base
				.searchKeys([0, 2])
				.then((res) => {
					res = res.map((el) => {
						delete el[firestorm.ID_FIELD];
						return el;
					});
					const expected = [content[0], content[2]];

					expect(res).deep.equals(expected, "Result content doesn't match");
					done();
				})
				.catch(() => done(new Error("Should not reject")));
		});
	});

	describe("search(searchOptions)", () => {
		/**
		 * @type {Readonly<[string, string, any, string[], boolean?]>[]}
		 * [criteria, field, value, idsFound, ignoreCase]
		 */
		const testArray = [
			["!=", "age", 13, ["0", "2"]],
			["==", "age", 13, ["1"]],
			["==", "age", 25, []],
			[">=", "age", 0, ["0", "1", "2"]],
			[">=", "age", 50, []],
			["<=", "age", 23, ["0", "1"]],
			["<=", "age", 12, []],
			[">", "age", 23, ["2"]],
			[">", "age", 45, []],
			["<", "age", 45, ["0", "1"]],
			["<", "age", 13, []],
			["in", "age", [23, 13], ["0", "1"]],
			["in", "age", [21, 19], []],
			["in", "name", ["Joy Harper"], ["0"]],
			["includes", "name", "Joy", ["0", "1", "2"]],
			["includes", "name", "jOy", ["0", "1", "2"], true],
			["includes", "name", "Bobby", []],
			["startsWith", "name", "Joy", ["0", "1"]],
			["startsWith", "name", "joY", ["0", "1"], true],
			["startsWith", "name", "TheRolf", []],
			["endsWith", "name", "Harper", ["0", "2"]],
			["endsWith", "name", "hArPER", ["0", "2"], true],
			["endsWith", "name", "Wick", []],
			["array-contains", "qualities", "strong", ["0", "1"]],
			["array-contains", "qualities", "sTRoNG", ["0", "1"], true],
			["array-contains", "qualities", "handsome", []],
			["array-contains-none", "qualities", ["strong"], ["2"]],
			["array-contains-none", "qualities", ["sTrOnG"], ["2"], true],
			["array-contains-none", "qualities", ["strong", "calm"], []],
			["array-contains-any", "qualities", ["intelligent", "calm"], ["0", "2"]],
			["array-contains-any", "qualities", ["intELLIGent", "CALm"], ["0", "2"], true],
			["array-contains-any", "qualities", ["fast", "flying"], []],
			["array-length-eq", "friends", 6, ["0"]],
			["array-length-eq", "friends", 2, []],
			["array-length-df", "friends", 6, ["1", "2"]],
			["array-length-lt", "friends", 6, ["1", "2"]],
			["array-length-lt", "friends", 1, []],
			["array-length-gt", "friends", 1, ["0", "1"]],
			["array-length-gt", "friends", 6, []],
			["array-length-le", "friends", 6, ["0", "1", "2"]],
			["array-length-le", "friends", 1, ["2"]],
			["array-length-ge", "friends", 3, ["0", "1"]],
			["array-length-ge", "friends", 7, []],
		];

		testArray.forEach(([criteria, field, value, idsFound, ignoreCase]) => {
			ignoreCase = !!ignoreCase;
			it(`${criteria} criteria${idsFound.length == 0 ? " (empty result)" : ""}${
				ignoreCase ? " (case insensitive)" : ""
			}`, (done) => {
				base
					.search([
						{
							criteria,
							field,
							value,
							ignoreCase,
						},
					])
					.then((res) => {
						expect(res).to.be.an("array", "Search result must be an array");
						expect(res).to.have.lengthOf(
							idsFound.length,
							"Expected result have not correct length",
						);
						expect(res.map((el) => el[firestorm.ID_FIELD])).to.deep.equal(
							idsFound,
							"Incorrect result search",
						);
						done();
					})
					.catch((err) => {
						done(err);
					});
			});
		});
	});

	describe("search(searchOptions, random)", () => {
		describe("Nested keys test", () => {
			it("doesn't crash if unknown nested key", (done) => {
				base
					.search([
						{
							criteria: "==",
							field: "path.to.the.key",
							value: "gg",
						},
					])
					.then((res) => {
						expect(res).not.to.be.undefined;
						expect(res.length).to.equal(0);
						done();
					})
					.catch(done);
			});
			it("can find correct nested value", (done) => {
				base
					.search([
						{
							criteria: "==",
							field: "path.to.key",
							value: "yes",
						},
					])
					.then((res) => {
						expect(res).not.to.deep.equal([]);
						delete res[0][firestorm.ID_FIELD];
						expect(res).to.deep.equal([
							{
								name: "Joy Harper",
								age: 23,
								amazing: true,
								qualities: ["intelligent", "strong", "efficient"],
								friends: ["Monica", "Chandler", "Phoebe", "Ross", "Joe", "Rachel"],
								path: {
									to: {
										key: "yes",
									},
								},
							},
						]);
						done();
					})
					.catch((err) => done(err));
			});
		});

		// undefined works because random becomes default parameter false, so false works too
		const incorrect = [null, "gg", ""];
		incorrect.forEach((incor) => {
			it(`${JSON.stringify(incor)} seed rejects`, (done) => {
				base
					.search(
						[
							{
								criteria: "includes",
								field: "name",
								value: "",
							},
						],
						incor,
					)
					.then((res) => done(`got ${JSON.stringify(res)} value`))
					.catch(() => done());
			});
		});

		it("true seed succeeds", (done) => {
			base
				.search(
					[
						{
							criteria: "includes",
							field: "name",
							value: "",
						},
					],
					true,
				)
				.then(() => done())
				.catch((err) => {
					done("Should not reject with error " + JSON.stringify(err));
				});
		});

		it("Gives the same result for the same seed", (done) => {
			const seed = Date.now();
			const intents = new Array(20);
			Promise.all(
				intents.map((e) => {
					return base.search(
						[
							{
								criteria: "includes",
								field: "name",
								value: "",
							},
						],
						seed,
					);
				}),
			)
				.then((results) => {
					for (let i = 1; i < results.length; ++i) {
						expect(results[0]).to.be.deep.equal(results[i], "Same seed gave different results");
					}
					done();
				})
				.catch((err) => {
					done("Should not reject with error " + JSON.stringify(err));
				});
		});
	});

	describe("select(selectOptions)", () => {
		it("requires a fields field", (done) => {
			base
				.select(undefined)
				.then(() => done("Did not expect it to success"))
				.catch(() => done());
		});
		describe("requires field to be a string array", () => {
			// all incorrect values must catch
			const incorrect = [undefined, null, false, 5, 12.5, "gg", { toto: "tata" }];
			incorrect.forEach((incor) => {
				it(`${JSON.stringify(incor)} value rejects`, (done) => {
					base
						.select({ fields: incor })
						.then((res) => done(`got ${JSON.stringify(res)} value`))
						.catch(() => done());
				});
			});
		});

		describe("Empty array passes", () => {
			[[], {}].forEach((val) => {
				it(`${JSON.stringify(val)} value`, (done) => {
					base
						.select({ fields: val })
						.then(() => done())
						.catch(done);
				});
			});
		});

		describe(`must accept only string arrays`, () => {
			// incorrect arrays
			[undefined, null, false, 5, 12.5, {}].forEach((incor) => {
				it(`[${JSON.stringify(incor)}] value rejects`, (done) => {
					base
						.select({ fields: [incor] })
						.then(() => done(`[${JSON.stringify(incor)}] value passed`))
						.catch(() => done());
				});
			});
		});

		it("Gives correct value", (done) => {
			const chosenFields = ["name", "age"];
			Promise.all([base.readRaw(), base.select({ fields: chosenFields })])
				.then(([raw, selectResult]) => {
					Object.keys(raw).forEach((k) => {
						Object.keys(raw[k]).forEach((el) => {
							if (!chosenFields.includes(el) || typeof raw[k][el] === "function") {
								delete raw[k][el];
							}
						});
					});
					Object.keys(selectResult).forEach((k) => {
						delete selectResult[k][firestorm.ID_FIELD];
					});

					expect(selectResult).to.be.deep.equal(raw, `contents are different`);
					done();
				})
				.catch(done);
		});
	});

	describe("values(valueOptions)", () => {
		it("requires a field", (done) => {
			base
				.values()
				.then(() => done("Did not expect it to succeed"))
				.catch(() => done());
		});

		it("doesn't require a flatten field", (done) => {
			base
				.values({ field: "name" })
				.then(() => done())
				.catch(() => done("Did not expect it to fail"));
		});

		it("needs a boolean flatten field if provided", (done) => {
			base
				.values({ field: "name", flatten: "this is not a boolean" })
				.then(() => done("Did not expect it to succeed"))
				.catch(() => done());
		});

		describe("needs string field value", () => {
			const incorrect = [null, false, 5.5, -5, { key: "val" }, ["asdf"]];
			incorrect.forEach((incor) => {
				it(`${JSON.stringify(incor)} value rejects`, (done) => {
					base
						.values({ field: incor })
						.then(() => done("Did not expect it to succeed"))
						.catch(() => done());
				});
			});
		});

		describe("returns the right content", () => {
			it("works on primitive without flattening", (done) => {
				base
					.values({ field: "age" })
					.then((res) => {
						// sort values to prevent possible ordering issues
						const expected = Array.from(new Set(Object.values(content).map((v) => v.age)));
						expect(res.sort()).to.deep.equal(expected.sort());
						done();
					})
					.catch(done);
			});

			it("works with an array with flattening", (done) => {
				base
					.values({ field: "friends", flatten: true })
					.then((res) => {
						const expected = Array.from(
							new Set(
								Object.values(content)
									.map((v) => v.friends)
									.flat(),
							),
						);
						expect(res.sort()).to.deep.equal(expected.sort());
						done();
					})
					.catch(done);
			});

			it("works on primitive with flattening", (done) => {
				base
					.values({ field: "age", flatten: true })
					.then((res) => {
						// flatten field gets ignored on primitives (easier to handle)
						const expected = Array.from(new Set(Object.values(content).map((v) => v.age)));
						expect(res.sort()).to.deep.equal(expected.sort());
						done();
					})
					.catch(done);
			});

			it("works on an array without flattening", (done) => {
				base
					.values({ field: "friends" })
					.then((res) => {
						const values = Object.values(content).map((v) => v.friends);
						const unique = values.filter(
							(el, i) =>
								i === values.findIndex((obj) => JSON.stringify(obj) === JSON.stringify(el)),
						);
						expect(res.sort()).to.deep.equal(unique.sort());
						done();
					})
					.catch(done);
			});
		});
	});

	describe("random(max, seed, offset)", () => {
		it("doesn't require parameters", (done) => {
			base
				.random()
				.then(() => done())
				.catch(() => done("Did not expect it to fail"));
		});
		it("passes with undefined parameters", (done) => {
			base
				.random(undefined, undefined, undefined)
				.then(() => done())
				.catch(() => done("Did not expect it to fail"));
		});

		describe("requires max parameter to be an integer >= -1", () => {
			// all incorrect values must catch
			const incorrect = [null, false, "gg", 5.5, -5, -2]; // undefined works because max is the whole collection then
			incorrect.forEach((incor) => {
				it(`${JSON.stringify(incor)} value`, (done) => {
					base
						.random(incor)
						.then((res) => done(`got ${JSON.stringify(res)} value`))
						.catch(() => done());
				});
			});
		});

		describe("requires seed parameter to be an integer", () => {
			// all incorrect values must catch
			const incorrect = [null, false, "gg", 5.5]; // undefined works because then seed is automatic
			incorrect.forEach((incor) => {
				it(`${JSON.stringify(incor)} value`, (done) => {
					base
						.random(5, incor)
						.then((res) => done(`got ${JSON.stringify(res)} value`))
						.catch(() => done());
				});
			});
		});

		it("does not pass if offset but no seed", (done) => {
			base
				.random(5, undefined, 5)
				.then((res) => done(`got ${JSON.stringify(res)} value`))
				.catch(() => done());
		});

		describe("requires offset parameter to be an integer >= 0", () => {
			// all incorrect values must catch
			const incorrect = [null, false, "gg", 5.5, -1]; // undefined works because then offset is 0
			incorrect.forEach((incor) => {
				it(`${JSON.stringify(incor)} value`, (done) => {
					base
						.random(5, 69, incor)
						.then((res) => done(`got ${JSON.stringify(res)} value`))
						.catch(() => done());
				});
			});
		});
	});
});
