import type { SearchOption } from "./searchOption.ts";

export interface SelectOption<T, K extends keyof T = keyof T> {
	/** Selected fields to be returned */
	fields: K[];
	/** Optional search filters to apply before selecting fields */
	search?: SearchOption<T>[];
}
