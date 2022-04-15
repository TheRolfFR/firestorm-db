export interface SearchOption {
    // The field you want to search in
    field: string;
    // filter criteria
    criteria: "!=" | "==" | ">=" | "<=" | "<" | ">" | "in" | "includes" | "startsWith" | "endsWith" | "array-contains" | "array-contains-any" | "array-length-(eq|df|gt|lt|ge|le)";
    // the value you want to compare
    value: string | number | boolean | any[];
    // Ignore case on search string
    ignoreCase?: boolean;
}
export interface EditObject {
    // the affected element
    id: string | number;
    // The field you want to edit
    field: string;
    // Wanted operation on field
    operation: "set" | "remove" | "append" | "increment" | "decrement" | "array-push" | "array-delete" | "array-splice";
    // the value you want to edit
    value?: string | number | boolean | any[];
}
export interface SelectOption  {
    // Chosen fields to eventually return
    fields: string[];
}

export interface AddMethods<T> {
    (el: T): T;
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
     * @param {SearchOption[]} options - Array of searched options
     * @param {(Number|Boolean)?} random - Random result seed, disabled by default, but can activated with true or a given seed
     * @returns {Promise<T[]>} The found elements
     */
    public search(options: SearchOption[], random?: boolean|number): Promise<T[]>;

    /**
     * Search specific keys through the collection
     * @param {String[]|Number[]} keys - Array of keys to search
     * @returns {Promise<T[]>} The found elements
     */
    public searchKeys(keys: string[]|number[]): Promise<T[]>;

    /**
     * Returns the whole content of the file
     * @returns {Promise<any>}
     */
    public read_raw(): Promise<any>;

    /**
     * Get only selected elements from the collection
     * @param {SelectOption} option - The option you want to select
     * @returns {Promise<any[]>} Only selected elements from T
     */
    public select(option: SelectOption): Promise<any[]>;

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
     * @param {T} value - The value to write
     * @returns {Promise<any>}
     */
    public write_raw(value: T): Promise<any>;

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
     * @returns {Promise<any>}
     */
    public remove(id: string|number): Promise<any>;

    /**
     * Remove multiple elements from the collection by their ids
     * @param {String[]|Number[]} ids - The ids of the elements you want to remove
     * @returns {Promise<any>}
     */
    public removeBulk(ids: string[]|number[]): Promise<any>;

    /**
     * Set a value in the collection by its id
     * @param {String|Number} id - The id of the element you want to edit
     * @param {Omit<T, NoMethods<T>>} value - The value, without methods, you want to edit
     * @returns {Promise<T>} The edited element
     */
    public set(id: string|number, value: Omit<T, NoMethods<T>>): Promise<T>;

    /**
     * Set multiple values in the collection by their ids
     * @param {String[]|Number[]} ids - The ids of the elements you want to edit
     * @param {Omit<T, NoMethods<T>>[]} values - The values, without methods, you want to edit
     * @returns {Promise<T[]>} The edited elements
     */
    public setBulk(ids: string[]|number[], values: Omit<T, NoMethods<T>>[]): Promise<T[]>;

    /**
     * Edit one field of the collection
     * @param {EditObject} edit - The edit object
     * @returns {Promise<T>} The edited element
     */
    public editField(edit: EditObject): Promise<T>;

    /**
     * Change one field from multiple elements of the collection
     * @param {EditObject[]} edits - The edit objects
     * @returns {Promise<T[]>} The edited elements
     */
    public editFieldBulk(edits: EditObject[]): Promise<T[]>;
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