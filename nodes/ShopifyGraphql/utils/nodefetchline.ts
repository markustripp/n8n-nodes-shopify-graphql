async function* streamToIterator(
	stream: ReadableStream<Uint8Array>,
): AsyncIterableIterator<Uint8Array> {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

const getChunkIteratorNode = async (
	filepath: string,
): Promise<AsyncIterableIterator<Uint8Array>> => {
	const protocol = new URL(filepath).protocol;
	if (protocol !== 'http:' && protocol !== 'https:') {
		throw new Error('Invalid protocol. The URL must start with "http://" or "https://"');
	}

	const response = await fetch(filepath);

	if (!response.ok) {
		throw new Error(`HTTP Status: ${response.status}`);
	}

	if (!response.body) {
		throw new Error('Response body is null');
	}

	return streamToIterator(response.body);
};

const escapeRegExp = (s: string): string => s.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');

export async function* nodefetchline(
	filepath: string,
	{
		includeLastEmptyLine = true,
		encoding = 'utf-8',
		delimiter = /\r?\n/g,
	}: {
		includeLastEmptyLine?: boolean;
		encoding?: string;
		delimiter?: string | RegExp;
	} = {},
): AsyncIterableIterator<string> {
	let reader: AsyncIterableIterator<Uint8Array>;
	try {
		reader = await getChunkIteratorNode(filepath);
	} catch {
		return;
	}

	let nextResult: IteratorResult<Uint8Array, void> = await reader.next();
	let chunk: Uint8Array | undefined = nextResult.done ? undefined : nextResult.value;
	let readerDone = nextResult.done;
	const decoder = new TextDecoder(encoding);
	let chunkStr = chunk ? decoder.decode(chunk) : '';

	let re: RegExp;
	if (typeof delimiter === 'string') {
		if (delimiter === '') {
			throw new Error('delimiter cannot be empty string!');
		}
		re = new RegExp(escapeRegExp(delimiter), 'g');
	} else if (!/g/.test(delimiter.flags)) {
		re = new RegExp(delimiter.source, delimiter.flags + 'g');
	} else {
		re = delimiter;
	}

	let startIndex = 0;

	while (1) {
		const result = re.exec(chunkStr);
		if (result === null) {
			if (readerDone === true) {
				break;
			}
			const remainder = chunkStr.substring(startIndex);
			nextResult = await reader.next();
			chunk = nextResult.done ? undefined : nextResult.value;
			readerDone = nextResult.done;
			chunkStr = remainder + (chunk ? decoder.decode(chunk) : '');
			startIndex = 0;
			continue;
		}
		yield chunkStr.substring(startIndex, result.index);
		startIndex = re.lastIndex;
	}

	if (includeLastEmptyLine || startIndex < chunkStr.length) {
		yield chunkStr.substring(startIndex);
	}
}
