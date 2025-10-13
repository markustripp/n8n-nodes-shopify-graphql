import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

import { executeBulkMutation } from './bulk-mutation';
import { executeItem } from './operation';

export class ShopifyGraphql implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ShopifyGraphql',
		name: 'shopifyGraphql',
		icon: 'file:shopify.svg',
		group: ['transform'],
		version: 1,
		description: 'Create Shopify GraqhQL Queries and bulk operations',
		defaults: {
			name: 'ShopifyGraphql',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: shopifyCredentials,
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Access Token',
						value: 'accessToken',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
					{
						name: 'API Key',
						value: 'apiKey',
					},
				],
				default: 'apiKey',
			},
			{
				displayName: 'Shopify API Version',
				name: 'version',
				type: 'string',
				default: '2025-07',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'GraphQL',
						description:
							'Standard Shopify GraphQL Query. Please note that there are pagination and rate limits.',
						value: 'graphql',
					},
					{
						name: 'Bulk',
						description:
							"Runs Shopify GraphQL Queries asynchronously as bulk operations on Shopify's servers. No pagination and rate limits.",
						value: 'bulk',
					},
				],
				default: 'graphql',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['graphql'],
					},
				},
				options: [
					{
						name: 'Query',
						value: 'query',
						description: 'Shopify GraphQL query to fetch data as JSON',
						action: 'Query',
					},
					{
						name: 'Mutation',
						value: 'mutation',
						description: 'Shopify GraphQL mutation to create, update or delete data',
						action: 'Mutation',
					},
				],
				default: 'query',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['bulk'],
					},
				},
				options: [
					{
						name: 'Bulk Query',
						value: 'query',
						description:
							"Run a Shopify Bulk Query asynchronously on Shopify's servers. No pagination and rate limits.",
						action: 'Bulk query',
					},
					{
						name: 'Bulk Mutation / Import',
						value: 'mutation',
						description:
							'Combines all inputs into a single bulk mutation and passes it as JSONL file to Shopify for anychronous processing. Update large data sets without rate limits or pagination/cursors.',
						action: 'Bulk mutation',
					},
				],
				default: 'query',
			},
			...graqhqlOperations,
			...bulkOperations,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		const bulkMutation = resource === 'bulk' && operation === 'mutation';
		const bulkMutationJSONL = [];

		for (let i = 0; i < items.length; i++) {
			try {
				if (bulkMutation) {
					const json = this.getNodeParameter('bulkMutationVariables', i) as string;
					bulkMutationJSONL.push(JSON.stringify(JSON.parse(json)) + '\n');
				} else {
					const responseData = await executeItem.call(this, i);
					returnData.push(...responseData);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: error.message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}

				if (error instanceof NodeApiError && error?.context?.itemIndex === undefined) {
					if (error.context === undefined) {
						error.context = {};
					}
					error.context.itemIndex = i;
				}
				throw error;
			}
		}

		if (bulkMutation) {
			const responseData = await executeBulkMutation.call(this, bulkMutationJSONL);
			returnData.push(...responseData);
		}

		return [returnData];
	}
}

const shopifyCredentials = [
	{
		name: 'shopifyApi',
		required: true,
		displayOptions: {
			show: {
				authentication: ['apiKey'],
			},
		},
	},
	{
		name: 'shopifyAccessTokenApi',
		required: true,
		displayOptions: {
			show: {
				authentication: ['accessToken'],
			},
		},
	},
	{
		name: 'shopifyOAuth2Api',
		required: true,
		displayOptions: {
			show: {
				authentication: ['oAuth2'],
			},
		},
	},
];

const graqhqlOperations: INodeProperties[] = [
	{
		displayName: 'Query',
		name: 'graphqlQuery',
		type: 'string',
		default: `query Products {
  products(first: 2) {
    edges {
      node {
        id
        handle
        title
      }
    }
  }
}`,
		description: 'GraphQL query',
		required: true,
		typeOptions: {
			rows: 10,
		},
		displayOptions: {
			show: {
				resource: ['graphql'],
				operation: ['query'],
			},
		},
	},
	{
		displayName: 'Variables',
		name: 'graphqlQueryVariables',
		type: 'json',
		default: '{}',
		description: 'Query variables as JSON object',
		displayOptions: {
			show: {
				resource: ['graphql'],
				operation: ['query'],
			},
		},
	},
	{
		displayName: 'Mutation',
		name: 'graphqlMutation',
		type: 'string',
		default: `mutation productUpdate($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product {
      id
      title
    }
    userErrors {
      field
      message
    }
  }
}`,
		description: 'GraphQL mutation',
		required: true,
		typeOptions: {
			rows: 10,
		},
		displayOptions: {
			show: {
				resource: ['graphql'],
				operation: ['mutation'],
			},
		},
	},
	{
		displayName: 'Variables',
		name: 'graphqlMutationVariables',
		type: 'json',
		default: `{
  "product": {
    "id": "{{ $json.node.id }}",
    "title": "{{ $json.node.title + 'X' }}"
  }
}`,
		description: 'Query variables as JSON object',
		displayOptions: {
			show: {
				resource: ['graphql'],
				operation: ['mutation'],
			},
		},
	},
];

const bulkOperations: INodeProperties[] = [
	{
		displayName: 'Output',
		name: 'bulkQueryOutput',
		type: 'options',
		default: 'flat',
		options: [
			{
				name: 'Flat',
				value: 'flat',
				description:
					'By default, Shopify returns the hierarchy as a deconstructed array-like response where children have a __parentId element pointing to their parents',
			},
			{
				name: 'Hierarchy',
				value: 'tree',
				description:
					'Re-create the hierarchy from the array-like response by moving children to their parents using __parentId and grouping them by __typename',
			},
		],
		displayOptions: {
			show: {
				resource: ['bulk'],
				operation: ['query'],
			},
		},
	},
	{
		displayName: 'Bulk Query',
		name: 'bulkQuery',
		type: 'string',
		default: `query Products {
  products {
    edges {
      node {
        id
        handle
        title
      }
    }
  }
}`,
		description: 'GraphQL query to be used in a bulkOperationRunQuery',
		required: true,
		typeOptions: {
			rows: 10,
		},
		displayOptions: {
			show: {
				resource: ['bulk'],
				operation: ['query'],
			},
		},
	},
	{
		displayName: 'Bulk Mutation / Import',
		name: 'bulkMutation',
		type: 'string',
		default: `mutation productSet($input: ProductSetInput!) {
  productSet(input: $input) {
    product {
      id
      handle
      title
    }
    productSetOperation {
      id
      status
      userErrors {
        code
        field
        message
      }
    }
    userErrors {
      code
      field
      message
    }
  }
}`,
		description:
			'GraphQL bulk mutation. Combines all inputs into a single bulkOperationRunMutation and passes it as JSONL file to Shopify for anychronous processing.',
		required: true,
		typeOptions: {
			rows: 10,
		},
		displayOptions: {
			show: {
				resource: ['bulk'],
				operation: ['mutation'],
			},
		},
	},
	{
		displayName: 'Bulk Mutation Variables',
		name: 'bulkMutationVariables',
		type: 'json',
		default: `{
  "input": {
    "id": "{{ $json.id }}",
    "title": "{{ $json.title + 'X' }}"
  }
}`,
		description: 'Mutation variables as JSON object',
		displayOptions: {
			show: {
				resource: ['bulk'],
				operation: ['mutation'],
			},
		},
	},
];
