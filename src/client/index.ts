import { Firestorm } from "./instance.ts";
import { ID_FIELD } from "./types/utils.ts";

import type { FirestormCreationOption } from "./instance.ts";

/**
 * Create a new instance of Firestorm
 *
 * @param params - Firestorm instance configuration options (name, address, token)
 * @returns New Firestorm instance
 */
export const createFirestorm = (params: FirestormCreationOption = {}): Firestorm =>
	new Firestorm(params);

export { ID_FIELD };
export { VERSION } from "./version.ts";
export { Firestorm } from "./instance.ts";
export { Collection } from "./resources/collection.ts";
export { Document } from "./resources/document.ts";
export { FileManager } from "./managers/files.ts";
export { ResourceManager } from "./managers/resource.ts";
export { FirestormError } from "./utils.ts";

export type * from "./types/editFieldOption.ts";
export type * from "./types/searchOption.ts";
export type * from "./types/selectOption.ts";
export type * from "./types/utils.ts";
export type * from "./types/valueOption.ts";

export type * from "./managers/resource.ts";
export type * from "./resources/document.ts";
export type * from "./resources/collection.ts";
export type * from "./managers/files.ts";
export type * from "./instance.ts";
export type * from "./utils.ts";
