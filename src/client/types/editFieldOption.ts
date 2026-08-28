import type { IdEncoding } from "./utils.ts";

type BaseEditField<T, IdType = IdEncoding> = {
	[K in keyof T]: {
		id: IdType;
	};
}[keyof T];

type Field<P, T> = {
	[K in keyof T]: T[K] extends P ? K : never;
}[keyof T];

type EditOperation<T, K extends keyof T> =
	| {
			field: K | string;
			operation: "remove";
	  }
	| {
			field: Field<string, T> | string;
			operation: "append";
			value: string;
	  }
	| {
			field: Field<boolean, T>;
			operation: "invert";
	  }
	| {
			field: Field<number, T>;
			operation: "increment" | "decrement";
			value?: number;
	  }
	| {
			field: Field<T[K], T> | string;
			operation: "set";
			value: T[K] | unknown;
	  }
	| {
			field: Field<Array<unknown>, T>;
			operation: "array-push";
			value: T[K] extends (infer E)[] ? E : unknown;
	  }
	| {
			field: Field<Array<unknown>, T>;
			operation: "array-delete";
			value: number;
	  }
	| {
			field: Field<Array<unknown>, T>;
			operation: "array-splice";
			value:
				| [number, number]
				| [number, number, T[Field<Array<unknown>, T>] extends (infer E)[] ? E : unknown];
	  };

export type EditFieldOption<T, IdType = IdEncoding> = {
	[K in keyof T]: BaseEditField<T, IdType> & EditOperation<T, K>;
}[keyof T];

export type DocumentEditFieldOption<T> = {
	[K in keyof T]: EditOperation<T, K>;
}[keyof T];
