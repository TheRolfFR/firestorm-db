import * as FirestormESM from "../../dist/esm/index.js";
import * as utils from "../../dist/esm/utils.js";
import { runSetupSuite } from "../matrix/setup.suite.js";
import { runCollectionSuite } from "../matrix/collection.suite.js";
import { runDocumentSuite } from "../matrix/document.suite.js";
import { runFilesSuite } from "../matrix/files.suite.js";
import { TestTarget, ADDRESS } from "../matrix/test-target.js";

describe("Browser Environment Usage & 1:1 Web APIs Matrix Suite", function () {
	let originalWindow: typeof globalThis.window;
	let originalDocument: typeof globalThis.document;

	before(function () {
		originalWindow = (globalThis as any).window;
		originalDocument = (globalThis as any).document;

		(globalThis as any).window = {
			location: { href: ADDRESS, origin: ADDRESS },
			navigator: { userAgent: "FirestormBrowser/1.0" },
			fetch: globalThis.fetch,
			Headers: globalThis.Headers,
			FormData: globalThis.FormData,
			Blob: globalThis.Blob,
			File: globalThis.File,
			URL: globalThis.URL,
		};
		(globalThis as any).document = {
			createElement: () => ({}),
			querySelector: () => null,
		};
	});

	after(() => {
		(globalThis as any).window = originalWindow;
		(globalThis as any).document = originalDocument;
	});

	const target: TestTarget = {
		name: "Browser",
		isBrowser: true,
		createFirestorm: FirestormESM.createFirestorm,
		Firestorm: FirestormESM.Firestorm,
		Collection: FirestormESM.Collection,
		Document: FirestormESM.Document,
		FileManager: FirestormESM.FileManager,
		ResourceManager: FirestormESM.ResourceManager,
		ID_FIELD: FirestormESM.ID_FIELD,
		colPostRequest: utils.colPostRequest,
		colGetRequest: utils.colGetRequest,
		documentPostRequest: utils.documentPostRequest,
		documentGetRequest: utils.documentGetRequest,
	};

	runSetupSuite(target);
	runCollectionSuite(target);
	runDocumentSuite(target);
	runFilesSuite(target);
});
