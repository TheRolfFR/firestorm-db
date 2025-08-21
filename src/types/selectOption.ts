export interface SelectOption<T> {
	/** Selected fields to be returned */
	fields: (keyof T)[];
}
