export type number_criteria =
	| "==" /** test if the value is equal to the provided value */
	| "!=" /** test if the value is not equal to the provided value */
	| "<" /** test if the value is less than the provided value */
	| "<=" /** test if the value is less than or equal to the provided value */
	| ">" /** test if the value is greater than the provided value */
	| ">=" /** test if the value is greater than or equal to the provided value */
	| "in" /** test if the value is in the given array */;

export type string_criteria =
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

export type array_criteria =
	| "array-contains" /** test if the value is in the given array */
	| "array-contains-any" /** test if the any value of the array is in the given array */
	| "array-length-eq" /** test if the array length is equal to the provided value */
	| "array-length-df" /** test if the array length is different from the provided value */
	| "array-length-gt" /** test if the array length is greater than the provided value */
	| "array-length-lt" /** test if the array length is less than the provided value */
	| "array-length-ge" /** test if the array length is greater than or equal to the provided value */
	| "array-length-le" /** test if the array length is less than or equal to the provided value */;

export type boolean_criteria =
	| "!=" /** test if the value is not equal to the provided value */
	| "==" /** test if the value is equal to the provided value */;

export type all_criteria =
	| string_criteria /** criteria applying to strings */
	| array_criteria /** criteria applying to arrays */
	| boolean_criteria /** criteria applying to boolean */
	| number_criteria /** criteria applying to numbers */;

export type Criteria<T> = T extends Function
	? never
	:
			| never /** methods are not allowed in the field (they are not saved in the collection JSON file) */
			| T extends Array<unknown>
	? array_criteria
	: never | T extends string
	? string_criteria
	: never | T extends number
	? number_criteria
	: never | T extends boolean
	? boolean_criteria
	: never;

export type any_operation =
	| "set" /** @param {T} value - set the field to the given value */
	| "remove" /** @param {null|undefined|any} value - remove the field */;

export type string_operation =
	"append" /** @param {string} value - append the given value to the field */;

export type number_operation =
	| "increment" /** @param {number?} value - increment the field by the given value, or by one */
	| "decrement" /** @param {number?} value - decrement the field by the given value, or by one */;

export type array_operation =
	| "array-push" /** @param {any} value - push the given value to the field */
	| "array-delete" /** @param {number} index - delete the value at the given index @see https://www.php.net/manual/fr/function.array-splice */
	| "array-splice" /** @param {number[]} indexes - remove certain elements of the array field @see https://www.php.net/manual/fr/function.array-splice */;

type _operation<T> = T extends string
	? string_operation
	: never | T extends number
	? number_operation
	: never | T extends Array<unknown>
	? array_operation
	: never | T extends object | Function
	? never
	: never;

export type Operation<T> =
	| {
			[K in keyof T]: _operation<T[K]>;
	  }[keyof T]
	| any_operation;

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
					field: Field<Boolean, T>;
					operation: "invert";
			  }
			| {
					field: Field<Number, T>;
					operation: "increment" | "decrement";
					value?: Number;
			  }
			| {
					field: Field<T[K], T> | String;
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
					value: Number;
			  }
			| {
					field: Field<Array<unknown>, T>;
					operation: "array-slice";
					value: [Number, Number];
			  }
		);
}[keyof T];

export type SearchOption<T> = {
	[K in keyof T]: {
		/** the field to be searched for */
		field: Path<T>;
		/** the criteria to be used to search for the field */
		criteria: Criteria<T[K]>;
		/** the value to be searched for */
		value?: any;
		/** is it case sensitive? (default: true) */
		ignoreCase?: boolean;
	};
}[keyof T];

export interface SelectOption<T> {
	/** Chosen fields to eventually return */
	fields: Array<keyof T | "id">;
}

export type CollectionMethods<T> = (
	/** Makes sure you can properly inject methods */
	collectionElement: Addable<Collection<T> & T>,
) => Addable<Collection<T> & T>;

export interface Raw<T> {
	[key: string]: T;
}

export type Addable<T> = T & Partial<Record<any, any>>;

