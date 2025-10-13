import { type IExecuteFunctions, type INodeExecutionData } from 'n8n-workflow';

import { executeBulkQuery, wrapBulkQuery } from './bulk-query';
import { executeGraphql } from './graqhql';

export async function executeItem(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const authentication = this.getNodeParameter('authentication', index) as string;
	const version = this.getNodeParameter('version', index) as string;
	const bulk = this.getNodeParameter('resource', index) === 'bulk';

	if (bulk) {
		const bulkOperation = this.getNodeParameter('operation', index);
		if (bulkOperation === 'query') {
			const query = wrapBulkQuery(this.getNodeParameter('bulkQuery', index) as string);
			return await executeBulkQuery.call(this, index, authentication, version, query);
		}

		throw new Error(`Invalid bulk operation ${bulkOperation} for executeItem ${index}`);
	}

	return await executeGraphql.call(this, index, authentication, version);
}
