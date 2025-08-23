import type { Path } from "./utils.js";

export type BooleanCriteria =
	| "==" // Value is equal to the provided value
	| "!="; // Value is not equal to the provided value

export type NumberCriteria =
	| BooleanCriteria
	| "<" // Value is less than the provided value
	| "<=" // Value is less than or equal to the provided value
	| ">" // Value is greater than the provided value
	| ">=" // Value is greater than or equal to the provided value
	| "in"; // Value is in the given array

export type StringCriteria =
	| NumberCriteria
	| "includes" // String value includes the provided value
	| "contains" // Alias of "includes"
	| "startsWith" // String value starts with the provided value
	| "endsWith"; // String value ends with the provided value

export type ArrayCriteria =
	| "array-contains" // Value is in the given array
	| "array-contains-none" // No value of the array is in the given array
	| "array-contains-any" // Any value of the array is in the given array
	| "array-contains-all" // Every value of the array is in the given array
	| "array-length-eq" // Array length is equal to the provided value
	| "array-length-df" // Array length is different from the provided value
	| "array-length-gt" // Array length is greater than the provided value
	| "array-length-lt" // Array length is less than the provided value
	| "array-length-ge" // Array length is greater than or equal to the provided value
	| "array-length-le"; // Array length is less than or equal to the provided value

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

export type SearchOption<T> = {
	[K in keyof T]: {
		/** The field to be searched for */
		field: Path<T>;
		/** Search criteria to filter results */
		criteria: Criteria<T[K]>;
		/** The value to be searched for */
		value?: any;
		/**
		 * Is it case sensitive?
		 * @default true
		 */
		ignoreCase?: boolean;
	};
}[keyof T];
