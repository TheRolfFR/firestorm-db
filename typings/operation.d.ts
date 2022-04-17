export type any_operation = 
  | "set"       /** @param {T} value - set the field to the given value */
  | "remove"    /** @param {null|undefined|any} value - remove the field */

export type string_operation = 
  | "append"    /** @param {string} value - append the given value to the field */

export type number_operation = 
  | "increment"  /** @param {number?} value - increment the field by the given value, or by one */
  | "decrement"  /** @param {number?} value - decrement the field by the given value, or by one */

export type array_operation  = 
  | "array-push"   /** @param {any} value - push the given value to the field */
  | "array-delete" /** @param {number} index - delete the value at the given index @see https://www.php.net/manual/fr/function.array-splice */
  | "array-splice" /** @param {number[]} indexes - remove certains elements of the array field @see https://www.php.net/manual/fr/function.array-splice */

export type Operation<T> =
  | T extends string ? string_operation : never
  | T extends number ? number_operation : never
  | T extends Array<unknown> ? array_operation : never
  