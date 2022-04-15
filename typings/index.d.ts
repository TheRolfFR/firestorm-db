export interface SearchOption<T> {
    // The field you want to search in
    field: keyof T | "id";
    // filter criteria
    criteria: "!="              /** @param {Number|String|Boolean} field - Search if entry field's value is not equal to the value provided */
        | "=="                  /** @param {Number|String|Boolean} field - Search if entry field's value is equal to the value provided */
        | ">="                  /** @param {Number|String} field - Search if entry field's value is greater than or equal to the value provided */
        | "<="                  /** @param {Number|String} field - Search if entry field's value is less than or equal to the value provided */
        | "<"                   /** @param {Number|String} field - Search if entry field's value is less than the value provided */
        | ">"                   /** @param {Number|String} field - Search if entry field's value is greater than the value provided */
        | "in"                  /** @param {Array|Number} field - Search if entry field's value is in the array of values you provided */
        | "includes"            /** @param {String} field - Search if entry field's value includes the value provided */
        | "startsWith"          /** @param {String} field - Search if entry field's value starts with the value provided */
        | "endsWith"            /** @param {String} field - Search if entry field's value ends with the value provided */
        | "array-contains"      /** @param {Array} field - Search if entry field's array contains the value you provided */
        | "array-contains-any"  /** @param {Array} field - Search if entry field's array contains any of the array of values you provided */
        | "array-length-eq"     /** @param {Number} field - Search if entry field's array length is equal to the value provided */
        | "array-length-df"     /** @param {Number} field - Search if entry field's array length is different from the value provided */
        | "array-length-gt"     /** @param {Number} field - Search if entry field's array length is greater than the value provided */
        | "array-length-lt"     /** @param {Number} field - Search if entry field's array length is less than the value provided */
        | "array-length-ge"     /** @param {Number} field - Search if entry field's array length is greater than or equal to the value provided */
        | "array-length-le";    /** @param {Number} field - Search if entry field's array length is less than or equal to the value provided */
    // the value you want to compare
    value: T[keyof T] | T[keyof T][]; // todo: force this value type to be the same type as the field key->value type (or an array of it)
    // Ignore case on search string
    ignoreCase?: boolean;
}
export interface EditObject<T> {
    // the affected element
    id: string | number;
    // The field you want to edit
    field: keyof T;
    // Wanted operation on field
    operation: "set"      /** @param {any} field - Set the field to the value provided */
        | "remove"        /** @param {any} field - Remove the field */
        | "append"        /** @param {String} field - Append the value provided at the end of the string field */
        | "increment"     /** @param {Number} field - Increment the number field by the value provided, or by 1 if not provided */
        | "decrement"     /** @param {Number} field - Decrement the number field by the value provided, or by 1 if not provided */
        | "array-push"    /** @param {any} field - Push the value provided at the end of the array field */
        | "array-delete"  /** @param {Integer} field - Delete the value at the index value provided @see https://www.php.net/manual/fr/function.array-splice */
        | "array-splice"; /** @param {Integer[]} field - Remove certains elements @see https://www.php.net/manual/fr/function.array-splice */
    // the value you want to edit
    value?: T[keyof T] | T[keyof T][]; // todo: force this value type to be the same type as the field key->value type (or an array of it)
}
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
     * @param {SearchOption<T>[]} options - Array of searched options
     * @param {(Number|Boolean)?} random - Random result seed, disabled by default, but can activated with true or a given seed
     * @returns {Promise<T[]>} The found elements
     */
    public search(options: SearchOption<T>[], random?: boolean|number): Promise<T[]>;

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
    public editField(edit: EditObject<T>): Promise<T>;

    /**
     * Change one field from multiple elements of the collection
     * @param {EditObject<T>[]} edits - The edit objects
     * @returns {Promise<T[]>} The edited elements
     */
    public editFieldBulk(edits: EditObject<T>[]): Promise<T[]>;
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