// @ts-check

import path from "path";
import fs from "fs";

import firestorm from "../src/index.js";

export const PORT = process.env.PORT || "8000";
export const ADDRESS = `http://127.0.0.1:${PORT}/`;
export const TOKEN = "NeverGonnaGiveYouUp";

export const DATABASE_NAME = "base";
export const DATABASE_FILE = path.join(process.cwd(), "tests", "files", "base.json");

export const HOUSE_DATABASE_NAME = "house";
export const HOUSE_DATABASE_FILE = path.join(
	process.cwd(),
	"tests",
	"files",
	`${HOUSE_DATABASE_NAME}.json`,
);

export let base = firestorm.collection(DATABASE_NAME);
export let houseCollection = firestorm.collection(HOUSE_DATABASE_NAME);

export const rawContent = fs.readFileSync(DATABASE_FILE).toString();
export const content = JSON.parse(rawContent);

export const resetDatabaseContent = async () => {
	// reset the content of the database
	await base.writeRaw(content).catch((err) => console.error(err));

	houseCollection = firestorm.collection(HOUSE_DATABASE_NAME);
	const rawHouse = JSON.parse(fs.readFileSync(HOUSE_DATABASE_FILE).toString());
	await houseCollection.writeRaw(rawHouse);
};
