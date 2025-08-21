/** @ignore */
let _address: string | undefined = undefined;

/** @ignore */
let _token: string | undefined = undefined;

export const ID_FIELD_NAME = "id" as const;

export function address(newValue: string | undefined = undefined): string {
	if (newValue === undefined) {
		if (!_address) throw new Error("Firestorm address was not configured");
		return _address;
	}

	_address = !newValue.endsWith("/") ? newValue + "/" : newValue;
	return _address;
}

export function token(newValue: string | undefined = undefined): string {
	if (newValue === undefined) {
		if (!_token) throw new Error("Firestorm token was not configured");
		return _token;
	}

	_token = newValue;
	return _token;
}

export function POST(): string {
	if (!_address) throw new Error("Firestorm address was not configured");
	return _address + "post.php";
}

export function GET(): string {
	if (!_address) throw new Error("Firestorm address was not configured");
	return _address + "get.php";
}

export function FILES() {
	if (!_address) throw new Error("Firestorm address was not configured");
	return _address + "files.php";
}
