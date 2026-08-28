import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
if (!pkg.version || typeof pkg.version !== "string") {
	throw new Error("package.json does not contain a valid 'version' field");
}
const version = pkg.version;

// 1. Generate client version module
writeFileSync(
	"src/client/version.ts",
	`// Auto-generated during build from package.json\nexport const VERSION = "${version}";\n`,
);

// 2. Generate server version ini
writeFileSync("src/server/version.ini", `${version}\n`);

console.log(
	`[firestorm] Synchronized version ${version} to src/client/version.ts and src/server/version.ini`,
);
