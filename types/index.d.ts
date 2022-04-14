export type SearchOption = {
    /**
     * The field you want to search in
     */
    field: string;
    /**
     * filter criteria
     */
    criteria: "!=" | "==" | ">=" | "<=" | "<" | ">" | "in" | "includes" | "startsWith" | "endsWith" | "array-contains" | "array-contains-any" | "array-length-(eq|df|gt|lt|ge|le)";
    /**
     * the value you want to compare
     */
    value: string | number | boolean | any[];
    /**
     * Ignore case on search string
     */
    ignoreCase: boolean;
};
export type EditObject = {
    /**
     * the affected element
     */
    id: string | number;
    /**
     * The field you want to edit
     */
    field: string;
    /**
     * Wanted operation on field
     */
    operation: "set" | "remove" | "append" | "increment" | "decrement" | "array-push" | "array-delete" | "array-splice";
    value?: string | number | boolean | any[];
};
export type SelectOption = {
    /**
     * Chosen fields to eventually return
     */
    fields: Array<string>;
};
