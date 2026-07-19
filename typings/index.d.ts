import type { FirestormFiles } from "./files.d.ts";
import type { Collection, AddMethods } from "./collection.d.ts";

export interface FirestormCreationOption {
	/** Instance name (can be helpful for debugging) */
	name?: string;
	/** Firestorm server address */
	address?: string;
	/** Firestorm write token */
	token?: string;
}

export interface Firestorm {
	/**
	 * Create a new Firestorm collection instance
	 * @param name - The name of the collection
	 * @param addMethods - Additional methods and data to add to the objects
	 * @returns The collection instance
	 */
	collection<T>(name: string, addMethods?: AddMethods<T>): Collection<T>;

	/** Name of the Firestorm instance (defaults to address) */
	name: string;

	/** Address of the Firestorm instance */
	address?: string;

	/** Writing token for the Firestorm instance */
	token?: string;

	/** Firestorm file manager */
	readonly files: FirestormFiles;

	/**	Get the current version of Firestorm */
	readonly clientVersion: string;

	/** Get the version of Firestorm used on the provided server */
	readonly serverVersion: Promise<string>;

	/**
	 * Check whether the server-side Firestorm version is compatible with the client
	 * @returns Whether the versions match
	 */
	isCompatibleAddress(): Promise<boolean>;
}

/** Value for the ID field when searching content */
export const ID_FIELD: "id";

/**
 * Change or get the current Firestorm address
 * @param value - The new Firestorm address
 * @returns The stored Firestorm address
 */
export function address(value?: string): string;

/**
 * Change or get the current Firestorm token
 * @param value - The new Firestorm write token
 * @returns The stored Firestorm write token
 */
export function token(value?: string): string;

/**
 * Create a new Firestorm collection instance
 * @param value - The name of the collection
 * @param addMethods - Additional methods and data to add to the objects
 * @returns The collection instance
 */
export function collection<T>(name: string, addMethods?: AddMethods<T>): Collection<T>;

/**
 * Create as new instance of Firestorm
 * @param params - Firestorm instance name, server address, and write token
 */
export function create(params?: FirestormCreationOption): Firestorm;

/**
 * Create a temporary Firestorm collection with no methods
 * @deprecated Use {@link collection} with no second argument instead
 * @param table - The table name to get
 * @returns The table instance
 */
export function table<T>(table: string): Collection<T>;

export type * from "./collection.d.ts";
export type * from "./files.d.ts";
export type * from "./utils.d.ts";
