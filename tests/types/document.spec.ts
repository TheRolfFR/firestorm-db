import { expect } from "chai";

import { createFirestorm, Document } from "../../dist/esm/index.js";

import type { Confirmation, DocumentEditFieldOption } from "../../dist/esm/index.js";
import type { Equal, Expect, Extends } from "./type-helpers.js";

type Settings = {
	theme: string;
	version: number;
	autoSave: boolean;
	tags: string[];
};

interface SettingsMethods {
	isDarkMode(): boolean;
}

interface ExtraSettingsMethods {
	getThemeUpper(): string;
}

describe("Type Tests: src/client/document.ts", () => {
	const instance = createFirestorm();
	const doc = instance.document<Settings>({ name: "settings" });

	it("Document instance and constructor types", () => {
		type _TDoc = Expect<Equal<typeof doc, Document<Settings, Settings>>>;
		expect(doc.name).to.equal("settings");

		const docWithOptions = instance.document<Settings>({ name: "settings_opt" });
		expect(docWithOptions.name).to.equal("settings_opt");
	});

	it("transform() and chaining fluent API typing", () => {
		const docWithMethods = instance.document<Settings, Settings & SettingsMethods>({
			name: "settings",
			transform: (c) => ({
				...c,
				isDarkMode: () => c.theme === "dark",
			}),
		});
		type _TDocMethods = Expect<
			Equal<typeof docWithMethods, Document<Settings, Settings & SettingsMethods>>
		>;

		const docWithFluentMethods = instance
			.document<Settings>({ name: "settings" })
			.transform<Settings & SettingsMethods>((c) => ({
				...c,
				isDarkMode: () => c.theme === "dark",
			}));
		type _TFluentDoc = Expect<
			Equal<typeof docWithFluentMethods, Document<Settings, Settings & SettingsMethods>>
		>;

		const docWithCombinedMethods = docWithFluentMethods.transform<
			Settings & SettingsMethods & ExtraSettingsMethods
		>((c) => ({
			...c,
			getThemeUpper: () => c.theme.toUpperCase(),
		}));
		type _TCombinedDoc = Expect<
			Equal<
				typeof docWithCombinedMethods,
				Document<Settings, Settings & SettingsMethods & ExtraSettingsMethods>
			>
		>;

		function _staticCheck(res: Settings & SettingsMethods & ExtraSettingsMethods) {
			const isDark: boolean = res.isDarkMode();
			const upper: string = res.getThemeUpper();
			const theme: string = res.theme;
			const version: number = res.version;
			expect(isDark).to.exist;
			expect(upper).to.exist;
			expect(theme).to.exist;
			expect(version).to.exist;
		}

		// Transforming to custom OOP Class Model
		class SettingsModel {
			constructor(public readonly raw: Settings) {}
			get isDark(): boolean {
				return this.raw.theme === "dark";
			}
		}

		const docWithClass = instance.document<Settings, SettingsModel>({
			name: "settings",
			transform: (c) => new SettingsModel(c),
		});

		type _TOopDoc = Expect<Equal<typeof docWithClass, Document<Settings, SettingsModel>>>;
		type _TOopContent = Expect<
			Equal<Awaited<ReturnType<typeof docWithClass.readRaw>>, SettingsModel>
		>;

		// Computed properties and non-method fields typing
		interface SettingsComputed {
			title: string;
			revision: number;
		}

		const docWithComputed = instance.document<Settings, Settings & SettingsComputed>({
			name: "settings",
			transform: (c) => ({
				...c,
				title: `Settings for ${c.theme}`,
				revision: 10,
			}),
		});

		type _TComputedDoc = Expect<
			Equal<typeof docWithComputed, Document<Settings, Settings & SettingsComputed>>
		>;
		type _TDocContentWithComputed = Expect<
			Equal<Awaited<ReturnType<typeof docWithComputed.readRaw>>, Settings & SettingsComputed>
		>;
	});

	it("get() and getKeys() return types", () => {
		type _TTheme = Expect<Equal<ReturnType<typeof doc.get<"theme">>, Promise<string>>>;
		type _TVersion = Expect<Equal<ReturnType<typeof doc.get<"version">>, Promise<number>>>;
		type _TAutoSave = Expect<Equal<ReturnType<typeof doc.get<"autoSave">>, Promise<boolean>>>;

		type _TKeysTuple = Expect<
			Equal<ReturnType<typeof doc.getKeys<["theme", "version"]>>, Promise<[string, number]>>
		>;
		type _TKeysArray = Expect<
			Equal<ReturnType<typeof doc.getKeys<("theme" | "version")[]>>, Promise<(string | number)[]>>
		>;

		function _negativeTests() {
			// @ts-expect-error - 'nonExistent' is not a key of Settings
			doc.get("nonExistent");

			// @ts-expect-error - getKeys requires an array of keys
			doc.getKeys("theme");
		}
	});

	it("readRaw() and writeRaw() return types", () => {
		type _TRead = Expect<Equal<ReturnType<typeof doc.readRaw>, Promise<Settings>>>;

		type _TWrite = Expect<Equal<ReturnType<typeof doc.writeRaw>, Promise<Confirmation>>>;

		function _rawValidations() {
			// @ts-expect-error - writeRaw value must match Settings
			doc.writeRaw({ theme: "only-theme" });
		}
	});

	it("set() typing and field value matching", () => {
		type _TSet = Expect<Equal<ReturnType<typeof doc.set<"theme">>, Promise<Confirmation>>>;

		function _setValidations() {
			// @ts-expect-error - value must be number for 'version' field
			doc.set("version", "three");

			// @ts-expect-error - 'invalidField' does not exist on Settings
			doc.set("invalidField", "val");
		}
	});

	it("editField() and editFieldBulk() typing", () => {
		type _TEf1 = Expect<Equal<ReturnType<typeof doc.editField>, Promise<Confirmation>>>;
		type _TEfBulk = Expect<Equal<ReturnType<typeof doc.editFieldBulk>, Promise<Confirmation>>>;

		function _editFieldValidations() {
			// @ts-expect-error - operation 'increment' is not allowed on string field 'theme'
			doc.editField({ field: "theme", operation: "increment", value: 1 });

			// @ts-expect-error - operation 'invert' is not allowed on number field 'version'
			doc.editField({ field: "version", operation: "invert" });
		}
	});
});
