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
				displayName: 'Bulk Operation',
				name: 'bulk',
				type: 'boolean',
				default: false,
				description:
					"Whether to use Shopify's bulkOperationRunQuery or bulkOperationRunMutation to asychronously process large data sets without rate limits or pagination/cursors",
			},
			...graqhqlOperations,
			...bulkOperations,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const bulkMutation =
			this.getNodeParameter('bulk', 0) &&
			this.getNodeParameter('bulkOperation', 0) === 'bulkMutation';
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
  products(first: 10) {
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
				bulk: [false],
			},
		},
	},
	{
		displayName: 'Variables',
		name: 'graphqlVariables',
		type: 'json',
		default: '{}',
		description: 'Query variables as JSON object',
		displayOptions: {
			show: {
				bulk: [false],
			},
		},
	},
];

const bulkOperations: INodeProperties[] = [
	{
		displayName: 'Bulk Operation',
		name: 'bulkOperation',
		type: 'options',
		default: 'bulkQuery',
		options: [
			{
				name: 'Bulk Query',
				value: 'bulkQuery',
				description:
					'Run a bulk query without pagination or cursor. It automatically wraps a bulkOperationRunQuery and does not support custom variables.',
			},
			{
				name: 'Bulk Mutation / Import',
				value: 'bulkMutation',
				description:
					'It combines all inputs into a single bulk mutation and passes it as JSONL file to Shopify for anychronous processing. It automatically wraps a bulkOperationRunMutation.',
			},
		],
		displayOptions: {
			show: {
				bulk: [true],
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
				bulk: [true],
				bulkOperation: ['bulkQuery'],
			},
		},
	},
	{
		displayName: 'Output',
		name: 'bulkQueryOutput',
		type: 'options',
		default: 'flat',
		options: [
			{
				name: 'Flat (Raw Shopify JSONL Response)',
				value: 'flat',
				description:
					'By default, Shopify returns the tree hierarchy as a deconstructed array-like response where children have __parentId element pointing to their parents',
			},
			{
				name: 'Tree Hierarchy',
				value: 'tree',
				description:
					'Re-create the tree hierarchy from the array-like response by moving children to their parents using __parentId and grouping them by __typename',
			},
		],
		displayOptions: {
			show: {
				bulk: [true],
				bulkOperation: ['bulkQuery'],
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
				bulk: [true],
				bulkOperation: ['bulkMutation'],
			},
		},
	},
	{
		displayName: 'Bulk Mutation Variables / JSONL',
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
				bulk: [true],
				bulkOperation: ['bulkMutation'],
			},
		},
	},
];
