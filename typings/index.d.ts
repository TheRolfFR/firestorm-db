import { Except } from "type-fest";

export type math_criteria = 
    | "==" // test if the value is equal to the provided value
    | "!=" // test if the value is not equal to the provided value
    | "<"  // test if the value is less than the provided value
    | "<=" // test if the value is less than or equal to the provided value
    | ">"  // test if the value is greater than the provided value
    | ">=" // test if the value is greater than or equal to the provided value
    | "in"; // test if the value is in the given array

export type str_criteria = 
    | "==" // test if the string value is equal to the provided value
    | "!=" // test if the string value is not equal to the provided value
    | "<"  // test if the string value length is less than the provided value
    | "<=" // test if the string value length is less than or equal to the provided value
    | ">"  // test if the string value length is greater than the provided value
    | ">=" // test if the string value length is greater than or equal to the provided value
    | "in" // test if the string value is in the given array
    | "includes" // test if the string value includes the provided value
    | "contains" // same as "includes"
    | "startsWith" // test if the string value starts with the provided value
    | "endsWith"; // test if the string value ends with the provided value

export type arr_criteria =
    | "array-contains" // test if the value is in the given array
    | "array-contains-any" // test if the any value of the array is in the given array
    | "array-length-eq" // test if the array length is equal to the provided value
    | "array-length-df" // test if the array length is different from the provided value
    | "array-length-gt" // test if the array length is greater than the provided value
    | "array-length-lt" // test if the array length is less than the provided value
    | "array-length-ge" // test if the array length is greater than or equal to the provided value
    | "array-length-le"; // test if the array length is less than or equal to the provided value

export type bool_criteria = 
    | "!=" // test if the value is not equal to the provided value
    | "=="; // test if the value is equal to the provided value

export type any_criteria = str_criteria | arr_criteria | bool_criteria | math_criteria;

export type Criteria<T> = 
    | T extends Function ? never : never // methods are not allowed in the field (they are not saved in the collection JSON file)
    | T extends Array<unknown> ? arr_criteria : never
    | T extends string ? str_criteria : never
    | T extends number ? math_criteria : never
    | T extends boolean ? bool_criteria : never

export type any_operation = 
    | "set"       /** @param {T} value - set the field to the given value */
    | "remove"    /** @param {null|undefined|any} value - remove the field */

export type string_operation = 
    | "append"    /** @param {string} value - append the given value to the field */

export type number_operation = 
    | "increment"  /** @param {number?} value - increment the field by the given value, or by one */
    | "decrement"  /** @param {number?} value - decrement the field by the given value, or by one */

export type array_operation  = 
    | "array-push"   /** @param {any} value - push the given value to the field */
    | "array-delete" /** @param {number} index - delete the value at the given index @see https://www.php.net/manual/fr/function.array-splice */
    | "array-splice" /** @param {number[]} indexes - remove certains elements of the array field @see https://www.php.net/manual/fr/function.array-splice */

type _operation<T> =
    | T extends string ? string_operation : never
    | T extends number ? number_operation : never
    | T extends Array<unknown> ? array_operation : never
    | T extends object|Function ? never : never


export type Operation<T> = {
    [K in keyof T]: _operation<T[K]>
}[keyof T] | any_operation;

type BaseEditField<T> = {
    [K in keyof T]: {
        id: number|string;
    }
}[keyof T];

type Field<P, T> = {
    [K in keyof T]: T[K] extends P ? K : never;
}[keyof T];

export type EditField<T> = {
    [K in keyof T]: BaseEditField<T> & ({
        field: K | string;
        operation: "remove";
    } |{
        field: Field<Boolean, T>;
        operation: "invert";
    } | {
        field: Field<Number,T>;
        operation: "increment" | "decrement";
        value?: Number;
    } | {
        field: Field<T[K], T> | String;
        operation: "set";
        value: T[K] | any;
    } | {
        field: Field<Array<unknown>, T>;
        operation: "array-push";
        value: T[K];
    } | {
        field: Field<Array<unknown>, T>;
        operation: "array-delete",
        value: Number
    } | {
        field: Field<Array<unknown>, T>;
        operation: "array-slice",
        value: [Number, Number]
    })
}[keyof T]

