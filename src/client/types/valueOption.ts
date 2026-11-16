export interface ValueOption<T, Key extends keyof T = keyof T, Flatten extends boolean = boolean> {
	/** Field to search */
	field: Key;
	/**
	 * Flatten array fields?
	 * @default false
	 */
	flatten?: Flatten;
}

export type ValueReturnType<
	T,
	Key extends keyof T,
	Flatten extends boolean | undefined = false,
> = T[Key] extends (infer Element)[] ? (Flatten extends true ? Element[] : T[Key][]) : T[Key][];
