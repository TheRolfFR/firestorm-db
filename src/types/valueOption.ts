export interface ValueOption<Keys> {
	/** Field to search */
	field: Keys;
	/**
	 * Flatten array fields?
	 * @default false
	 */
	flatten?: boolean;
}
