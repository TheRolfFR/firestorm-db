import type { ID_FIELD_NAME } from "../settings.js";

export type Id = string | number;
export type WriteConfirmation = { message: string };

export type ItemBase = { [ID_FIELD_NAME]: Id };
export type MethodsOnly<T> = {
	[K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

/**
 * type below is taken from
 * [this file](https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27)
 * and allows for recursive keyof usage
 */

/** @see https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27 */
type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false;

/** @see https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27 */
type PathImpl<T, Key extends keyof T> = Key extends string
	? IsAny<T[Key]> extends true
		? never
		: T[Key] extends Record<string, any>
			?
					| `${Key}.${PathImpl<T[Key], Exclude<keyof T[Key], keyof any[]>> & string}`
					| `${Key}.${Exclude<keyof T[Key], keyof any[]> & string}`
			: never
	: never;

/** @see https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27 */
type PathImpl2<T> = PathImpl<T, keyof T> | keyof T;

/** @see https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27 */
export type Path<T> = keyof T extends string
	? PathImpl2<T> extends infer P
		? P extends string | keyof T
			? P
			: keyof T
		: keyof T
	: never;
