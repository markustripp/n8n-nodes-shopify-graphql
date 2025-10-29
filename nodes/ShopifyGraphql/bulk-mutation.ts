import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { jsonParse, sleep } from 'n8n-workflow';

import { nodefetchline } from './utils/nodefetchline';
import { fetchShopify, SHOPIFY_BULK_POLL_INTERVAL, getQueryCurrentBulk } from './utils/shopify';

export async function executeBulkMutation(
	this: IExecuteFunctions,
	jsonl: string[],
): Promise<INodeExecutionData[]> {
	const authentication = this.getNodeParameter('authentication', 0) as string;
	const version = this.getNodeParameter('version', 0) as string;

	let mutation = this.getNodeParameter('bulkMutation', 0) as string;
	mutation = mutation ? mutation.replace(/\s+/g, ' ').trim() : '';

	let bulkOperation = null;

	const json = await fetchShopify.call(this, authentication, version, mutationStagedUploadsCreate);

	const targets = json.data.stagedUploadsCreate.stagedTargets;
	if (targets.length === 1) {
		const { url, parameters } = targets[0];
		let stagedUploadPath = '';

		const formData = new FormData();
		for (const parameter of parameters) {
			formData.append(parameter.name, parameter.value);
			if (parameter.name === 'key') {
				stagedUploadPath = parameter.value;
			}
		}
		const file = new Blob(jsonl, { type: 'text/jsonl' });
		formData.append('file', file);

		const response = await fetch(url, {
			method: 'POST',
			body: formData,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Error: ${response.statusText} ${errorText}`);
		}

		const jsonMutation = await fetchShopify.call(
			this,
			authentication,
			version,
			getMutationBulkRun(mutation, stagedUploadPath),
		);
		const bulk = jsonMutation.data.bulkOperationRunMutation;

		if (bulk.userErrors?.length > 0) {
			throw new Error(`Error: ${bulk.userErrors.map((e: IDataObject) => e.message).join(', ')}`);
		} else {
			bulkOperation = bulk.bulkOperation;

			while (bulkOperation.status === 'CREATED' || bulkOperation.status === 'RUNNING') {
				await sleep(SHOPIFY_BULK_POLL_INTERVAL);
				const jsonBulk = await fetchShopify.call(
					this,
					authentication,
					version,
					getQueryCurrentBulk('MUTATION'),
				);
				bulkOperation = jsonBulk.data.currentBulkOperation;
			}
		}
	}

	const lineIterator = nodefetchline(bulkOperation.url);
	const responseData = [];
	for await (const line of lineIterator) {
		if (line.length > 0) {
			responseData.push({ json: jsonParse(line) } as INodeExecutionData);
		}
	}

	return responseData;
}

const mutationStagedUploadsCreate = `
mutation {
  stagedUploadsCreate(input: {
    resource: BULK_MUTATION_VARIABLES,
    filename: "bulk_op_vars",
    mimeType: "text/jsonl",
    httpMethod: POST
  }){
    userErrors{
      field,
      message
    },
    stagedTargets{
      url,
      resourceUrl,
      parameters {
        name,
        value
      }
    }
  }
}
`;

const getMutationBulkRun = (mutation: string, stagedUploadPath: string) => `
mutation {
  bulkOperationRunMutation(
    mutation: "${mutation}",
    stagedUploadPath: "${stagedUploadPath}") {
    bulkOperation {
      id
      url
      status
    }
    userErrors {
      message
      field
    }
  }
}
`;
