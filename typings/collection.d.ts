import type { Firestorm } from "./index.d.ts";
import type { Path, WriteConfirmation } from "./utils.d.ts";

/**
 * Represents a Firestorm Collection
 * @template T - Type of collection element
 */
export interface Collection<T> {
	/** Name of the Firestorm collection */
	readonly collectionName: string;
	readonly addMethods: AddMethods<T>;

	/** Value for the ID field when searching content */
	ID_FIELD: string;

	/** Root Firestorm instance where the file address and token are based on */
	readonly instance: Firestorm;

	/**
	 * Get the SHA-1 hash of the collection
	 * - Can be used to compare file content without downloading the file
	 * @returns The SHA-1 hash of the file
	 */
	sha1(): Promise<string>;

	/**
	 * Get an element from the collection by its key
	 * @param key - Key to search
	 * @returns The found element
	 */
	get(key: string | number): Promise<T>;

	/**
	 * Get multiple elements from the collection by their keys
	 * @param keys - Array of keys to search
	 * @returns The found elements
	 */
	searchKeys(keys: (string | number)[]): Promise<T[]>;

	/**
	 * Search through the collection
	 * @param options - Array of search filters
	 * @param random - Random result seed, disabled by default, but can activated with true or a given seed
	 * @param limit - Limit the number of results returned (only applies if random is false)
	 * @returns The found elements
	 */
	search(filter: SearchOption<RemoveMethods<T>>[],
	random?: boolean | number | SearchResultOptions,): Promise<T[]>;

	/**
	 * Read the entire collection
	 * @param original - Disable ID field injection for easier iteration (default false)
	 * @returns The entire collection
	 */
	readRaw<O extends boolean = false>(
		original?: O,
	): Promise<Record<string, O extends true ? WithoutID<T> : T>>;

	/**
	 * Get only selected fields from the collection
	 * - Essentially an upgraded version of {@link readRaw}
	 * @param option - The fields you want to select
	 * @returns Selected fields
	 */
	select<K extends Array<keyof T>>(
		option: SelectOption<K>,
	): Promise<Record<string, Pick<T, K[number]>>>;

	/**
	 * Get all distinct non-null values for a given key across a collection
	 * @param option - Value options
	 * @returns Array of unique values
	 */
	values<K extends keyof RemoveMethods<T>, F extends boolean = false>(
		option: ValueOption<K, F>,
	): Promise<T[K] extends Array<any> ? (F extends true ? T[K] : T[K][]) : T[K][]>;

	/**
	 * Read random collection elements
	 * @param max - The maximum number of entries
	 * @param seed - The seed to use
	 * @param offset - The offset to use
	 * @returns The found elements
	 */
	random(max?: number, seed?: number, offset?: number): Promise<T[]>;

	/**
	 * Set the entire content of the collection.
	 * - Only use this method if you know what you are doing!
	 * @param value - The value to write
	 * @returns Write confirmation
	 */
	writeRaw(value: Record<string, Addable<T>>): Promise<WriteConfirmation>;

	/**
	 * Append a value to the collection
	 * - Only works if autoKey is enabled server-side
	 * @param value - The value (without methods) to add
	 * @returns The generated key of the added element
	 */
	add(value: Addable<T>): Promise<string>;

	/**
	 * Append multiple values to the collection
	 * - Only works if autoKey is enabled server-side
	 * @param values - The values (without methods) to add
	 * @returns The generated keys of the added elements
	 */
	addBulk(values: Addable<T>[]): Promise<string[]>;

	/**
	 * Remove an element from the collection by its key
	 * @param key - The key of the element you want to remove
	 * @returns Write confirmation
	 */
	remove(key: string | number): Promise<WriteConfirmation>;

	/**
	 * Remove multiple elements from the collection by their keys
	 * @param keys - The keys of the elements you want to remove
	 * @returns Write confirmation
	 */
	removeBulk(keys: (string | number)[]): Promise<WriteConfirmation>;

	/**
	 * Set a value in the collection by its key
	 * @param key - The key of the element you want to set
	 * @param value - The value (without methods) you want to set
	 * @returns Write confirmation
	 */
	set(key: string | number, value: Settable<T>): Promise<WriteConfirmation>;

	/**
	 * Set multiple values in the collection by their keys
	 * @param keys - The keys of the elements you want to set
	 * @param values - The values (without methods) you want to set
	 * @returns Write confirmation
	 */
	setBulk(keys: (string | number)[], values: Settable<T>[]): Promise<WriteConfirmation>;

	/**
	 * Edit an element's field in the collection
	 * @param option - The edit object
	 * @returns Edit confirmation
	 */
	editField(option: EditFieldOption<RemoveMethods<T>>): Promise<WriteConfirmation>;

	/**
	 * Edit multiple elements' fields in the collection
	 * @param options - The edit objects
	 * @returns Edit confirmation
	 */
	editFieldBulk(options: EditFieldOption<RemoveMethods<T>>[]): Promise<WriteConfirmation>;
}

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
	| "contains" /** Alias of "includes" */
	| "startsWith" /** String value starts with the provided value */
	| "endsWith"; /** String value ends with the provided value */

export type ArrayCriteria =
	| "array-contains" /** Value is in the given array */
	| "array-contains-none" /** No value of the array is in the given array */
	| "array-contains-any" /** Any value of the array is in the given array */
	| "array-contains-all" /** Every value of the array is in the given array */
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

export type SearchResultOptions  = {
	/** Random result seed, disabled by default, but can activated with true or a given seed */
	random?: boolean | number;
	/** Limit the number of results returned (only applies if random is false) */
	limit?: number;
};

export interface SelectOption<T extends any[]> {
	/** Selected fields to be returned */
	fields: T;
}

export interface ValueOption<K, F extends boolean> {
	/** Field to search */
	field: K;
	/** Flatten array fields? (default false) */
	flatten?: F;
}

/** Add methods to found elements */
export type AddMethods<T> = (element: T, collection: Collection<T>) => T;

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

/** Helper type for non-relational collections */
export type WithoutID<T> = Omit<T, "id">;
export type WithID<T> = T & { id: string };
