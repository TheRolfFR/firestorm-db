import * as FirestormESM from "../../dist/esm/index.js";
import * as utils from "../../dist/esm/utils.js";
import { runCollectionSuite } from "../matrix/collection.suite.js";
import { runDocumentSuite } from "../matrix/document.suite.js";
import { runFilesSuite } from "../matrix/files.suite.js";
import { runSetupSuite } from "../matrix/setup.suite.js";
import { TestTarget } from "../matrix/test-target.js";

const target: TestTarget = {
	name: "ESM",
	isBrowser: false,
	createFirestorm: FirestormESM.createFirestorm,
	Firestorm: FirestormESM.Firestorm,
	Collection: FirestormESM.Collection,
	Document: FirestormESM.Document,
	FileManager: FirestormESM.FileManager,
	ResourceManager: FirestormESM.ResourceManager,
	ID_FIELD: FirestormESM.ID_FIELD,
};

describe("ESM (ECMAScript Modules) Matrix Suite", () => {
	runSetupSuite(target);
	runCollectionSuite(target);
	runDocumentSuite(target);
	runFilesSuite(target);
});
