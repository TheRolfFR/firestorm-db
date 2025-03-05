const { expect } = require("chai");
const FormData = require("form-data");

const firestorm = require("..");

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { readFile } = require("fs").promises;

const PORT = process.env.PORT ? process.env.PORT : '8000'
const ADDRESS = `http://127.0.0.1:${PORT}/`;
const TOKEN = "NeverGonnaGiveYouUp";

const HOUSE_DATABASE_NAME = "house";
const HOUSE_DATABASE_FILE = path.join(__dirname, "files", `${HOUSE_DATABASE_NAME}.json`);

const DATABASE_NAME = "base";
const DATABASE_FILE = path.join(__dirname, "files", "base.json");

console.log("Testing at address " + ADDRESS + " with token " + TOKEN);

describe("Wrapper information", () => {
	it("throws if no address yet", () => {
		expect(firestorm.address).to.throw(Error, "Firestorm address was not configured");
	});
	it("binds usable address", function () {
		firestorm.address(ADDRESS);

		const actual = firestorm.address();
		expect(actual).to.equal(ADDRESS + "get.php", "Incorrect address bind");
	});
	it("throws if no token yet", (done) => {
		try {
			let res = firestorm.token();
			done("token get operation should fail, got " + res);
		} catch (e) {
			done();
		}
	});
	it("binds usable token", function () {
		firestorm.token(TOKEN);

		const actual = firestorm.token();
		expect(actual).to.equal(TOKEN, "Incorrect token bind");
	});
});

let houseCollection; // = undefined
/** @type {firestorm.Collection} */
let base; // = undefined
let content;
let tmp;

const resetDatabaseContent = async () => {
	// reset the content of the database
	await base.writeRaw(content).catch((err) => console.error(err));

	houseCollection = firestorm.collection(HOUSE_DATABASE_NAME);
	const rawHouse = JSON.parse(fs.readFileSync(HOUSE_DATABASE_FILE).toString());
	await houseCollection.writeRaw(rawHouse);
};

describe("File upload, download and delete", () => {
	it("cannot find an unknown file", (done) => {
		firestorm.files
			.get("/path/to/file.txt")
			.then((res) => {
				done(new Error("Should not succeed, got " + JSON.stringify(res)));
			})
			.catch((requestError) => {
				expect(requestError.response.status).to.equal(
					404,
					"status error incorrect " + String(requestError),
				);
				done();
			})
			.catch((testError) => {
				done(testError);
			});
	});

	it("finds an uploaded file and get it with same content", (done) => {
		const timeoutPromise = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

		const uploaded = fs.readFileSync(path.join(__dirname, "lyrics.txt"));
		const formData = new FormData();

		formData.append("path", "/lyrics.txt");
		formData.append("overwrite", "true");
		formData.append("file", uploaded, "lyrics.txt");
		
		firestorm.files.upload(formData)
			.then((res) => {
				expect(res).not.to.be.undefined;
				expect(res).to.deep.equal({ message: "Written file successfully to /lyrics.txt" }, "Message returned should match");
				return timeoutPromise(200);
			})
			.then(() => firestorm.files.get("/lyrics.txt"))
			.then((res) => {
				const downloaded = Buffer.from(res);
				fs.writeFileSync(path.join(__dirname, "downloaded.txt"), downloaded);
				
				expect(downloaded).to.deep.equal(uploaded);
				done();
			})
			.catch((err) => {
				err = err.response
					? err.response.status + ": " + JSON.stringify(err.response.data || err.response)
					: err;
				done(err);
			});
	});
	it("cannot upload an already uploaded file with no overwrite", (done) => {
		const formData = new FormData();
		formData.append("path", "/");
		readFile(path.join(__dirname, "lyrics.txt"))
			.catch(() => done(new Error("Should not succeed at first")))
			.then((res) => {
				formData.append("file", res, "lyrics.txt");
				return firestorm.files.upload(formData);
			})
			.then((res) => done(res))
			.catch((uploadError) => {
				expect(uploadError).not.to.be.undefined;
				expect(uploadError.response).not.to.be.undefined;
				expect(uploadError.response.status).to.equal(403);
				done();
			})
			.catch((err) => {
				err = err.response
					? err.response.status + ": " + JSON.stringify(err.response.data || err.response)
					: err;
				done(err);
			});
	});
	it("can delete file successfully", (done) => {
		// create form data
		const formData = new FormData();
		formData.append("path", "/lyrics.txt");
		formData.append("overwrite", "true");

		// create file read promise
		const lyricsPromise = readFile(path.join(__dirname, "lyrics.txt"));

		// get done now
		lyricsPromise.catch(() => done("File read should not failed"));

		const uploadPromise = lyricsPromise.then((res) => {
			// add file to form data
			formData.append("file", res, "lyrics.txt");
			return firestorm.files.upload(formData);
		});

		uploadPromise.catch((requestError) => {
			done("Upload should not fail, getting " + JSON.stringify(requestError.response.data));
		});

		// finally i don't need a variable here I take care of then before catch
		uploadPromise
			.then(() => {
				// now delete it
				return firestorm.files.delete("lyrics.txt");
			})
			.then(() => {
				done();
			})
			.catch((err) => {
				err = err.response
					? err.response.status + ": " + JSON.stringify(err.response.data || err.response)
					: err;
				done(err);
			});
	});
});

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
		// [criteria, field, value, idsFound, ignoreCase]
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
			incorrect = [undefined, null, false, 5, 12.5, {}];
			incorrect.forEach((incor) => {
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

		it("does not pass if offset but no seed", () => {
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
			const lastID = Object.keys(content).pop();
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
				.set()
				.then(() => done(new Error("Should not fulfill")))
				.catch(() => done());
		});

		describe("0 values fulfill", () => {
			const correctValues = ["0", 0, 0.0];

			correctValues.forEach((incor) => {
				it(`${JSON.stringify(incor)} value fulfills`, (done) => {
					base
						.set(incor, tmp)
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
			["set", "append", "array-push", "array-delete", "array-splice"].forEach((op) => {
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
