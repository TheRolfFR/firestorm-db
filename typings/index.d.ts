import * as NodeFormData from "form-data";

export type NumberCriteria =
	| "==" /** Value is equal to the provided value */
	| "!=" /** Value is not equal to the provided value */
	| "<" /** Value is less than the provided value */
	| "<=" /** Value is less than or equal to the provided value */
	| ">" /** Value is greater than the provided value */
	| ">=" /** Value is greater than or equal to the provided value */
	| "in"; /** Value is in the given array */

export type StringCriteria =
	| "==" /** String value is equal to the provided value */
	| "!=" /** String value is not equal to the provided value */
	| "<" /** String value length is less than the provided value */
	| "<=" /** String value length is less than or equal to the provided value */
	| ">" /** String value length is greater than the provided value */
	| ">=" /** String value length is greater than or equal to the provided value */
	| "in" /** String value is in the given array */
	| "includes" /** String value includes the provided value */
	| "contains" /** Same as "includes" */
	| "startsWith" /** String value starts with the provided value */
	| "endsWith"; /** String value ends with the provided value */

export type ArrayCriteria =
	| "array-contains" /** Value is in the given array */
	| "array-contains-none" /** No value of the array is in the given array */
	| "array-contains-any" /** Any value of the array is in the given array */
	| "array-length-eq" /** Array length is equal to the provided value */
	| "array-length-df" /** Array length is different from the provided value */
	| "array-length-gt" /** Array length is greater than the provided value */
	| "array-length-lt" /** Array length is less than the provided value */
	| "array-length-ge" /** Array length is greater than or equal to the provided value */
	| "array-length-le"; /** Array length is less than or equal to the provided value */

export type BooleanCriteria =
	| "!=" /** Value is not equal to the provided value */
	| "=="; /** Value is equal to the provided value */

export type AnyCriteria = StringCriteria | ArrayCriteria | BooleanCriteria | NumberCriteria;

export type Criteria<T> = T extends Function
	? never
	:
				| never /** Methods are not allowed in the field (they are not saved in the collection JSON file) */
				| T extends Array<unknown>
		? ArrayCriteria
		: never | T extends string
			? StringCriteria
			: never | T extends number
				? NumberCriteria
				: never | T extends boolean
					? BooleanCriteria
					: never;

export type AnyOperation =
	| "set" /** @param value - set the field to the given value */
	| "remove" /** @param value - remove the field */;

export type StringOperation = "append" /** @param value - append the given value to the field */;

export type NumberOperation =
	| "increment" /** @param value - increment the field by the given value, or by one */
	| "decrement" /** @param value - decrement the field by the given value, or by one */;

export type ArrayOperation =
	| "array-push" /** @param value - push the given value to the field */
	| "array-delete" /** @param index - delete the value at the given index @see https://www.php.net/manual/fr/function.array-splice */
	| "array-splice" /** @param indexes - remove certain elements of the array field @see https://www.php.net/manual/fr/function.array-splice */;

type _Operation<T> = T extends string
	? StringOperation
	: never | T extends number
		? NumberOperation
		: never | T extends Array<unknown>
			? ArrayOperation
			: never | T extends object | Function
				? never
				: never;

export type Operation<T> =
	| {
			[K in keyof T]: _Operation<T[K]>;
	  }[keyof T]
	| AnyOperation;

type BaseEditField<T> = {
	[K in keyof T]: {
		id: number | string;
	};
}[keyof T];

type Field<P, T> = {
	[K in keyof T]: T[K] extends P ? K : never;
}[keyof T];

export type EditFieldOption<T> = {
	[K in keyof T]: BaseEditField<T> &
		(
			| {
					field: K | string;
					operation: "remove" | "append";
			  }
			| {
					field: Field<boolean, T>;
					operation: "invert";
			  }
			| {
					field: Field<number, T>;
					operation: "increment" | "decrement";
					value?: Number;
			  }
			| {
					field: Field<T[K], T> | string;
					operation: "set";
					value: T[K] | any;
			  }
			| {
					field: Field<Array<unknown>, T>;
					operation: "array-push";
					value: T[K];
			  }
			| {
					field: Field<Array<unknown>, T>;
					operation: "array-delete";
					value: number;
			  }
			| {
					field: Field<Array<unknown>, T>;
					operation: "array-splice";
					value: [number, number] | [number, number, T[Field<Array<unknown>, T>][any]];
			  }
		);
}[keyof T];

