import { expect } from "chai";
import { ADDRESS, TOKEN, TestTarget, ensureServerRunning } from "./test-target.js";

export function runSetupSuite(target: TestTarget) {
	describe(`[${target.name}] Firestorm Instance Setup & Configuration`, function () {
		before(async function () {
			this.timeout(10000);
			await ensureServerRunning();
		});

		it("binds usable address and normalizes trailing slash", () => {
			const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
			instance.address = ADDRESS;
			expect(instance.address).to.equal(ADDRESS, "Incorrect address bind");

			const addrWithoutSlash = `http://127.0.0.1:${process.env.PORT || "8000"}`;
			const tmp = target.createFirestorm({ address: addrWithoutSlash });
			expect(tmp.address).to.equal(`http://127.0.0.1:${process.env.PORT || "8000"}/`);
		});

		it("can use constructor options", () => {
			const tmp = target.createFirestorm({
				address: ADDRESS,
				name: "CustomInstance",
				token: TOKEN,
			});
			expect(tmp.address).to.equal(ADDRESS);
			expect(tmp.name).to.equal("CustomInstance");
			expect(tmp.token).to.equal(TOKEN);
		});

		it("fallbacks instance name to address or empty string", () => {
			const tmp1 = target.createFirestorm({ address: ADDRESS });
			expect(tmp1.name).to.equal(ADDRESS);

			const tmp2 = target.createFirestorm({});
			expect(tmp2.name).to.equal("");
		});

		it("binds usable token", () => {
			const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
			instance.token = TOKEN;
			expect(instance.token).to.equal(TOKEN, "Incorrect token bind");
		});

		it("exposes clientVersion", () => {
			const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
			expect(instance.clientVersion).to.be.a("string");
			expect(instance.clientVersion).to.match(/\d+\.\d+\.\d+/);
		});

		it("gets the server version field correctly", async () => {
			const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
			const version = await instance.serverVersion;
			expect(version).to.be.a("string");
			expect(version).to.match(/\d+\.\d+\.\d+/);
		});

		it("server and client versions are compatible", async () => {
			const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
			const isCompatible = await instance.isCompatibleAddress();
			expect(isCompatible).to.be.true;
		});

		it("throws error when accessing serverVersion without configured address", async () => {
			const instanceWithoutAddress = target.createFirestorm({});
			let threw = false;
			try {
				await instanceWithoutAddress.serverVersion;
			} catch (err) {
				threw = true;
				expect((err as Error).message).to.include("was not configured");
			}
			expect(threw).to.be.true;
		});

		it("fails serverVersion call when token is missing or invalid on server", async () => {
			const instanceWithBadToken = target.createFirestorm({
				address: ADDRESS,
				token: "InvalidTokenHere",
			});
			let threw = false;
			try {
				await instanceWithBadToken.serverVersion;
			} catch (err) {
				threw = true;
				expect(err).to.exist;
			}
			expect(threw).to.be.true;
		});

		it("returns false for isCompatibleAddress on invalid version responses", async () => {
			const tmp = target.createFirestorm({ address: ADDRESS, token: TOKEN });
			Object.defineProperty(tmp, "serverVersion", {
				get: async () => "invalid.version.number",
			});

			const compatible = await tmp.isCompatibleAddress();
			expect(compatible).to.be.false;
		});

		it("handles invalid types gracefully with @ts-expect-error directives", () => {
			const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
			// @ts-expect-error - invalid creation option parameter type
			target.createFirestorm("invalid-option");

			// @ts-expect-error - invalid string argument to collection()
			expect(() => instance.collection("base")).to.throw(
				TypeError,
				"Collection options must be an object",
			);

			// @ts-expect-error - invalid string argument to document()
			expect(() => instance.document("settings")).to.throw(
				TypeError,
				"Document options must be an object",
			);

			expect(() => instance.collection({ name: "" })).to.throw(Error, "Resource must have a name");

			expect(() => instance.document({ name: "" })).to.throw(Error, "Resource must have a name");
		});

		if (target.colGetRequest) {
			it("executes lower-level utils helpers (colPostRequest, colGetRequest, documentPostRequest, documentGetRequest)", async () => {
				const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
				const colObj = { instance, collectionName: "base" };
				const readRes = await target.colGetRequest(colObj, "readRaw", {}, false);
				expect(readRes).to.exist;

				if (target.documentGetRequest) {
					const docObj = { instance, collectionName: "settings" };
					const docRes = await target.documentGetRequest(docObj, "get", { id: "theme" }, false);
					expect(docRes).to.be.a("string");
				}
			});
		}
	});
}
