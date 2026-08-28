import { FileManager } from "./managers/files.ts";
import { Collection } from "./resources/collection.ts";
import { Document } from "./resources/document.ts";
import { requestJson } from "./utils.ts";
import { VERSION } from "./version.ts";

import type { CollectionOptions } from "./resources/collection.ts";
import type { DocumentOptions } from "./resources/document.ts";
import type { CollectionItem } from "./types/utils.ts";

export interface FirestormCreationOption {
	/** Instance name */
	name?: string;
	/** Firestorm server address */
	address?: string;
	/** Firestorm write token */
	token?: string;
}

/**
 * Represents a Firestorm-powered server and its collections, documents, tokens, and setup
 */
export class Firestorm {
	private _name?: string;
	private _address?: string;
	public token?: string;
	public readonly files: FileManager;

	/**
	 * Creates a new Firestorm server instance
	 * @param params - Optional parameters to pass into the constructor.
	 */
	constructor(params: FirestormCreationOption = {}) {
		if (params.name) this.name = params.name;
		if (params.address) {
			this.address = params.address;
			// check that address ends with a slash
			if (!this.address.endsWith("/")) this.address += "/";
		}
		this.token = params.token;
		this.files = new FileManager(this);
	}

	/**
	 * Create a new Firestorm collection instance
	 * @template Raw - Type of the documents in the collection (write type).
	 * @template Transformed - Type of the transformed elements returned by queries (read type).
	 *
	 * @param options - Collection configuration options object
	 * @returns The Collection instance
	 */
	public collection<
		Raw extends Record<string, unknown> = Record<string, unknown>,
		Transformed = CollectionItem<Raw>,
	>(options: CollectionOptions<Raw, Transformed>): Collection<Raw, Transformed> {
		return new Collection<Raw, Transformed>(this, options);
	}

	/**
	 * Create a new Firestorm document instance
	 * @template Raw - Type of the content in the document (write type).
	 * @template Transformed - Type of the transformed document returned by queries (read type).
	 *
	 * @param options - Document configuration options object
	 * @returns The Document instance
	 */
	public document<Raw extends Record<string, unknown> = Record<string, unknown>, Transformed = Raw>(
		options: DocumentOptions<Raw, Transformed>,
	): Document<Raw, Transformed> {
		return new Document<Raw, Transformed>(this, options);
	}

	/**
	 * Get the instance debugging name
	 */
	public get name(): string {
		return this._name || this.address || "";
	}

	/**
	 * Set the instance debugging name
	 */
	public set name(newValue: string | undefined) {
		this._name = newValue === undefined ? undefined : String(newValue);
	}

	/**
	 * Get the configured server address
	 */
	public get address(): string | undefined {
		return this._address;
	}

	/**
	 * Set the server address
	 */
	public set address(newValue: string | undefined) {
		if (newValue && !newValue.endsWith("/")) {
			newValue += "/";
		}
		this._address = newValue;
	}

	/**
	 * Get the client package version
	 */
	public get clientVersion(): string {
		return VERSION;
	}

	/**
	 * Get the server-side version string
	 */
	public get serverVersion(): Promise<string> {
		if (!this.address) {
			throw new Error(`Address for Firestorm instance "${this.name}" was not configured`);
		}
		return requestJson<string>(`${this.address}version.php`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				token: this.token,
			}),
		});
	}

	/**
	 * Check if the server version is compatible with the client version
	 * @returns True if compatible, false otherwise
	 */
	public async isCompatibleAddress(): Promise<boolean> {
		const serverVersion = await this.serverVersion;
		const [serverMajor, serverMinor] = serverVersion.split(".");
		const [clientMajor, clientMinor] = this.clientVersion.split(".");

		if (!serverMajor || !serverMinor || !clientMajor || !clientMinor) {
			return false;
		}

		return serverMajor === clientMajor && Number(serverMinor) >= Number(clientMinor);
	}
}

/**
 * Creates a new Firestorm server instance
 *
 * @param params - Firestorm instance configuration options (name, address, token)
 * @returns New Firestorm instance
 */
export const createFirestorm = (params: FirestormCreationOption = {}): Firestorm =>
	new Firestorm(params);
