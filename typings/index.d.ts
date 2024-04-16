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
/** ID field can be provided in request or omitted */
export type Settable<T> = Addable<T> & {
	id?: number | string;
};

export interface Collection<T> {
	/** Name of the Firestorm collection */
	readonly collectionName: string;

	/**
	 * Create a new Firestorm collection instance
	 * @param name - The name of the collection
	 * @param addMethods - Additional methods and data to add to the objects
	 */
	new(name: string, addMethods?: CollectionMethods<T>);

	/**
	 * Get an element from the collection
	 * @param id - The ID of the element you want to get
	 * @returns Corresponding value
	 */
	get(id: string | number): Promise<T>;

	/**
	 * Get the sha1 hash of the file
	 * - Can be used to see if same file content without downloading the file
	 * @returns The sha1 hash of the file
	 */
	sha1(): string;

	/**
	 * Search through the collection
	 * @param options - Array of searched options
	 * @param random - Random result seed, disabled by default, but can activated with true or a given seed
	 * @returns The found elements
	 */
	search(
		options: SearchOption<RemoveMethods<T> & { id: string }>[],
		random?: boolean | number,
	): Promise<T[]>;

	/**
	 * Search specific keys through the collection
	 * @param keys - Array of keys to search
	 * @returns The found elements
	 */
	searchKeys(keys: string[] | number[]): Promise<T[]>;

	/**
	 * Returns the whole content of the JSON
	 * @returns The entire collection
	 */
	readRaw(): Promise<Record<string, T>>;

	/**
	 * Returns the whole content of the JSON
	 * @deprecated Use {@link readRaw} instead
	 * @returns The entire collection
	 */
	read_raw(): Promise<Record<string, T>>;

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of readRaw
	 * @param option - The option you want to select
	 * @returns Selected fields
	 */
	select<K extends Array<"id" | keyof T>>(
		option: SelectOption<K>,
	): Promise<Record<string, Pick<T & { id: string }, K[number]>>>;

	/**
	 * Get all distinct non-null values for a given key across a collection
	 * @param option - Value options
	 * @returns Array of unique values
	 */
	values<K extends keyof RemoveMethods<T>, F extends boolean = false>(
		option: ValueOption<K, F>,
	): Promise<T[K] extends Array<any> ? (F extends true ? T[K] : T[K][]) : T[K][]>;

	/**
	 * Get random max entries offset with a given seed
	 * @param max - The maximum number of entries
	 * @param seed - The seed to use
	 * @param offset - The offset to use
	 * @returns The found elements
	 */
	random(max: number, seed: number, offset: number): Promise<T[]>;

	/**
	 * Set the entire JSON file contents
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	writeRaw(value: Record<string, RemoveMethods<T>>): Promise<WriteConfirmation>;

	/**
	 * Set the entire JSON file contents
	 * @deprecated Use {@link writeRaw} instead
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	write_raw(value: Record<string, RemoveMethods<T>>): Promise<WriteConfirmation>;

	/**
	 * Automatically add a value to the JSON file
	 * @param value - The value (without methods) to add
	 * @returns The generated ID of the added element
	 */
	add(value: Addable<T>): Promise<string>;

	/**
	 * Automatically add multiple values to the JSON file
	 * @param values - The values (without methods) to add
	 * @returns The generated IDs of the added elements
	 */
	addBulk(values: Addable<T>[]): Promise<string[]>;

	/**
	 * Remove an element from the collection by its ID
	 * @param id - The ID of the element you want to remove
	 * @returns Write confirmation
	 */
	remove(id: string | number): Promise<WriteConfirmation>;

	/**
	 * Remove multiple elements from the collection by their IDs
	 * @param ids - The IDs of the elements you want to remove
	 * @returns Write confirmation
	 */
	removeBulk(ids: string[] | number[]): Promise<WriteConfirmation>;

	/**
	 * Set a value in the collection by ID
	 * @param id - The ID of the element you want to edit
	 * @param value - The value (without methods) you want to edit
	 * @returns Write confirmation
	 */
	set(id: string | number, value: Settable<T>): Promise<WriteConfirmation>;

	/**
	 * Set multiple values in the collection by their IDs
	 * @param ids - The IDs of the elements you want to edit
	 * @param values - The values (without methods) you want to edit
	 * @returns Write confirmation
	 */
	setBulk(ids: string[] | number[], values: Settable<T>[]): Promise<WriteConfirmation>;

	/**
	 * Edit one field of the collection
	 * @param edit - The edit object
	 * @returns Edit confirmation
	 */
	editField(edit: EditField<RemoveMethods<T>>): Promise<{ success: boolean }>;

	/**
	 * Change one field from multiple elements of the collection
	 * @param edits - The edit objects
	 * @returns Edit confirmation
	 */
	editFieldBulk(edits: EditField<RemoveMethods<T>>[]): Promise<{ success: boolean[] }>;
}

/** Value for the id field when searching content */
export const ID_FIELD: string;

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
 * @deprecated Use {@link collection} with no second argument instead
 * @param table - The table name to get
 * @returns The collection
 */
export function table<T>(table: string): Promise<Collection<T>>;

/**
 * Firestorm file handler
 */
export declare const files: {
	/**
	 * Get a file by its path
	 * @param path - The file path wanted
	 * @returns File contents
	 */
	get(path: string): Promise<any>;

	/**
	 * Upload a file
	 * @param form - The form data with path, filename, and file
	 * @returns Write confirmation
	 */
	upload(form: FormData | NodeFormData): Promise<WriteConfirmation>;

	/**
	 * Deletes a file by path
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
