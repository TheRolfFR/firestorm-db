/**
 * Extract data from the request response.
 * @template R - The type of the data to extract.
 * @param req - The request promise to extract data from.
 * @returns The extracted data.
 */
export async function extractData<R>(req: Promise<any> | any): Promise<R> {
	const res = await req; // does nothing if the request is already resolved

	if ("data" in res) return res.data;
	return res as R;
}
