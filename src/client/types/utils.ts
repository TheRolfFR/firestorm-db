/**
 * Global unique symbol used to access the Firestorm document ID on collection items.
 */
export const ID_FIELD: unique symbol = Symbol.for("firestorm.id");

export type IdEncoding = string | number;
export type WriteConfirmation = { message: string };

export type CollectionItem<Item extends Record<string, unknown> = Record<string, unknown>> =
	Item & {
		[ID_FIELD]: string;
	};

/**
 * type below is taken from
 * [this file](https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27)
 * and allows for recursive keyof usage
 */

type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false;

type PathImpl<T, Key extends keyof T> = Key extends string
	? IsAny<T[Key]> extends true
		? never
		: NonNullable<T[Key]> extends Record<string, unknown>
			? | `${Key}.${PathImpl<NonNullable<T[Key]>, Exclude<keyof NonNullable<T[Key]>, keyof unknown[]>> & string}`
				| `${Key}.${Exclude<keyof NonNullable<T[Key]>, keyof unknown[]> & string}`
			: never
	: never;

type PathImpl2<T> = PathImpl<T, keyof T> | keyof T;

/** @see https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27 */
export type Path<T> = keyof T extends string
	? PathImpl2<T> extends infer P
		? P extends string | keyof T
			? P
			: keyof T
		: keyof T
	: never;

/** Get property value type for a dot-separated string path P in T */
export type PathValue<T, P extends string> = P extends `${infer Key}.${infer Rest}`
	? Key extends keyof T
		? PathValue<NonNullable<T[Key]>, Rest>
		: never
	: P extends keyof T
		? T[P]
		: never;
