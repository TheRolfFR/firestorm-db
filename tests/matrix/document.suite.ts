import { expect } from "chai";
import { DocContent, TestTarget, createTestEnv } from "./test-target.js";

export function runDocumentSuite(target: TestTarget) {
	describe(`[${target.name}] Firestorm Document Resource`, () => {
		const env = createTestEnv(target);

		beforeEach(async () => {
			await env.resetDatabaseContent();
		});

		describe("Constructor & Resource Properties", () => {
			it("throws TypeError if options is not an object", () => {
				expect(() => {
					// @ts-expect-error - testing invalid non-object options argument
					new target.Document(env.instance, "settings" as any);
				}).to.throw(TypeError, "Document options must be an object");
			});

			it("throws TypeError if constructor transform is not a function", () => {
				expect(() => {
					// @ts-expect-error - testing invalid transform type
					new target.Document(env.instance, {
						name: "settings",
						transform: "invalid-transform" as any,
					});
				}).to.throw(TypeError, "Document transform must be a function");
			});

			it("exposes collectionName, readAddress, and writeAddress", () => {
				expect(env.testDoc.collectionName).to.equal("settings");
				expect(env.testDoc.readAddress).to.include("get.php");
				expect(env.testDoc.writeAddress).to.include("post.php");
			});
		});

		describe("Read Operations (get, getKeys, readRaw, sha1)", () => {
			it("get retrieves single field value by key", async () => {
				const theme = await env.testDoc.get("theme");
				expect(theme).to.equal("dark");

				const version = await env.testDoc.get("version");
				expect(version).to.equal(1);
			});

			it("get correctly retrieves falsy values (false, 0)", async () => {
				await env.testDoc.set("active", false);
				const active = await env.testDoc.get("active");
				expect(active).to.be.false;

				await env.testDoc.set("version", 0);
				const version = await env.testDoc.get("version");
				expect(version).to.equal(0);
			});

			it("getKeys retrieves multiple field values in specified order", async () => {
				const values = await env.testDoc.getKeys(["version", "theme"]);
				expect(values).to.be.an("array");
				expect(values[0]).to.equal(1);
				expect(values[1]).to.equal("dark");
			});

			it("getKeys throws TypeError if keys parameter is not an array", async () => {
				let threw = false;
				try {
					// @ts-expect-error - keys argument must be an array
					await env.testDoc.getKeys("theme");
				} catch (err) {
					threw = true;
					expect(err).to.be.an.instanceOf(TypeError);
					expect((err as Error).message).to.equal("Keys must be an array");
				}
				expect(threw).to.be.true;
			});

			it("readRaw retrieves the full raw content of the document", async () => {
				const content = await env.testDoc.readRaw();
				expect(content).to.have.property("theme");
				expect(content.theme).to.equal("dark");
				expect(content.version).to.equal(1);
			});

			it("sha1 calculates SHA-1 hash of document", async () => {
				const hash = await env.testDoc.sha1();
				expect(hash).to.be.a("string");
				expect(hash.length).to.equal(40);
			});
		});

		describe("Write Operations (writeRaw, set, editField, editFieldBulk)", () => {
			it("writeRaw updates whole document content", async () => {
				await env.testDoc.writeRaw({
					theme: "light",
					version: 2,
					active: true,
					features: ["c"],
				});
				const content = await env.testDoc.readRaw();
				expect(content.theme).to.equal("light");
				expect(content.version).to.equal(2);
			});

			it("writeRaw throws TypeError on null or undefined value", async () => {
				try {
					// @ts-expect-error - writeRaw value cannot be null
					await env.testDoc.writeRaw(null);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("writeRaw value cannot be undefined or null");
				}

				try {
					// @ts-expect-error - writeRaw value cannot be undefined
					await env.testDoc.writeRaw(undefined);
					expect.fail("Should have thrown TypeError");
				} catch (err) {
					expect((err as Error).message).to.equal("writeRaw value cannot be undefined or null");
				}
			});

			it("set updates a single field in the document", async () => {
				await env.testDoc.set("theme", "solarized");
				const theme = await env.testDoc.get("theme");
				expect(theme).to.equal("solarized");
			});

			it("set updates deep field paths using dot notation", async () => {
				await env.testDoc.set("nested.feature", "enabled");
				const content = (await env.testDoc.readRaw()) as any;
				expect(content.nested?.feature).to.equal("enabled");
			});

			it("editField updates a single field in the document", async () => {
				await env.testDoc.editField({
					field: "version",
					operation: "increment",
					value: 5,
				});

				const version = await env.testDoc.get("version");
				expect(version).to.equal(6);
			});

			it("editFieldBulk updates multiple fields in the document", async () => {
				await env.testDoc.editFieldBulk([
					{
						field: "theme",
						operation: "set",
						value: "solarized",
					},
					{
						field: "version",
						operation: "increment",
						value: 10,
					},
				]);

				const content = await env.testDoc.readRaw();
				expect(content.theme).to.equal("solarized");
				expect(content.version).to.equal(11);
			});
		});

		describe("Custom Methods & Method Injection", () => {
			it("attaches methods to document content via constructor", async () => {
				interface SummaryMethod {
					getSummary(): string;
				}
				const docWithMethods = env.instance.document<DocContent, DocContent & SummaryMethod>({
					name: "settings",
					transform: (content) => ({
						...content,
						getSummary: () => `${content.theme}-v${content.version}`,
					}),
				});

				const content = await docWithMethods.readRaw();
				expect(content).to.have.property("getSummary");
				expect(content.getSummary()).to.equal("dark-v1");
			});

			it("chains custom methods via transform fluent API", async () => {
				interface MethodA {
					theme: string;
					version: number;
					getUpperTheme(): string;
				}
				interface MethodB extends MethodA {
					isVersionPositive(): boolean;
				}

				const docA = env.instance.document<DocContent, MethodA>({
					name: "settings",
					transform: (c) => ({
						...c,
						getUpperTheme: () => c.theme.toUpperCase(),
					}),
				});

				const docAB = docA.transform<MethodB>((c) => ({
					...c,
					isVersionPositive: () => c.version > 0,
				}));

				const content = await docAB.readRaw();
				expect(content.getUpperTheme()).to.equal("DARK");
				expect(content.isVersionPositive()).to.be.true;
			});

			it("transforms document into custom OOP class instance", async () => {
				class SettingsModel {
					constructor(public readonly raw: DocContent) {}

					get isDark(): boolean {
						return this.raw.theme === "dark";
					}
				}

				const oopDoc = env.instance.document<DocContent, SettingsModel>({
					name: "settings",
					transform: (c) => new SettingsModel(c),
				});

				const model = await oopDoc.readRaw();
				expect(model).to.be.an.instanceOf(SettingsModel);
				expect(model.isDark).to.be.true;
			});

			it("passes document instance to transform callback", async () => {
				const docWithRef = env.instance
					.document<DocContent>({ name: "settings" })
					.transform((c, doc) => ({
						...c,
						getDocName: () => doc.collectionName,
					}));

				const content = await docWithRef.readRaw();
				expect(content.getDocName()).to.equal("settings");
			});

			it("injects computed values and constants into document content", async () => {
				const docWithComputed = env.instance.document<DocContent>({
					name: "settings",
					transform: (c) => ({
						...c,
						computedTitle: `App Config (${c.theme})`,
						isDefaultVersion: c.version === 1,
					}),
				});

				const content = await docWithComputed.readRaw();
				expect(content.computedTitle).to.equal("App Config (dark)");
				expect(content.isDefaultVersion).to.be.true;
			});
		});
	});
}
