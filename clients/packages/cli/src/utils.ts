export const slugify = (...args: string[]): string => {
	const value = args.join(" ");

	return value
		.normalize("NFD") // split an accented letter in the base letter and the acent
		.replace(/[\u0300-\u036f]/g, "") // remove all previously split accents
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9 ]/g, "") // remove all chars not letters, numbers and spaces (to be replaced)
		.replace(/\s+/g, "-"); // separator
};

/**
 * Same as Promise.all(items.map(item => task(item))), but it waits for
 * the first {batchSize} promises to finish before starting the next batch.
 *
 * @template A
 * @template B
 * @param {function(A): B} task The task to run for each item.
 * @param {A[]} items Arguments to pass to the task for each call.
 * @param {int} batchSize
 * @returns {Promise<B[]>}
 */
export async function promiseAllInBatches<A, B>(
	task: (item: A) => Promise<B>,
	items: A[],
	batchSize: number,
) {
	let position = 0;
	let results: B[] = [];
	while (position < items.length) {
		const itemsForBatch = items.slice(position, position + batchSize);
		results = [
			...results,
			...(await Promise.all(itemsForBatch.map((item) => task(item)))),
		];
		position += batchSize;
	}
	return results;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(
	fn: () => Promise<T>,
	maxRetries = 5,
	baseDelay = 1000,
): Promise<T> => {
	let lastError: unknown;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt < maxRetries) {
				const delay = baseDelay * 2 ** attempt;
				await sleep(delay);
			}
		}
	}
	throw lastError;
};

export const fetchAllPages = async <T>(
	task: (pageNumber: number) => Promise<{
		data?: T[] | undefined;
		lastPage: number;
	}>,
	options: { batchSize?: number; delayMs?: number } = {},
): Promise<T[]> => {
	const { batchSize = 5, delayMs = 250 } = options;

	const firstPage = await withRetry(() => task(1));
	const allItems: T[] = [...(firstPage.data ?? [])];

	if (!firstPage.data || firstPage.lastPage <= 1) {
		return allItems;
	}

	const remainingPages = Array.from(
		{ length: firstPage.lastPage - 1 },
		(_, i) => i + 2,
	);

	for (let i = 0; i < remainingPages.length; i += batchSize) {
		const batch = remainingPages.slice(i, i + batchSize);
		const results = await Promise.all(
			batch.map((pageNumber) => withRetry(() => task(pageNumber))),
		);
		for (const result of results) {
			allItems.push(...(result.data ?? []));
		}
		if (i + batchSize < remainingPages.length) {
			await sleep(delayMs);
		}
	}

	return allItems;
};
