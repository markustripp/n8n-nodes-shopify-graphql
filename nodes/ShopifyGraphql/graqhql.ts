import { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { fetchShopify } from './utils/shopify';

export async function executeGraphql(
	this: IExecuteFunctions,
	index: number,
	authentication: string,
	version: string,
): Promise<INodeExecutionData[]> {
	const graphqlQuery = this.getNodeParameter('graphqlQuery', index) as string;
	const graphqlVariables = this.getNodeParameter('graphqlVariables', index) as string;
	const responseData = await fetchShopify.call(
		this,
		authentication,
		version,
		graphqlQuery,
		graphqlVariables,
	);

	return this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray(responseData as IDataObject[]),
		{ itemData: { item: index } },
	);
}
