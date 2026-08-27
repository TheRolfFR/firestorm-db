import path from "path";
import fs from "fs";

export const PORT = process.env.PORT || "8000";
export const ADDRESS = `http://127.0.0.1:${PORT}/`;
export const TOKEN = "NeverGonnaGiveYouUp";

export const ensureServerRunning = async () => {
	try {
		await fetch(ADDRESS);
	} catch {
		const { execSync } = await import("child_process");
		execSync("node tests/php/php_setup.mjs", { stdio: "inherit" });
	}
};

export const DATABASE_NAME = "base";
export const DATABASE_FILE = path.join(process.cwd(), "tests", "files", "base.json");

export const HOUSE_DATABASE_NAME = "house";
export const HOUSE_DATABASE_FILE = path.join(
	process.cwd(),
	"tests",
	"files",
	`${HOUSE_DATABASE_NAME}.json`,
);

export type BaseItem = {
	id?: string;
	name: string;
	age: number;
	amazing: boolean;
	qualities: string[];
	friends: string[];
	path?: {
		to?: {
			key?: string;
		};
	};
};

export type HouseItem = {
	id?: string;
	name: string;
	outdoor: boolean;
	furniture: string[];
};

export type DocContent = {
	theme: string;
	version: number;
	active?: boolean;
	features?: string[];
};

export interface TestTarget {
	name: string;
	createFirestorm: typeof import("../../dist/esm/index.js").createFirestorm;
	Firestorm: typeof import("../../dist/esm/index.js").Firestorm;
	Collection: typeof import("../../dist/esm/index.js").Collection;
	Document: typeof import("../../dist/esm/index.js").Document;
	FileManager: typeof import("../../dist/esm/index.js").FileManager;
	ResourceManager: typeof import("../../dist/esm/index.js").ResourceManager;
	ID_FIELD: typeof import("../../dist/esm/index.js").ID_FIELD;
	colPostRequest?: any;
	colGetRequest?: any;
	documentPostRequest?: any;
	documentGetRequest?: any;
	isBrowser?: boolean;
}

export function createTestEnv(target: TestTarget) {
	const instance = target.createFirestorm({ address: ADDRESS, token: TOKEN });
	let base = instance.collection<BaseItem>({ name: DATABASE_NAME });
	let houseCollection = instance.collection<HouseItem>({ name: HOUSE_DATABASE_NAME });
	let testDoc = instance.document<DocContent>({ name: "settings" });

	const resetDatabaseContent = async () => {
		const rawBase = JSON.parse(fs.readFileSync(DATABASE_FILE, "utf-8"));
		await base.writeRaw(rawBase);

		houseCollection = instance.collection<HouseItem>({ name: HOUSE_DATABASE_NAME });
		const rawHouse = JSON.parse(fs.readFileSync(HOUSE_DATABASE_FILE, "utf-8"));
		await houseCollection.writeRaw(rawHouse);

		testDoc = instance.document<DocContent>({ name: "settings" });
		await testDoc.writeRaw({
			theme: "dark",
			version: 1,
			active: true,
			features: ["a", "b"],
		});
	};

	return {
		instance,
		get base() {
			return base;
		},
		get houseCollection() {
			return houseCollection;
		},
		get testDoc() {
			return testDoc;
		},
		resetDatabaseContent,
	};
}
