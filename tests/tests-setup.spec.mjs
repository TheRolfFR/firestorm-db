// @ts-check

import { expect } from "chai";

import firestorm from "../src/index.js";
import { firestorm_instance, ADDRESS, TOKEN } from "./tests.env.mjs";
import Collection from "../src/collection.js";
import FirestormFiles from "../src/files.js";
import { after } from "mocha";

describe("Legacy with default instance", () => {
	it("throws if no address yet", () => {
		// @ts-ignore
		firestorm.__default_instance.address = undefined;

		expect(firestorm.address).to.throw(Error, "Firestorm address was not configured");
	});

	it("binds usable address", function () {
		firestorm.address(ADDRESS);

		const actual = firestorm.address();
		expect(actual).to.equal(ADDRESS, "Incorrect address bind");
	});

	it("throws if no token yet", () => {
		// @ts-ignore
		firestorm.__default_instance.token = undefined;

		expect(firestorm.token).to.throw(Error, "Firestorm token was not configured");
	});

	it("binds usable token", () => {
		firestorm.token(TOKEN);

		const actual = firestorm.token();
		expect(actual).to.equal(TOKEN, "Incorrect token bind");
	});
});

describe("Wrapper information", () => {
	it("binds usable address", () => {
		firestorm_instance.address = ADDRESS;

		const actual = firestorm_instance.address;
		expect(actual).to.equal(ADDRESS, "Incorrect address bind");
	});

	it("can use constructor address", () => {
		const tmp = firestorm.create({ address: ADDRESS });
		expect(firestorm_instance.address).to.equal(tmp.address, "Address was not set correctly");
	});

	it("binds usable token", () => {
		firestorm_instance.token = TOKEN;

		const actual = firestorm_instance.token;
		expect(actual).to.equal(TOKEN, "Incorrect token bind");
	});

	it("can use constructor token", () => {
		firestorm_instance.token = TOKEN;
		const tmp = firestorm.create({ token: TOKEN });
		expect(firestorm_instance.token).to.equal(tmp.token, "Token was not set correctly");
	});

	it("gets the version field correctly", async () => {
		firestorm_instance.token = TOKEN;

		const version = await firestorm_instance.serverVersion;
		expect(version).to.match(/\d+\.\d+\.\d+/, "Version did not match expected schema");
	});

	it("server and client versions match", async () => {
		expect(await firestorm_instance.isCompatibleAddress()).to.be.true;
	});

	it("getting the server version requires token", (done) => {
		// no token
		const tmp = firestorm.create({ address: ADDRESS });
		tmp.serverVersion.then(() => done("Expected to fail")).catch(() => done());
	});
});

describe("Basic instance operations", () => {
	it("Retrieves address when no name was provided", () => {
		let ins = firestorm.create({
			address: "https://example.com",
			token: "0123456789",
		});
		expect(ins.name).to.equal("https://example.com/");
	});

	it("shall fail to retrieve server version if no adress was provided", (done) => {
		let ins = firestorm.create({
			name: "Example",
			token: "0123456789",
		});
		ins.serverVersion.then(() => done("Expected to fail")).catch(() => done());
	});

	let ins = firestorm.create({
		name: "Example",
		// Test without trailing slash so he adds it by itself
		address: "https://example.com",
		token: "0123456789",
	});

	it("can get and set name after instanciation", () => {
		// Test without trailing slash so he adds it by itself
		ins.address = "https://example.com";
		expect(ins.address).to.equal("https://example.com/");
		// Test without trailing slash so he adds it by itself
		let address = firestorm.address("https://example.com");
		expect(address).to.equal("https://example.com/");
	});

	it("can get and set token after instanciation", () => {
		ins.token = "abcdefghij";
		expect(ins.token).to.equal("abcdefghij");
	});

	it("can get and set name after instanciation", () => {
		ins.name = "TheMatrix";
		expect(ins.name).to.equal("TheMatrix");
	});

	it("can create a base collection without method modification", () => {
		let cars = ins.collection("cars");
		expect(cars).to.be.an.instanceof(Collection);
	});

	// soon deprecated
	it("can create a table from the default instance", () => {
		/** @ignore */
		let trucks = firestorm.table("trucks");
		expect(trucks.collectionName).to.equal("trucks");
	});

	it("can retrieve files for default instance", () => {
		let files = firestorm.files;
		expect(files).to.be.an.instanceof(FirestormFiles);
	});

	it("can't create a collection without a name", () => {
		expect(() => firestorm.collection("")).to.throw(SyntaxError, "Collection must have a name");
	});

	it("can't create a collection without function metohds", () => {
		// @ts-ignore
		expect(() => firestorm.collection("cars", "not a function")).to.throw(
			TypeError,
			"Collection add methods must be a function",
		);
	});

	after(() => {
		firestorm.address(ADDRESS);
		firestorm.token(TOKEN);
	});
});