/** Write status */
export type WriteConfirmation = { message: string };

export type SearchOption<T> = {
	[K in keyof T]: {
		/** The field to be searched for */
		field: Path<T>;
		/** Search criteria to filter results */
		criteria: Criteria<T[K]>;
		/** The value to be searched for */
		value?: any;
		/** Is it case sensitive? (default true) */
		ignoreCase?: boolean;
	};
}[keyof T];

export interface SelectOption<T extends any[]> {
	/** Selected fields to be returned */
	fields: T;
}

export interface ValueOption<K, F extends boolean> {
	/** Field to search */
	field: K | "id";
	/** Flatten array fields? (default false) */
	flatten?: F;
}

/** Add methods to found elements */
export type CollectionMethods<T> = (collectionElement: T) => T;

/** Remove methods from a type */
export type RemoveMethods<T> = Pick<
	T,
	{
		[K in keyof T]: T[K] extends Function ? never : K;
	}[keyof T]
>;

/** ID field not known at add time */
export type Addable<T> = Omit<RemoveMethods<T>, "id">;
/** ID field known at add time */
export type Settable<T> = Addable<T> & {
	id?: number | string;
};

/**
 * Represents a Firestorm Collection
 * @template T Type of collection element
 */
declare class Collection<T> {
	/** Name of the Firestorm collection */
	public readonly collectionName: string;

	/**
	 * Create a new Firestorm collection instance
	 * @param name - The name of the collection
	 * @param addMethods - Additional methods and data to add to the objects
	 */
	public constructor(name: string, addMethods?: CollectionMethods<T>);

	/**
	 * Get the sha1 hash of the collection
	 * - Can be used to compare file content without downloading the file
	 * @returns The sha1 hash of the file
	 */
	public sha1(): string;

	/**
	 * Get an element from the collection by its key
	 * @param key - Key to search
	 * @returns The found element
	 */
	public get(key: string | number): Promise<T>;

	/**
	 * Get multiple elements from the collection by their keys
	 * @param keys - Array of keys to search
	 * @returns The found elements
	 */
	public searchKeys(keys: string[] | number[]): Promise<T[]>;

	/**
	 * Search through the collection
	 * @param options - Array of search options
	 * @param random - Random result seed, disabled by default, but can activated with true or a given seed
	 * @returns The found elements
	 */
	public search(
		options: SearchOption<RemoveMethods<T> & { id: string }>[],
		random?: boolean | number,
	): Promise<T[]>;

	/**
	 * Read the entire collection
	 * @param original - Disable ID field injection for easier iteration (default false)
	 * @returns The entire collection
	 */
	public readRaw(original?: boolean): Promise<Record<string, T>>;

	/**
	 * Read the entire collection
	 * - ID values are injected for easier iteration, so this may be different from {@link sha1}
	 * @deprecated Use {@link readRaw} instead
	 * @returns The entire collection
	 */
	public read_raw(): Promise<Record<string, T>>;

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of {@link readRaw}
	 * @param option - The fields you want to select
	 * @returns Selected fields
	 */
	public select<K extends Array<"id" | keyof T>>(
		option: SelectOption<K>,
	): Promise<Record<string, Pick<T & { id: string }, K[number]>>>;

	/**
	 * Get all distinct non-null values for a given key across a collection
	 * @param option - Value options
	 * @returns Array of unique values
	 */
	public values<K extends keyof RemoveMethods<T>, F extends boolean = false>(
		option: ValueOption<K, F>,
	): Promise<T[K] extends Array<any> ? (F extends true ? T[K] : T[K][]) : T[K][]>;

	/**
	 * Read random elements of the collection
	 * @param max - The maximum number of entries
	 * @param seed - The seed to use
	 * @param offset - The offset to use
	 * @returns The found elements
	 */
	public random(max: number, seed: number, offset: number): Promise<T[]>;