export type SearchOption<T> = {
    [K in keyof T]: {
        field: K | String;
        criteria: Criteria<T[K]>;
        value?: any;
        ignoreCase?: boolean;
    }
}[keyof T]

export interface SelectOption<T> {
    // Chosen fields to eventually return
    fields: Array<keyof T | "id">;
}

export interface AddMethods<T> {
    (el: T): T;
}

export interface Raw<T> {
    [key: string]: T;
}

export type NoMethods<T> = {
    [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export class Collection<T> {
    /**
     * @param {String} name - The name of the collection
     * @param {Function?} addMethods - The methods you want to add to the collection
     */
    public constructor(name: string, addMethods?: AddMethods<T>);

    /**
     * Get an element from the collection
     * @param {String|Number} id - The id of the element you want to get
     */
    public get(id: string|number): Promise<T>;

    /**
     * Get the sha1 hash of the file.
     * - Can be used to see if same file content without downloading the file for example
     * @returns {String} The sha1 hash of the file
     */
    public sha1(): string;

    /**
     * Search trough the collection
     * @param {SearchOption<T & {id: String|Number}>[]} options - Array of searched options
     * @param {(Number|Boolean)?} random - Random result seed, disabled by default, but can activated with true or a given seed
     * @returns {Promise<T[]>} The found elements
     */
    public search(options: SearchOption<T & { id: string|number }>[], random?: boolean|number): Promise<T[]>;

    /**
     * Search specific keys through the collection
     * @param {String[]|Number[]} keys - Array of keys to search
     * @returns {Promise<T[]>} The found elements
     */
    public searchKeys(keys: string[]|number[]): Promise<T[]>;

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
    public remove(id: string|number): Promise<string>;

    /**
     * Remove multiple elements from the collection by their ids
     * @param {String[]|Number[]} ids - The ids of the elements you want to remove
     * @returns {Promise<String>}
     */
    public removeBulk(ids: string[]|number[]): Promise<string>;

    /**
     * Set a value in the collection by its id
     * @param {String|Number} id - The id of the element you want to edit
     * @param {Omit<T, NoMethods<T>>} value - The value, without methods, you want to edit
     * @returns {Promise<String>} The edited element
     */
    public set(id: string|number, value: Omit<T, NoMethods<T>>): Promise<string>;

    /**
     * Set multiple values in the collection by their ids
     * @param {String[]|Number[]} ids - The ids of the elements you want to edit
     * @param {Omit<T, NoMethods<T>>[]} values - The values, without methods, you want to edit
     * @returns {Promise<String>} The edited elements
     */
    public setBulk(ids: string[]|number[], values: Omit<T, NoMethods<T>>[]): Promise<string>;

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

export namespace firestorm {
    // Value for the id field when searching content
    const ID_FIELD: string;

    /**
     * Change the current firestorm address
     * @param {String} value - The new firestorm address
     * @returns {String} The stored firestorm address
     */
    function address(value?: string): string;

    /**
     * @param {String} value - The new firestorm write token
     * @returns {String} The stored firestorm write token
     */
    function token(value: string): string;

    /**
     * @param {String} value - The new firestorm read token
     * @param {AddMethods<T>} addMethods - Additional methods you want to add to the collection
     * @returns {Collection<T>} The collection
     */
    function collection<T>(value: string, addMethods?: AddMethods<T>): Collection<T>;

    /**
     * @param {String} table - The table name to get
     */
    function table(table: string): Promise<any>;

    
    interface files {
        /**
         * Get file back
         * @param {String} path - The file path wanted
         */
        get: (path: string) => any;

        /**
         * Upload file
         * @param {FormData} form - The form data with path, filename & file
         * @returns {Promise<any>} http response
         */
        upload: (form: FormData) => Promise<any>;

        /**
         * Deletes a file given its path
         * @param {String} path - The file path to delete
         * @returns {Promise<any>} http response
         */
        delete: (path: string) => Promise<any>;
    }
}