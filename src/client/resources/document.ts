import { ResourceManager } from "../managers/resource.ts";

import type { Firestorm } from "../instance.ts";
import type { DocumentEditFieldOption } from "../types/editFieldOption.ts";
import type { Confirmation, Path, PathValue } from "../types/utils.ts";
import type { ResourceLike } from "../utils.ts";

/**
 * Configuration options for creating a Document resource.
 */
export interface DocumentOptions<
	Raw extends Record<string, unknown> = Record<string, unknown>,
	Transformed = Raw,
> {
	/** Name of the document stored in Firestorm */
	name: string;
	/** Optional transformation function applied to document content when retrieved */
	transform?: (el: Raw, document: Document<Raw, Transformed>) => Transformed;
}

/**
 * Represents a Firestorm Document resource with a Raw (pre-transform) -> Transformed (post-transform) architecture.
 * @template Raw - Type of the document content on server (write type).
 * @template Transformed - Type of the transformed document returned by queries (read type).
 */
export class Document<
	Raw extends Record<string, unknown> = Record<string, unknown>,
	Transformed = Raw,
> implements ResourceLike {
	protected readonly manager: ResourceManager;
	private readonly transformFn: (el: Raw, document: Document<Raw, Transformed>) => Transformed;

	/**
	 * @param instance - Root Firestorm instance
	 * @param options - Configuration options (name, transform)
	 */
	constructor(instance: Firestorm, options: DocumentOptions<Raw, Transformed>) {
		if (typeof options !== "object" || options === null) {
			throw new TypeError("Document options must be an object");
		}
		const name = options.name;
		if (!name) {
			throw new Error("Document must have a name");
		}
		this.manager = new ResourceManager(instance, name);
		if (options.transform !== undefined && typeof options.transform !== "function") {
			throw new TypeError("Document transform must be a function");
		}

		this.transformFn = options.transform ?? ((el) => el as unknown as Transformed);
	}

	/**
	 * Access the root Firestorm instance.
	 */
	public get instance(): Firestorm {
		return this.manager.instance;
	}

	/**
	 * Name of the document resource.
	 */
	public get name(): string {
		return this.manager.resourceName;
	}

	/**
	 * Returns the SHA-1 hash of the JSON.
	 * - Can be used to compare file content without downloading the file.
	 *
	 * @returns The SHA-1 hash of the JSON.
	 */
	public sha1(): Promise<string> {
		return this.manager.get<string>({ path: "sha1", options: { objectLike: false } });
	}

	/**
	 * Fluent helper to transform document content into another representation.
	 * @template NextTransformed - Type of the transformed document.
	 * @param transformFn - Transformation function.
	 * @returns A new Document instance with the updated Transformed type.
	 */
	public transform<NextTransformed>(
		transformFn: (el: Transformed, document: Document<Raw, Transformed>) => NextTransformed,
	): Document<Raw, NextTransformed> {
		return new Document<Raw, NextTransformed>(this.instance, {
			name: this.name,
			transform: (raw) => transformFn(this.applyTransform(raw), this),
		});
	}

	/**
	 * Apply transformation to raw document
	 */
	private applyTransform(el: Raw): Transformed {
		return this.transformFn(el, this);
	}

	/**
	 * Get a field from the document by its key.
	 * @param key - The key of the field to retrieve.
	 * @returns A Promise containing the part of Raw that matches the key.
	 */
	public get<K extends keyof Raw>(key: K): Promise<Raw[K]> {
		return this.manager.get<Raw[K]>({
			path: "get",
			params: { id: key },
			options: { objectLike: false },
		});
	}

	/**
	 * Get multiple fields from the document by their keys as an ordered array.
	 * @param keys - Array of keys to retrieve.
	 * @returns An ordered array matching the passed keys.
	 */
	public async getKeys<Keys extends (keyof Raw)[]>(
		keys: Keys,
	): Promise<{ [Index in keyof Keys]: Raw[Keys[Index]] }> {
		if (!Array.isArray(keys)) throw new TypeError("Keys must be an array");

		const res = await this.manager.get<Record<string, unknown>>({
			path: "searchKeys",
			params: { search: keys },
		});

		return keys.map((key) => res[String(key)]) as {
			[Index in keyof Keys]: Raw[Keys[Index]];
		};
	}

	/**
	 * Read the raw content of the document and apply transformation.
	 * @returns The transformed document content.
	 */
	public async readRaw(): Promise<Transformed> {
		const res = await this.manager.get<Raw>({
			path: "readRaw",
			options: { objectLike: false },
		});
		return this.applyTransform(res);
	}

	/**
	 * Set the entire content of the document.
	 * @param value - The value to write
	 * @returns Mutation confirmation
	 */
	public writeRaw(value: Raw): Promise<Confirmation> {
		if (value === undefined || value === null)
			throw new TypeError("writeRaw value cannot be undefined or null");

		return this.manager.post<Confirmation>({
			path: "writeRaw",
			body: value,
		});
	}

	/**
	 * Set a field or deep path in the document.
	 * @param key - The field key or dot-separated path to set
	 * @param value - The value to set
	 * @returns Mutation confirmation
	 */
	public set<P extends Path<Raw>>(key: P, value: PathValue<Raw, P>): Promise<Confirmation>;
	public set(key: string, value: unknown): Promise<Confirmation> {
		if (typeof key !== "string" || key.trim() === "") {
			throw new TypeError("Document set key must be a non-empty string");
		}
		if (key.includes(".")) {
			return this.editField({
				field: key,
				operation: "set",
				value,
			});
		}
		return this.manager.put<Confirmation>({
			path: "set",
			body: value,
			options: {
				multiple: false,
				additionalData: { key: String(key) },
			},
		});
	}

	/**
	 * Edit a field in the document.
	 * @param option - The edit option object.
	 * @returns Mutation confirmation.
	 */
	public editField(option: DocumentEditFieldOption<Raw>): Promise<Confirmation> {
		return this.manager.patch<Confirmation>({
			path: "editField",
			body: option,
			options: { multiple: false },
		});
	}

	/**
	 * Edit multiple fields in the document.
	 * @param options - Array of edit option objects.
	 * @returns Mutation confirmation.
	 */
	public editFieldBulk(options: DocumentEditFieldOption<Raw>[]): Promise<Confirmation> {
		return this.manager.patch<Confirmation>({
			path: "editFieldBulk",
			body: options,
			options: { multiple: true },
		});
	}
}
