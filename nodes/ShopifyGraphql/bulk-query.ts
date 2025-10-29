import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { jsonParse, sleep } from 'n8n-workflow';

import { flatToTree, type FlatItem } from './utils/json';
import { nodefetchline } from './utils/nodefetchline';
import { fetchShopify, SHOPIFY_BULK_POLL_INTERVAL, getQueryCurrentBulk } from './utils/shopify';

export const wrapBulkQuery = (query: string) => {
	return `mutation {
		bulkOperationRunQuery(
			query: """${query}"""
			) {
				bulkOperation {
					id
					status
				}
				userErrors {
					field
					message
				}
			}
		}`;
};

export async function executeBulkQuery(
	this: IExecuteFunctions,
	index: number,
	authentication: string,
	version: string,
	query: string,
): Promise<INodeExecutionData[]> {
	const bulkQueryOutput = this.getNodeParameter('bulkQueryOutput', index) as string;

	const response = await fetchShopify.call(this, authentication, version, query);
	const data = response.data.bulkOperationRunQuery;
	let bulkOperation;

	if (data.userErrors?.length > 0) {
		throw new Error(
			`Error running bulk query (item: ${index}): ${data.userErrors.map((e: IDataObject) => e.message).join(', ')}`,
		);
	} else {
		bulkOperation = data.bulkOperation;

		while (bulkOperation.status === 'CREATED' || bulkOperation.status === 'RUNNING') {
			await sleep(SHOPIFY_BULK_POLL_INTERVAL);
			const bulkStatus = await fetchShopify.call(
				this,
				authentication,
				version,
				getQueryCurrentBulk('QUERY'),
			);
			bulkOperation = bulkStatus.data.currentBulkOperation;
		}
	}

	const lineIterator = nodefetchline(bulkOperation.url);
	let responseData = [];
	for await (const line of lineIterator) {
		if (line.length > 0) {
			responseData.push(jsonParse(line));
		}
	}

	if (bulkQueryOutput === 'tree') {
		responseData = flatToTree(responseData as FlatItem[]);
	}

	return this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(responseData as IDataObject[]),
		{ itemData: { item: index } },
	);
}
