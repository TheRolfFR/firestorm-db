export type NumberCriteria =
	| "==" /** test if the value is equal to the provided value */
	| "!=" /** test if the value is not equal to the provided value */
	| "<" /** test if the value is less than the provided value */
	| "<=" /** test if the value is less than or equal to the provided value */
	| ">" /** test if the value is greater than the provided value */
	| ">=" /** test if the value is greater than or equal to the provided value */
	| "in" /** test if the value is in the given array */;

export type StringCriteria =
	| "==" /** test if the string value is equal to the provided value */
	| "!=" /** test if the string value is not equal to the provided value */
	| "<" /** test if the string value length is less than the provided value */
	| "<=" /** test if the string value length is less than or equal to the provided value */
	| ">" /** test if the string value length is greater than the provided value */
	| ">=" /** test if the string value length is greater than or equal to the provided value */
	| "in" /** test if the string value is in the given array */
	| "includes" /** test if the string value includes the provided value */
	| "contains" /** same as "includes" */
	| "startsWith" /** test if the string value starts with the provided value */
	| "endsWith" /** test if the string value ends with the provided value */;

export type ArrayCriteria =
	| "array-contains" /** test if the value is in the given array */
	| "array-contains-any" /** test if the any value of the array is in the given array */
	| "array-length-eq" /** test if the array length is equal to the provided value */
	| "array-length-df" /** test if the array length is different from the provided value */
	| "array-length-gt" /** test if the array length is greater than the provided value */
	| "array-length-lt" /** test if the array length is less than the provided value */
	| "array-length-ge" /** test if the array length is greater than or equal to the provided value */
	| "array-length-le" /** test if the array length is less than or equal to the provided value */;

export type BooleanCriteria =
	| "!=" /** test if the value is not equal to the provided value */
	| "==" /** test if the value is equal to the provided value */;

export type AllCriteria =
	| StringCriteria /** criteria applying to strings */
	| ArrayCriteria /** criteria applying to arrays */
	| BooleanCriteria /** criteria applying to boolean */
	| NumberCriteria /** criteria applying to numbers */;

export type Criteria<T> = T extends Function
	? never
	:
				| never /** methods are not allowed in the field (they are not saved in the collection JSON file) */
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

export type EditField<T> = {
	[K in keyof T]: BaseEditField<T> &
		(
			| {
					field: K | string;
					operation: "remove";
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
					operation: "array-slice";
					value: [number, number];
			  }
		);
}[keyof T];

/** Confirmation that a write occurred */
export type Confirmation = { message: string };

export type SearchOption<T> = {
	[K in keyof T]: {
		/** the field to be searched for */
		field: Path<T>;
		/** the criteria to be used to search for the field */
		criteria: Criteria<T[K]>;
		/** the value to be searched for */
		value?: any;
		/** is it case sensitive? (default true) */
		ignoreCase?: boolean;
	};
}[keyof T];

export interface SelectOption<T> {
	/** Chosen fields to eventually return */
	fields: Array<keyof T | "id">;
}

export interface CollectionMethods<T> {
	(collectionElement: Collection<T> & T): Collection<T> & T;
}

