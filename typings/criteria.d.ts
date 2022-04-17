export type arr_response =
  | "in"
  | "array-contains-any"
  | "object-contains-any"

export type obj_response =
  | "is"

export type math_operator = 
  | "==" 
  | "!=" 
  | "<" 
  | "<=" 
  | ">" 
  | ">="
  | "in";

export type str_operator = 
  | "==" 
  | "!=" 
  | "<" 
  | "<=" 
  | ">" 
  | ">="
  | "in"
  | "includes"
  | "contains" // same as "includes"
  | "startsWith"
  | "endsWith";

export type arr_operator =
  | "array-contains" 
  | "array-contains-any" 
  | "array-length-eq" 
  | "array-length-df" 
  | "array-length-gt" 
  | "array-length-lt" 
  | "array-length-ge" 
  | "array-length-le";

export type bool_operator = 
  | "!=" 
  | "==";

export type obj_operator = 
  | "has" 
  | "is"
  | "in"
  | "object-contains-any";

export type any_operator = str_operator | arr_operator | bool_operator | obj_operator | math_operator;

export type Criteria<T> = 
  | T extends string ? str_operator : never
  | T extends number ? math_operator : never
  | T extends boolean ? bool_operator : never
  | T extends Array<unknown> ? arr_operator : never
  | T extends Function ? never : never
  | T extends object ? obj_operator : never