export type NoMethods<T> = {
	[K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export class Collection<T> {
	/**
	 * @param {String} name - The name of the collection
	 * @param {Function?} addMethods - The methods you want to add to the collection
	 */
	public constructor(name: string, addMethods?: CollectionMethods<T>);

	/**
	 * Get an element from the collection
	 * @param {String|Number} id - The id of the element you want to get
	 */
	public get(id: string | number): Promise<T>;

	/**
	 * Get the sha1 hash of the file.
	 * - Can be used to see if same file content without downloading the file for example
	 * @returns {String} The sha1 hash of the file
	 */
	public sha1(): string;

	/**
	 * Search through the collection
	 * @param {SearchOption<T & {id: String|Number}>[]} options - Array of searched options
	 * @param {(Number|Boolean)?} random - Random result seed, disabled by default, but can activated with true or a given seed
	 * @returns {Promise<T[]>} The found elements
	 */
	public search(
		options: SearchOption<T & { id: string | number }>[],
		random?: boolean | number,
	): Promise<T[]>;

	/**
	 * Search specific keys through the collection
	 * @param {String[]|Number[]} keys - Array of keys to search
	 * @returns {Promise<T[]>} The found elements
	 */
	public searchKeys(keys: string[] | number[]): Promise<T[]>;

	/**
	 * Returns the whole content of the file
	 * @returns {Promise<Raw<T>>}
	 */
	public read_raw(): Promise<Raw<T>>;

	/**
	 * Get only selected elements from the collection
	 * @param {SelectOption<T>} option - The option you want to select
	 * @returns {Promise<any[]>} Only selected elements from T
	 */
	public select(option: SelectOption<T>): Promise<any[]>;

	/**
	 * Get random max entries offset with a given seed
	 * @param {Integer} max - The maximum number of entries
	 * @param {Integer} seed - The seed to use
	 * @param {Integer} offset - The offset to use
	 * @returns {Promise<T[]>} The found elements
	 */
	public random(max: number, seed: number, offset: number): Promise<T[]>;

	/**
	 * Write the whole content in the JSON file
	 * @param {Raw<T>} value - The value to write
	 * @returns {Promise<String>}
	 */
	public write_raw(value: Raw<T>): Promise<string>;

	/**
	 * Add automatically a value to the JSON file
	 * @param {Omit<T, NoMethods<T>>} value - The value, without methods, to add
	 * @returns {Promise<String>} The id of the added element
	 */
	public add(value: Omit<T, NoMethods<T>>): Promise<string>;

	/**
	 * Add automatically multiple values to the JSON file
	 * @param {Omit<T, NoMethods<T>>[]} values - The values, without methods, to add
	 * @returns {Promise<String[]>} The ids of the added elements
	 */
	public addBulk(values: Omit<T, NoMethods<T>>[]): Promise<string[]>;

	/**
	 * Remove an element from the collection by its id
	 * @param {String|Number} id - The id of the element you want to remove
	 * @returns {Promise<String>}
	 */
	public remove(id: string | number): Promise<string>;

	/**
	 * Remove multiple elements from the collection by their ids
	 * @param {String[]|Number[]} ids - The ids of the elements you want to remove
	 * @returns {Promise<String>}
	 */
	public removeBulk(ids: string[] | number[]): Promise<string>;

	/**
	 * Set a value in the collection by its id
	 * @param {String|Number} id - The id of the element you want to edit
	 * @param {Omit<T, NoMethods<T>>} value - The value, without methods, you want to edit
	 * @returns {Promise<String>} The edited element
	 */
	public set(id: string | number, value: Omit<T, NoMethods<T>>): Promise<string>;

	/**
	 * Set multiple values in the collection by their ids
	 * @param {String[]|Number[]} ids - The ids of the elements you want to edit
	 * @param {Omit<T, NoMethods<T>>[]} values - The values, without methods, you want to edit
	 * @returns {Promise<String>} The edited elements
	 */
	public setBulk(ids: string[] | number[], values: Omit<T, NoMethods<T>>[]): Promise<string>;

	/**
	 * Edit one field of the collection
	 * @param {EditObject<T>} edit - The edit object
	 * @returns {Promise<T>} The edited element
	 */
	public editField(edit: EditField<T>): Promise<T>;

	/**
	 * Change one field from multiple elements of the collection
	 * @param {EditObject<T>[]} edits - The edit objects
	 * @returns {Promise<T[]>} The edited elements
	 */
	public editFieldBulk(edits: EditField<T>[]): Promise<T[]>;
}

/** Value for the id field when searching content */
export const ID_FIELD: string;

/**
 * Change the current firestorm address
 * @param {String} value - The new firestorm address
 * @returns {String} The stored firestorm address
 */
export function address(value?: string): string;

/**
 * @param {String} value - The new firestorm write token
 * @returns {String} The stored firestorm write token
 */
export function token(value: string): string;

/**
 * @param {String} value - The new firestorm read token
 * @param {CollectionMethods<T>} addMethods - Additional methods you want to add to the collection
 * @returns {Collection<T>} The collection
 */
export function collection<T>(value: string, addMethods?: CollectionMethods<T>): Collection<T>;

/**
 * @param {String} table - The table name to get
 */
export function table(table: string): Promise<any>;

// technically misleading since it's a constant object but it works
export class files {
	/**
	 * Get file back
	 * @param {String} path - The file path wanted
	 */
	static get: (path: string) => any;

	/**
	 * Upload file
	 * @param {FormData} form - The form data with path, filename & file
	 * @returns {Promise<any>} http response
	 */
	static upload: (form: FormData) => Promise<any>;

	/**
	 * Deletes a file given its path
	 * @param {String} path - The file path to delete
	 * @returns {Promise<any>} http response
	 */
	static delete: (path: string) => Promise<any>;
}

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
