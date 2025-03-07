const { expect } = require("chai");

const firestorm = require("..");

const crypto = require("crypto");

const PORT = process.env.PORT || "8000";
const ADDRESS = `http://127.0.0.1:${PORT}/`;
const TOKEN = "NeverGonnaGiveYouUp";

const HOUSE_DATABASE_NAME = "house";
const HOUSE_DATABASE_FILE = path.join(
	process.cwd(),
	"tests",
	"files",
	`${HOUSE_DATABASE_NAME}.json`,
);

const DATABASE_NAME = "base";
const DATABASE_FILE = path.join(process.cwd(), "tests", "files", "base.json");

console.log("Testing at address " + ADDRESS + " with token " + TOKEN);

let houseCollection; // = undefined
/** @type {firestorm.Collection} */
let base; // = undefined
let content;
let tmp;

const resetDatabaseContent = async () => {
	// reset the content of the database
	await base.writeRaw(content).catch((err) => console.error(err));

	houseCollection = firestorm.collection(HOUSE_DATABASE_NAME);
	const rawHouse = JSON.parse(fs.readFileSync(HOUSE_DATABASE_FILE).toString());
	await houseCollection.writeRaw(rawHouse);
};
