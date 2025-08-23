import type { Id } from "./utils.js";

type BaseEditField<T> = {
	[K in keyof T]: {
		id: Id;
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