export type NoMethods<T> = {
	[K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export class Collection<T> {
	/**
	 * Create a new Firestorm collection instance
	 * @param name - The name of the collection
	 * @param addMethods - Additional methods and data to add to the objects
	 */
	public constructor(name: string, addMethods?: CollectionMethods<T>);

	/**
	 * Get an element from the collection
	 * @param id - The ID of the element you want to get
	 * @returns Corresponding value
	 */
	public get(id: string | number): Promise<T>;

	/**
	 * Get the sha1 hash of the file
	 * - Can be used to see if same file content without downloading the file
	 * @returns The sha1 hash of the file
	 */
	public sha1(): string;

	/**
	 * Search through the collection
	 * @param options - Array of searched options
	 * @param random - Random result seed, disabled by default, but can activated with true or a given seed
	 * @returns The found elements
	 */
	public search(
		options: SearchOption<T & { id: string | number }>[],
		random?: boolean | number,
	): Promise<T[]>;

	/**
	 * Search specific keys through the collection
	 * @param keys - Array of keys to search
	 * @returns The found elements
	 */
	public searchKeys(keys: string[] | number[]): Promise<T[]>;

	/**
	 * Returns the whole content of the JSON
	 * @returns The entire collection
	 */
	public readRaw(): Promise<Record<string, T>>;

	/**
	 * Returns the whole content of the JSON
	 * @deprecated Use readRaw instead
	 * @returns The entire collection
	 */
	public read_raw(): Promise<Record<string, T>>;

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of readRaw
	 * @param option - The option you want to select
	 * @returns Selected fields
	 */
	public select(option: SelectOption<T>): Promise<Record<string, Partial<T>>>;

	/**
	 * Get random max entries offset with a given seed
	 * @param max - The maximum number of entries
	 * @param seed - The seed to use
	 * @param offset - The offset to use
	 * @returns The found elements
	 */
	public random(max: number, seed: number, offset: number): Promise<T[]>;

	/**
	 * Set the entire JSON file contents
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	public writeRaw(value: Record<string, T>): Promise<Confirmation>;

	/**
	 * Set the entire JSON file contents
	 * @deprecated Use writeRaw instead
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	public write_raw(value: Record<string, T>): Promise<Confirmation>;

	/**
	 * Automatically add a value to the JSON file
	 * @param value - The value (without methods) to add
	 * @returns The generated ID of the added element
	 */
	public add(value: Writable<T>): Promise<string>;

	/**
	 * Automatically add multiple values to the JSON file
	 * @param values - The values (without methods) to add
	 * @returns The generated IDs of the added elements
	 */
	public addBulk(values: Writable<T>[]): Promise<string[]>;

	/**
	 * Remove an element from the collection by its ID
	 * @param id - The ID of the element you want to remove
	 * @returns Write confirmation
	 */
	public remove(id: string | number): Promise<Confirmation>;

	/**
	 * Remove multiple elements from the collection by their IDs
	 * @param ids - The IDs of the elements you want to remove
	 * @returns Write confirmation
	 */
	public removeBulk(ids: string[] | number[]): Promise<Confirmation>;

	/**
	 * Set a value in the collection by ID
	 * @param id - The ID of the element you want to edit
	 * @param value - The value (without methods) you want to edit
	 * @returns Write confirmation
	 */
	public set(id: string | number, value: Writable<T>): Promise<Confirmation>;

	/**
	 * Set multiple values in the collection by their IDs
	 * @param ids - The IDs of the elements you want to edit
	 * @param values - The values (without methods) you want to edit
	 * @returns Write confirmation
	 */
	public setBulk(ids: string[] | number[], values: Writable<T>[]): Promise<Confirmation>;

	/**
	 * Edit one field of the collection
	 * @param edit - The edit object
	 * @returns The edited element
	 */
	public editField(edit: EditField<T>): Promise<T>;

	/**
	 * Change one field from multiple elements of the collection
	 * @param edits - The edit objects
	 * @returns The edited elements
	 */
	public editFieldBulk(edits: EditField<T>[]): Promise<T[]>;
}

/** Value for the id field when searching content */
export const ID_FIELD: string;

// don't need ID field when adding keys, and setting keys has a separate ID argument
type Writable<T> = Omit<Omit<T, NoMethods<T>>, "id">;

/**
 * Change the current Firestorm address
 * @param value - The new Firestorm address
 * @returns The stored Firestorm address
 */
export function address(value?: string): string;

/**
 * Change the current Firestorm token
 * @param value - The new Firestorm write token
 * @returns The stored Firestorm write token
 */
export function token(value?: string): string;

/**
 * Create a new Firestorm collection instance
 * @param value - The name of the collection
 * @param addMethods - Additional methods and data to add to the objects
 * @returns The collection
 */
export function collection<T>(value: string, addMethods?: CollectionMethods<T>): Collection<T>;

/**
 * Create a temporary Firestorm collection with no methods
 * @param table - The table name to get
 * @returns The collection
 */
export function table<T>(table: string): Promise<Collection<T>>;

/**
 * Firestorm file handler
 */
export declare const files: {
	/**
	 * Get file back
	 * @param path - The file path wanted
	 */
	get(path: string): Promise<any>;

	/**
	 * Upload file
	 * @param form - The form data with path, filename, and file
	 * @returns HTTP response
	 */
	upload(form: FormData): Promise<any>;

	/**
	 * Deletes a file given its path
	 * @param path - The file path to delete
	 * @returns HTTP response
	 */
	delete(path: string): Promise<any>;
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
