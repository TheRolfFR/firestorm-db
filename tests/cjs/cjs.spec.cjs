const { expect } = require("chai");
const FirestormCJS = require("../../dist/cjs/index.js");
const utilsCJS = require("../../dist/cjs/utils.js");
const { runSetupSuite } = require("../matrix/setup.suite.js");
const { runCollectionSuite } = require("../matrix/collection.suite.js");
const { runDocumentSuite } = require("../matrix/document.suite.js");
const { runFilesSuite } = require("../matrix/files.suite.js");

const target = {
	name: "CJS",
	isBrowser: false,
	createFirestorm: FirestormCJS.createFirestorm,
	Firestorm: FirestormCJS.Firestorm,
	Collection: FirestormCJS.Collection,
	Document: FirestormCJS.Document,
	FileManager: FirestormCJS.FileManager,
	ResourceManager: FirestormCJS.ResourceManager,
	ID_FIELD: FirestormCJS.ID_FIELD,
};

describe("CommonJS (CJS) Matrix & Module Interop Suite", () => {
	describe("Module Exports & Subpath Resolution", () => {
		it("exports all top-level constructors, functions, and constants via require()", () => {
			expect(FirestormCJS.createFirestorm).to.be.a("function");
			expect(FirestormCJS.Firestorm).to.be.a("function");
			expect(FirestormCJS.Collection).to.be.a("function");
			expect(FirestormCJS.Document).to.be.a("function");
			expect(FirestormCJS.FileManager).to.be.a("function");
			expect(FirestormCJS.ResourceManager).to.be.a("function");
			expect(FirestormCJS.FirestormError).to.be.a("function");
			expect(typeof FirestormCJS.ID_FIELD).to.equal("symbol");
			expect(FirestormCJS.ID_FIELD).to.equal(Symbol.for("firestorm.id"));
		});

		it("allows requiring individual subpath modules", () => {
			const collectionModule = require("../../dist/cjs/collection.js");
			const documentModule = require("../../dist/cjs/document.js");
			const filesModule = require("../../dist/cjs/files.js");
			const instanceModule = require("../../dist/cjs/instance.js");
			const resourceModule = require("../../dist/cjs/resource.js");
			const utilsModule = require("../../dist/cjs/utils.js");

			expect(collectionModule.Collection).to.be.a("function");
			expect(documentModule.Document).to.be.a("function");
			expect(filesModule.FileManager).to.be.a("function");
			expect(instanceModule.Firestorm).to.be.a("function");
			expect(instanceModule.createFirestorm).to.be.a("function");
			expect(resourceModule.ResourceManager).to.be.a("function");
			expect(utilsModule.requestJson).to.be.a("function");
			expect(utilsModule.FirestormError).to.be.a("function");
		});
	});

	runSetupSuite(target);
	runCollectionSuite(target);
	runDocumentSuite(target);
	runFilesSuite(target);
});
