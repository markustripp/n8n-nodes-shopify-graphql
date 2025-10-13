import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { fetchShopify } from './utils/shopify';

export async function executeGraphql(
	this: IExecuteFunctions,
	index: number,
	authentication: string,
	version: string,
): Promise<INodeExecutionData[]> {
	const isQuery = this.getNodeParameter('operation', index) === 'query';
	const query = isQuery 
		? this.getNodeParameter('graphqlQuery', index) as string 
		: this.getNodeParameter('graphqlMutation', index) as string;
	const variables = isQuery 
		? this.getNodeParameter('graphqlQueryVariables', index) as string 
		: this.getNodeParameter('graphqlMutationVariables', index) as string;

	const responseData = await fetchShopify.call(
		this,
		authentication,
		version,
		query,
		variables,
	);

	return this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(responseData as IDataObject[]),
		{ itemData: { item: index } },
	);
}
