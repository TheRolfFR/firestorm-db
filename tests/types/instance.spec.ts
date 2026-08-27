import { expect } from "chai";
import { Firestorm } from "../../dist/esm/instance.js";
import { Collection } from "../../dist/esm/collection.js";
import { Document } from "../../dist/esm/document.js";
import { FileManager } from "../../dist/esm/files.js";
import { ID_FIELD } from "../../dist/esm/types/utils.js";
import type { CollectionItem } from "../../dist/esm/types/utils.js";
import type { FirestormCreationOption } from "../../dist/esm/instance.js";
import type { Equal, Expect, Extends } from "./type-helpers.js";

describe("Type Tests: src/client/instance.ts", () => {
	it("Firestorm class constructor and instance properties typing", () => {
		const f = new Firestorm({
			name: "my-db",
			address: "http://127.0.0.1:8000/",
			token: "token123",
		});

		type _TFiles = Expect<Equal<Firestorm["files"], FileManager>>;
		type _TName = Expect<Equal<Firestorm["name"], string>>;
		type _TAddr = Expect<Equal<Firestorm["address"], string | undefined>>;
		type _TToken = Expect<Equal<Firestorm["token"], string | undefined>>;
		type _TClientVer = Expect<Equal<Firestorm["clientVersion"], string>>;
		type _TServerVer = Expect<Equal<Firestorm["serverVersion"], Promise<string>>>;
		type _TCompat = Expect<Equal<ReturnType<Firestorm["isCompatibleAddress"]>, Promise<boolean>>>;

		expect(f.files).to.be.an.instanceOf(FileManager);
		expect(f.name).to.equal("my-db");
		expect(f.address).to.equal("http://127.0.0.1:8000/");
		expect(f.token).to.equal("token123");
	});

	it("collection() creates typed Collection instance with defaults and custom methods", () => {
		const f = new Firestorm();
		type User = { name: string; age: number };

		// Default Collection
		const col1 = f.collection<User>({ name: "users" });
		type _TCol1 = Expect<Equal<typeof col1, Collection<User, CollectionItem<User>>>>;
		expect(col1).to.be.an.instanceOf(Collection);

		// Collection with custom transform
		interface UserMethods {
			id: string | number;
			name: string;
			age: number;
			getUpperName(): string;
		}
		const col2 = f.collection<User, UserMethods>({
			name: "users",
			transform: (el) => ({
				id: el[ID_FIELD],
				name: el.name,
				age: el.age,
				getUpperName: () => el.name.toUpperCase(),
			}),
		});
		type _TCol2 = Expect<Equal<typeof col2, Collection<User, UserMethods>>>;
		expect(col2).to.be.an.instanceOf(Collection);

		expect(() => {
			// @ts-expect-error - collection options object is required
			f.collection<User>();
		}).to.throw();
	});

	it("document() creates typed Document instance with defaults and custom methods", () => {
		const f = new Firestorm();
		type Config = { theme: string; version: number };

		const doc1 = f.document<Config>({ name: "settings" });
		type _TDoc1 = Expect<Equal<typeof doc1, Document<Config, Config>>>;
		expect(doc1).to.be.an.instanceOf(Document);

		interface ConfigMethods {
			isDark(): boolean;
		}
		const doc2 = f.document<Config, Config & ConfigMethods>({
			name: "settings",
			transform: (c) => ({
				...c,
				isDark: () => c.theme === "dark",
			}),
		});
		type _TDoc2 = Expect<Equal<typeof doc2, Document<Config, Config & ConfigMethods>>>;
		expect(doc2).to.be.an.instanceOf(Document);

		expect(() => {
			// @ts-expect-error - document options is required
			f.document<Config>();
		}).to.throw();
	});

	it("FirestormCreationOption type checking", () => {
		const valid: FirestormCreationOption = {
			name: "db",
			address: "http://localhost",
			token: "tok",
		};
		type _TValid = Expect<Extends<typeof valid, FirestormCreationOption>>;

		// @ts-expect-error - name must be string
		const _invalid1: FirestormCreationOption = { name: 123 };

		// @ts-expect-error - address must be string
		const _invalid2: FirestormCreationOption = { address: true };

		// @ts-expect-error - token must be string
		const _invalid3: FirestormCreationOption = { token: [] };
	});
});
