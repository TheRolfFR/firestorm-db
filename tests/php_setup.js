const { mkdtemp, mkdir, symlink, unlink } = require("fs").promises;
const { existsSync } = require("fs");
const { join, relative, dirname, basename } = require("path");
const { tmpdir } = require("os");
const { glob } = require("glob");
const copy = require("recursive-copy");
const { execSync, spawn } = require("child_process");

const PHP_PATH = "php";
const PHP_SERVER_START_DELAY = 2000;
const PORT = 8000;

console.log("Setup of PHP files...");
console.log("Creating tmp folder...");

async function setup_php() {
	// create tmp folder for PHP
	execSync("rm -rf /tmp/php-*");

	const tmpFolder = await mkdtemp(join(tmpdir(), "php-"));
	console.log(`Created ${tmpFolder}`);

	console.log(
		"Moving PHP folder + Checking test php files + Creating files folder + Checking test databases...",
	);
	const [phpPaths, jsonPaths] = await Promise.all([
		glob(join(process.cwd(), PHP_PATH, "**/*.php")),
		glob(join(process.cwd(), "tests", "*.json")),
		mkdir(join(tmpFolder, "files")),
	]);

	const phpSymlinkProms = phpPaths.map(async (from) => {
		const endPath = relative(join(process.cwd(), PHP_PATH), from);
		const to = join(tmpFolder, endPath);
		console.log(`Linking ${endPath}...`);

		await mkdir(dirname(to), { recursive: true });
		const res = await symlink(from, to, "file");
		console.log(`Linked ${endPath}`);
		return res;
	});

	console.log("Copying test databases...");

	const jsonCopyProms = jsonPaths.map((from) => {
		const filename = basename(from);
		console.log(`Copying ${filename}...`);
		const to = join(tmpFolder, "files", filename);
		return copy(from, to).then((res) => {
			console.log(`Copied ${filename}`);
			return res;
		});
	});

	const phpTestPaths = await glob(join(process.cwd(), "tests", "*.php"));

	await Promise.all([...phpSymlinkProms, ...jsonCopyProms]);

	console.log("Copying test PHP config files...");

	await Promise.all(
		phpTestPaths.map(async (from) => {
			const filename = basename(from);
			const to = join(tmpFolder, filename);
			console.log(`Linking test ${filename}...`);

			if (existsSync(to)) await unlink(to);
			const res = await symlink(from, to, "file");
			console.log(`Linked ${filename}`);
			return res;
		}),
	);

	const phpCommand = `sh tests/php_server_start.sh ${tmpFolder} ${PORT}`;
	console.log('Starting php server with command "' + phpCommand + '"...');
	const args = phpCommand.split(" ");
	const command = args.shift();

	spawn(command, args, { stdio: "ignore", detached: true }).unref();

	console.log(`Waiting ${PHP_SERVER_START_DELAY}ms for the server to start...`);
	return pause(PHP_SERVER_START_DELAY);
}

setup_php().catch((err) => {
	console.error("Terrible error happened");
	console.trace(err);
	process.exit(1);
});

/**
 * Promise-based implementation of setTimeout
 * @param {Number} ms Timeout in ms
 * @returns {Promise<any>}
 */
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
