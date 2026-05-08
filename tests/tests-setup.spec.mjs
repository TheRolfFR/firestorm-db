// @ts-check

import { expect } from "chai";

import firestorm from "../src/index.js";
import { firestorm_instance, ADDRESS, TOKEN } from "./tests.env.mjs";

describe("Legacy with default instance", () => {
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
