import type { Firestorm } from "./instance.ts";
import { requestJson, FirestormError } from "./utils.ts";
import type { WriteConfirmation } from "./types/utils.ts";

/**
 * Manages resource-level HTTP requests and encapsulates endpoint communication.
 */
export class ResourceManager {
	/**
	 * @param instance - Root Firestorm instance.
	 * @param name - Name of the resource stored in Firestorm.
	 */
	constructor(
		public readonly instance: Firestorm,
		public readonly name: string,
	) {
		if (!name) throw new Error("Resource must have a name");
	}

	/**
	 * Get the name of the resource.
	 */
	public get collectionName(): string {
		return this.name;
	}

	/**
	 * Read API endpoint address (get.php)
	 */
	public get readAddress(): string {
		const addr = this.instance.address;
		if (!addr) {
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return `${addr}get.php`;
	}

	/**
	 * Write API endpoint address (post.php)
	 */
	public get writeAddress(): string {
		const addr = this.instance.address;
		if (!addr) {
			throw new Error(`Address for Firestorm instance "${this.instance.name}" was not configured`);
		}
		return `${addr}post.php`;
	}

	/**
	 * Send read request for the resource and return extracted response.
	 * @param command - The read command name.
	 * @param params - Body data parameters.
	 * @param objectLike - Reject if an object or array isn't being returned.
	 * @returns Extracted response.
	 */
	public async getRequest<ReturnType>(
		command: string,
		params: Record<string, unknown> = {},
		objectLike = true,
	): Promise<ReturnType> {
		const obj = {
			collection: this.collectionName,
			command,
			...params,
		};

		const extracted = await requestJson<ReturnType>(this.readAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(obj),
		});

		if (objectLike && (typeof extracted !== "object" || extracted === null)) {
			// PHP may output raw strings or HTML error notices on unexpected server failures.
			// Wrapping in FirestormError prevents obscure runtime TypeErrors when callers expect an object.
			throw new FirestormError(
				typeof extracted === "string" ? extracted : "Unexpected non-object response from server",
			);
		}
		return extracted;
	}

	/**
	 * Send write request for the resource and return extracted response.
	 * @param command - The write command name.
	 * @param value - The value for the command.
	 * @param multiple - Used for bulk operations.
	 * @param additionalData - Additional payload fields.
	 * @returns Extracted response.
	 */
	public async postRequest<ReturnType = WriteConfirmation>(
		command: string,
		value: unknown = undefined,
		multiple: boolean | null = false,
		additionalData: Record<string, unknown> = {},
	): Promise<ReturnType> {
		const data: Record<string, unknown> = {
			token: this.instance.token,
			collection: this.collectionName,
			command,
			...additionalData,
		};

		if (value !== undefined) {
			const serialized = JSON.parse(JSON.stringify(value));
			if (multiple) data.values = serialized;
			else data.value = serialized;
		}

		return requestJson<ReturnType>(this.writeAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(data),
		});
	}

	/**
	 * Returns the SHA-1 hash of the JSON.
	 * - Can be used to compare file content without downloading the file.
	 *
	 * @returns The SHA-1 hash of the JSON.
	 */
	public async sha1(): Promise<string> {
		return this.getRequest<string>("sha1", {}, false);
	}
}