	/**
	 * Set the entire content of the collection.
	 * - Only use this method if you know what you are doing!
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	public writeRaw(value: Record<string, RemoveMethods<T>>): Promise<WriteConfirmation>;

	/**
	 * Set the entire content of the collection.
	 * - Only use this method if you know what you are doing!
	 * @deprecated Use {@link writeRaw} instead
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	public write_raw(value: Record<string, RemoveMethods<T>>): Promise<WriteConfirmation>;

	/**
	 * Append a value to the collection
	 * - Only works if autoKey is enabled server-side
	 * @param value - The value (without methods) to add
	 * @returns The generated key of the added element
	 */
	public add(value: Addable<T>): Promise<string>;

	/**
	 * Append multiple values to the collection
	 * - Only works if autoKey is enabled server-side
	 * @param values - The values (without methods) to add
	 * @returns The generated keys of the added elements
	 */
	public addBulk(values: Addable<T>[]): Promise<string[]>;

	/**
	 * Remove an element from the collection by its key
	 * @param key - The key of the element you want to remove
	 * @returns Write confirmation
	 */
	public remove(key: string | number): Promise<WriteConfirmation>;

	/**
	 * Remove multiple elements from the collection by their keys
	 * @param keys - The keys of the elements you want to remove
	 * @returns Write confirmation
	 */
	public removeBulk(keys: string[] | number[]): Promise<WriteConfirmation>;

	/**
	 * Set a value in the collection by its key
	 * @param key - The key of the element you want to set
	 * @param value - The value (without methods) you want to set
	 * @returns Write confirmation
	 */
	public set(key: string | number, value: Settable<T>): Promise<WriteConfirmation>;

	/**
	 * Set multiple values in the collection by their keys
	 * @param keys - The keys of the elements you want to set
	 * @param values - The values (without methods) you want to set
	 * @returns Write confirmation
	 */
	public setBulk(keys: string[] | number[], values: Settable<T>[]): Promise<WriteConfirmation>;

	/**
	 * Edit an element's field in the collection
	 * @param option - The edit object
	 * @returns Edit confirmation
	 */
	public editField(option: EditFieldOption<RemoveMethods<T>>): Promise<WriteConfirmation>;

	/**
	 * Edit multiple elements' fields in the collection
	 * @param options - The edit objects
	 * @returns Edit confirmation
	 */
	public editFieldBulk(options: EditFieldOption<RemoveMethods<T>>[]): Promise<WriteConfirmation>;
}

/** Value for the ID field when searching content */
export const ID_FIELD: string;

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
export function collection<T>(value: string, addMethods?: CollectionMethods<T>): Collection<T>;

/**
 * Create a temporary Firestorm collection with no methods
 * @deprecated Use {@link collection} with no second argument instead
 * @param table - The table name to get
 * @returns The table instance
 */
export function table<T>(table: string): Collection<T>;

/**
 * Firestorm file handler
 */
export declare const files: {
	/**
	 * Get a file by its path
	 * @param path - The wanted file path
	 * @returns File contents
	 */
	get(path: string): Promise<any>;

	/**
	 * Upload a file
	 * @param form - Form data with path, filename, and file
	 * @returns Write confirmation
	 */
	upload(form: FormData | NodeFormData): Promise<WriteConfirmation>;

	/**
	 * Delete a file by its path
	 * @param path - The file path to delete
	 * @returns Write confirmation
	 */
	delete(path: string): Promise<WriteConfirmation>;
};

/**
 * taken from https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27
 * allows for recursive keyof usage
 */

type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false;

type PathImpl<T, Key extends keyof T> = Key extends string
	? IsAny<T[Key]> extends true
		? never
		: T[Key] extends Record<string, any>
			?
					| `${Key}.${PathImpl<T[Key], Exclude<keyof T[Key], keyof any[]>> & string}`
					| `${Key}.${Exclude<keyof T[Key], keyof any[]> & string}`
			: never
	: never;

type PathImpl2<T> = PathImpl<T, keyof T> | keyof T;

export type Path<T> = keyof T extends string
	? PathImpl2<T> extends infer P
		? P extends string | keyof T
			? P
			: keyof T
		: keyof T
	: never;
