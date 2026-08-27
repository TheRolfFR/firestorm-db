import { ResourceManager } from "./resource.ts";
import type { ResourceLike } from "./utils.ts";
import type { Firestorm } from "./instance.ts";
import type { DocumentEditFieldOption } from "./types/editFieldOption.ts";
import type { WriteConfirmation } from "./types/utils.ts";

/**
 * Configuration options for creating a Document resource.
 */
export interface DocumentOptions<
	Raw extends Record<string, any> = Record<string, any>,
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
	Raw extends Record<string, any> = Record<string, any>,
	Transformed = Raw,
> implements ResourceLike {
	public readonly manager: ResourceManager;
	private readonly transformFn?: (el: Raw, document: Document<Raw, Transformed>) => Transformed;

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
			throw new Error("Resource must have a name");
		}
		this.manager = new ResourceManager(instance, name);
		if (options.transform && typeof options.transform !== "function") {
			throw new TypeError("Document transform must be a function");
		}

		if (options.transform) {
			this.transformFn = options.transform;
		}
	}

	/**
	 * Access the root Firestorm instance.
	 */
	public get instance(): Firestorm {
		return this.manager.instance;
	}

	/**
	 * Name of the document collection.
	 */
	public get collectionName(): string {
		return this.manager.collectionName;
	}

	/**
	 * Read address for the document endpoint.
	 */
	public get readAddress(): string {
		return this.manager.readAddress;
	}

	/**
	 * Write address for the document endpoint.
	 */
	public get writeAddress(): string {
		return this.manager.writeAddress;
	}

	/**
	 * Returns the SHA-1 hash of the document JSON.
	 */
	public async sha1(): Promise<string> {
		return this.manager.sha1();
	}

	/**
	 * Fluent helper to transform document content into another representation.
	 * @template NextTransformed - Type of the transformed document.
	 * @param transformFn - Transformation function.
	 * @returns A new Document instance with the updated Transformed type.
	 */
	public transform<NextTransformed>(
		transformFn: (el: Transformed, document: Document<Raw, NextTransformed>) => NextTransformed,
	): Document<Raw, NextTransformed> {
		const prevTransform = this.transformFn;
		const chainedFn = (raw: Raw, doc: Document<Raw, NextTransformed>): NextTransformed => {
			const current = prevTransform
				? prevTransform(raw, this as unknown as Document<Raw, Transformed>)
				: (raw as unknown as Transformed);
			return transformFn(current, doc);
		};

		return new Document<Raw, NextTransformed>(this.instance, {
			name: this.collectionName,
			transform: chainedFn,
		});
	}

	/**
	 * Apply transformation to raw document
	 */
	private applyTransform(el: Raw): Transformed {
		if (!this.transformFn) return el as unknown as Transformed;
		return this.transformFn(el, this);
	}

	/**
	 * Get a field from the document by its key.
	 * @param key - The key of the field to retrieve.
	 * @returns A Promise containing the part of Raw that matches the key.
	 */
	public async get<K extends keyof Raw>(key: K): Promise<Raw[K]> {
		const item = await this.manager.getRequest<Raw[K]>("get", { id: key }, false);
		return item;
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

		const res = await this.manager.getRequest<Record<string, unknown>>("searchKeys", {
			search: keys,
		});

		return keys.map((key) => res[String(key)]) as unknown as {
			[Index in keyof Keys]: Raw[Keys[Index]];
		};
	}

	/**
	 * Read the raw content of the document and apply transformation.
	 * @returns The transformed document content.
	 */
	public async readRaw(): Promise<Transformed> {
		const res = await this.manager.getRequest<Raw>("readRaw", {}, false);
		return this.applyTransform(res);
	}

	/**
	 * Set the entire content of the document.
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	public async writeRaw(value: Raw): Promise<WriteConfirmation> {
		if (value === undefined || value === null)
			throw new TypeError("writeRaw value cannot be undefined or null");

		return this.manager.postRequest<WriteConfirmation>("writeRaw", value);
	}

	/**
	 * Set a field or deep path in the document.
	 * @param key - The field key or dot-separated path to set
	 * @param value - The value to set
	 * @returns Write confirmation
	 */
	public async set<K extends keyof Raw>(key: K, value: Raw[K]): Promise<WriteConfirmation>;
	public async set<P extends string>(key: P, value: unknown): Promise<WriteConfirmation>;
	public async set(key: string, value: unknown): Promise<WriteConfirmation> {
		if (typeof key !== "string" || key.trim() === "") {
			throw new TypeError("Document set key must be a non-empty string");
		}
		if (key.includes(".")) {
			return this.editField({
				field: key as any,
				operation: "set",
				value,
			});
		}
		return this.manager.postRequest<WriteConfirmation>("set", value, false, {
			key: String(key),
		});
	}

	/**
	 * Edit a field in the document.
	 * @param option - The edit option object.
	 * @returns Write confirmation.
	 */
	public async editField(option: DocumentEditFieldOption<Raw>): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("editField", option, false);
	}

	/**
	 * Edit multiple fields in the document.
	 * @param options - Array of edit option objects.
	 * @returns Write confirmation.
	 */
	public async editFieldBulk(options: DocumentEditFieldOption<Raw>[]): Promise<WriteConfirmation> {
		return this.manager.postRequest<WriteConfirmation>("editFieldBulk", options, true);
	}
}
