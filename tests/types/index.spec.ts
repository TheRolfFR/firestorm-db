import { createRequire } from "module";
import { expect } from "chai";

import {
	Collection,
	createFirestorm,
	Document,
	FileManager,
	ID_FIELD,
	ResourceManager,
	VERSION,
} from "../../dist/esm/index.js";
import { Firestorm } from "../../dist/esm/instance.js";

import type {
	CollectionItem,
	CollectionOptions,
	Confirmation,
	DocumentEditFieldOption,
	DocumentOptions,
	EditFieldOption,
	FirestormCreationOption,
	IdEncoding,
	Path,
	PathValue,
	SearchOption,
	SearchResultOptions,
	SelectOption,
	ValueOption,
	ValueReturnType,
} from "../../dist/esm/index.js";
import type { Equal, Expect, Extends } from "./type-helpers.js";

let expectedPackageVersion: string | undefined;
try {
	if (typeof process !== "undefined" && process.versions?.node) {
		const req = createRequire(import.meta.url);
		expectedPackageVersion = req("../../package.json").version;
	}
} catch {
	// Not in Node environment
}

describe("Type Tests: src/client/index.ts", () => {
	it("createFirestorm returns a Firestorm instance", () => {
		const instance = createFirestorm();
		type _T1 = Expect<Equal<typeof instance, Firestorm>>;
		type _T2 = Expect<Extends<typeof ID_FIELD, symbol>>;
		type _T3 = Expect<Extends<typeof VERSION, string>>;

		expect(instance).to.be.an.instanceOf(Firestorm);
		expect(typeof ID_FIELD).to.equal("symbol");
		expect(ID_FIELD).to.equal(Symbol.for("firestorm.id"));
		expect(typeof VERSION).to.equal("string");
		if (expectedPackageVersion) {
			expect(VERSION).to.equal(expectedPackageVersion);
		}
	});

	it("createFirestorm accepts optional FirestormCreationOption", () => {
		const opt: FirestormCreationOption = {
			name: "test",
			address: "http://localhost:8000/",
			token: "secret",
		};
		const instance = createFirestorm(opt);
		expect(instance).to.be.an.instanceOf(Firestorm);

		// @ts-expect-error - invalid option property
		createFirestorm({ invalidProp: 123 });
	});

	it("re-exports all expected types from client modules", () => {
		type _TCollectionItem = Expect<
			Equal<
				CollectionItem<{ name: string; age: number }>,
				{ name: string; age: number } & { [ID_FIELD]: string }
			>
		>;
		type _TConf = Expect<Extends<Confirmation, { response?: unknown }>>;
		type _TPath = Expect<Equal<Path<{ a: { b: string }; c: number }>, "a" | "c" | "a.b">>;
		type _TPathValue = Expect<Equal<PathValue<{ a: { b: string }; c: number }, "a.b">, string>>;

		type _TEditField = Expect<
			Extends<
				EditFieldOption<{ count: number }>,
				{ id: IdEncoding; field: "count" | string; operation: string; value?: unknown }
			>
		>;
		type _TDocEditField = Expect<
			Extends<
				DocumentEditFieldOption<{ count: number }>,
				{ field: "count" | string; operation: string; value?: unknown }
			>
		>;
		type _TSearchOption = Expect<
			Extends<SearchOption<{ age: number }>, { field: "age"; criteria: string }>
		>;
		type _TSearchResult = Expect<
			Equal<SearchResultOptions, { random?: boolean | number; limit?: number }>
		>;
		type _TSelect = Expect<Equal<SelectOption<{ a: string; b: number }, "a">["fields"], "a"[]>>;
		type _TValueOption = Expect<Equal<ValueOption<{ tags: string[] }, "tags">["field"], "tags">>;
		type _TValueReturn = Expect<Equal<ValueReturnType<{ tags: string[] }, "tags", true>, string[]>>;
	});
});
