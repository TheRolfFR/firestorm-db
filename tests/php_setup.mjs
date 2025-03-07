// @ts-check

import { promises } from "fs";
import { existsSync } from "fs";
import { join, relative, dirname, basename } from "path";
import { tmpdir } from "os";
import { glob } from "glob";
import copy from "recursive-copy";
import { execSync, spawn } from "child_process";
import { consola } from "consola";
import { platform } from "os";

const { mkdtemp, mkdir, symlink, unlink } = promises;

const PHP_PATH = "php";
const PHP_SERVER_START_DELAY = 2000;
const PORT = 8000;

consola.info(" Setup of PHP files...");
consola.info(" Creating tmp folder...");

async function setup_php() {
	// delete previous temporary files
	execSync("rm -rf /tmp/php-*");

	const tmpFolder = await mkdtemp(join(tmpdir(), "php-"));
	consola.success(` Created ${tmpFolder}`);

	consola.info(" Get PHP source files, get tests data files, creating temp directory...");
	const [phpPaths, jsonPaths] = await Promise.all([
		glob(join(process.cwd(), PHP_PATH, "**/*.php")),
		glob(join(process.cwd(), "tests", "files", "*.json")),
		mkdir(join(tmpFolder, "files")),
	]);

	const phpSymlinkProms = phpPaths.map(async (from) => {
		const endPath = relative(join(process.cwd(), PHP_PATH), from);
		const to = join(tmpFolder, endPath);
		consola.info(` Linking ${endPath}...`);

		await mkdir(dirname(to), { recursive: true });
		const res = await symlink(from, to, "file");
		consola.success(` Linked ${endPath}`);
		return res;
	});

	consola.info(" Copying test databases...");

	const jsonCopyProms = jsonPaths.map((from) => {
		const filename = basename(from);
		consola.info(` Copying ${filename}...`);
		const to = join(tmpFolder, "files", filename);

		return copy(from, to).then((res) => {
			consola.success(` Copied ${filename}`);
			return res;
		});
	});

	const phpTestPaths = await glob(join(process.cwd(), "tests", "php", "*.php"));

	await Promise.all([...phpSymlinkProms, ...jsonCopyProms]);

	consola.info(" Copying PHP test config & token files...");

	await Promise.all(
		phpTestPaths.map(async (from) => {
			const filename = basename(from);
			const to = join(tmpFolder, filename);
			consola.info(` Linking test ${filename}...`);

			if (existsSync(to)) await unlink(to);
			const res = await symlink(from, to, "file");
			consola.success(` Linked ${filename}`);
			return res;
		}),
	);

	const phpCommand = `sh tests/php_server_start.sh ${tmpFolder} ${PORT}`;
	consola.info(' Starting php server with command "' + phpCommand + '"...');

	const args = phpCommand.split(" ");
	const command = args.shift() ?? "";
	spawn(command, args, { stdio: "ignore", detached: true }).unref();

	consola.info(` Waiting ${PHP_SERVER_START_DELAY}ms for the server to start...`);
	return pause(PHP_SERVER_START_DELAY).then(() =>
		fetch(`http://localhost:${PORT}`)
			.then(() => consola.success(" PHP server started successfully"))
			.catch((err) => consola.error(" PHP server failed to start")),
	);
}

if (platform() === "win32")
	consola.error("This script is built for Unix systems only, if you are on Windows, use WSL");
else
	setup_php().catch((err) => {
		consola.error("Terrible error happened");
		consola.trace(err);
		process.exit(1);
	});

/**
 * Promise-based implementation of setTimeout
 * @param {Number} ms Timeout in ms
 * @returns {Promise<any>}
 */
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
