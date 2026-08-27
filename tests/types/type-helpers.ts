/**
 * Compile-time type assertion utilities
 */

/**
 * Asserts that T is true.
 * If T is false, a compile error will occur.
 */
export type Expect<T extends true> = T;

/**
 * Asserts that T is false.
 */
export type ExpectFalse<T extends false> = T;

/**
 * Checks if type X and type Y are strictly equal.
 */
export type Equal<X, Y> =
	(<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

/**
 * Checks if type X and type Y are not equal.
 */
export type NotEqual<X, Y> = Equal<X, Y> extends true ? false : true;

/**
 * Checks if type A extends type B (A is assignable to B).
 */
export type Extends<A, B> = [A] extends [B] ? true : false;

/**
 * Checks if type A does not extend type B.
 */
export type NotExtends<A, B> = [A] extends [B] ? false : true;

/**
 * Runtime no-op helper to verify types without executing anything
 */
export function assertType<T>(_value: T): void {
	// static assertion only
}
