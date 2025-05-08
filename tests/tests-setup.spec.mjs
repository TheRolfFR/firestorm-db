// @ts-check

import { expect } from "chai";

import firestorm from "../src/index.js";
import { ADDRESS, TOKEN } from "./tests.env.mjs";

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

	it("binds usable token", () => {
		firestorm.token(TOKEN);

		const actual = firestorm.token();
		expect(actual).to.equal(TOKEN, "Incorrect token bind");
	});
});
