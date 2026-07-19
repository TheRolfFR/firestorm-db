/**
 * taken from https://github.com/toonvanstrijp/nestjs-i18n/blob/3fc33c105a68b112ed7af6237c5f49902d0864b6/src/types.ts#L27
 * allows for recursive keyof usage
 */

type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false;

type PathImpl<T, Key extends keyof T> = Key extends string
	? IsAny<T[Key]> extends true
		? never
		: T[Key] extends Record<string, any>
			?
					| `${Key}.${PathImpl<T[Key], Exclude<keyof T[Key], keyof any[]>> & string}`
					| `${Key}.${Exclude<keyof T[Key], keyof any[]> & string}`
			: never
	: never;

type PathImpl2<T> = PathImpl<T, keyof T> | keyof T;

export type Path<T> = keyof T extends string
	? PathImpl2<T> extends infer P
		? P extends string | keyof T
			? P
			: keyof T
		: keyof T
	: never;

/** Write status */
export type WriteConfirmation = { message: string };
