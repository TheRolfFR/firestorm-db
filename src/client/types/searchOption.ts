import type { Path, PathValue } from "./utils.ts";

export type BooleanCriteria = "==" | "!=";

export type ComparisonCriteria = BooleanCriteria | "<" | "<=" | ">" | ">=";

export type InArrayCriteria = "in";

export type NumberCriteria = ComparisonCriteria | InArrayCriteria;

export type StringCriteria =
	ComparisonCriteria | InArrayCriteria | "includes" | "contains" | "startsWith" | "endsWith";

export type ArrayLengthCriteria =
	| "array-length-eq"
	| "array-length-df"
	| "array-length-gt"
	| "array-length-lt"
	| "array-length-ge"
	| "array-length-le";

export type ArrayElementCriteria = "array-contains";

export type ArrayMultiElementCriteria =
	"array-contains-none" | "array-contains-any" | "array-contains-all";

export type ArrayCriteria = ArrayElementCriteria | ArrayMultiElementCriteria | ArrayLengthCriteria;

export type Criteria<T> = T extends Function
	? never
	: T extends Array<unknown>
		? ArrayCriteria
		: T extends string
			? StringCriteria
			: T extends number
				? NumberCriteria
				: T extends boolean
					? BooleanCriteria
					: never;

export type ArraySearchOption<P extends string, E> =
	| {
			field: P;
			criteria: ArrayElementCriteria;
			value: E;
	  }
	| {
			field: P;
			criteria: ArrayMultiElementCriteria;
			value: E[];
	  }
	| {
			field: P;
			criteria: ArrayLengthCriteria;
			value: number;
	  }
	| {
			field: P;
			criteria: BooleanCriteria;
			value: E[];
	  };

export type StringSearchOption<P extends string> =
	| {
			field: P;
			criteria: Exclude<StringCriteria, InArrayCriteria>;
			value: string;
			ignoreCase?: boolean;
	  }
	| {
			field: P;
			criteria: InArrayCriteria;
			value: string[];
			ignoreCase?: boolean;
	  };

export type NumberSearchOption<P extends string> =
	| {
			field: P;
			criteria: Exclude<NumberCriteria, InArrayCriteria>;
			value: number;
	  }
	| {
			field: P;
			criteria: InArrayCriteria;
			value: number[];
	  };

export type BooleanSearchOption<P extends string> = {
	field: P;
	criteria: BooleanCriteria;
	value: boolean;
};

export type FallbackSearchOption<P extends string, V> = {
	field: P;
	criteria: BooleanCriteria | string;
	value?: V;
	ignoreCase?: boolean;
};

type SearchOptionForValue<P extends string, V> = V extends Function
	? never
	: unknown extends V
		? FallbackSearchOption<P, V>
		: V extends Array<infer E>
			? ArraySearchOption<P, E>
			: V extends string
				? StringSearchOption<P>
				: V extends number
					? NumberSearchOption<P>
					: V extends boolean
						? BooleanSearchOption<P>
						: FallbackSearchOption<P, V>;

export type SearchOption<T, P extends Path<T> = Path<T>> =
	P extends Path<T> ? SearchOptionForValue<P, PathValue<T, P>> : never;

export interface SearchResultOptions {
	random?: boolean | number;
	limit?: number;
}
