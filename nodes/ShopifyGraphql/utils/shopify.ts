import {
	jsonParse,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type IOAuth2Options,
} from 'n8n-workflow';

export const SHOPIFY_BULK_POLL_INTERVAL = 1000;

export async function fetchShopify(
	this: IExecuteFunctions,
	authentication: string,
	version: string,
	query: string,
	variables?: string | null,
) {
	let credentials;
	let credentialType;

	if (authentication === 'apiKey') {
		credentials = await this.getCredentials('shopifyApi');
		credentialType = 'shopifyApi';
	} else if (authentication === 'accessToken') {
		credentials = await this.getCredentials('shopifyAccessTokenApi');
		credentialType = 'shopifyAccessTokenApi';
	} else {
		credentials = await this.getCredentials('shopifyOAuth2Api');
		credentialType = 'shopifyOAuth2Api';
	}

	const url = `https://${credentials.shopSubdomain}.myshopify.com/admin/api/${version}/graphql.json`;
	const oAuth2Options: IOAuth2Options = {
		tokenType: 'Bearer',
		keyToIncludeInAccessTokenHeader: 'X-Shopify-Access-Token',
	};

	const body: { query: string; variables?: string | null } = {
		query,
	};
	if (variables) {
		body.variables = jsonParse(variables);
	}

	const options: IHttpRequestOptions = {
		method: 'POST',
		url,
		body: JSON.stringify(body),
		json: true,
	};

	if (authentication === 'apiKey') {
		Object.assign(options, {
			auth: { username: credentials.apiKey, password: credentials.password },
		});
	}

	return await this.helpers.requestWithAuthentication.call(this, credentialType, options, {
		oauth2: oAuth2Options,
	});
}

export const getQueryCurrentBulk = (type: 'MUTATION' | 'QUERY') => `
query {
  currentBulkOperation(type: ${type}) {
    id
    status
    errorCode
    createdAt
    completedAt
    objectCount
    fileSize
    url
    partialDataUrl
  }
}
`;
