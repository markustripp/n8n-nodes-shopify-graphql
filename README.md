# n8n-nodes-shopify-graphql

A custom n8n community node for performing [Shopify GraqhQL Queries](https://shopify.dev/docs/api/admin-graphql) and [bulk operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) directly within your workflows.

With this node, you can manage any Shopify Admin resource — such as products, inventory, metafields, and store settings — through a native, code-free n8n interface.

It also supports Shopify Bulk Operations, allowing you to perform large-scale data operations asynchronously, without worrying about pagination or rate limits.

🎥 Video guide: Check out my YouTube walkthrough explaining the Shopify GraphQL node usage and setup.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Compatibility](#compatibility)
- [Usage](#usage)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

- Shopify GraphQL Query → [Shopify GraphQL Documentation](https://shopify.dev/docs/api/admin-graphql)
- Shopify Bulk Query → [Shopify Bulk Query Documentation](https://shopify.dev/docs/api/usage/bulk-operations/queries)
- Shopify Bulk Mutation → [Shopify Bulk Mutation Documentation](https://shopify.dev/docs/api/usage/bulk-operations/imports)

## Credentials

This node uses the same credentials as the built-in Shopify integration in n8n.

To set them up, follow the instructions here:

👉 [Shopify Credential Setup](https://docs.n8n.io/integrations/builtin/credentials/shopify/)

Once configured, all your Shopify nodes (REST or GraphQL) can share these credentials.

## Compatibility

- Tested with n8n version 1.113+
- Written in TypeScript
- Compatible with both cloud and self-hosted n8n instances

## Usage

### Shopify GraphQL

Shopify provides two APIs to interact with store data:

1. [Admin REST API (Deprecated)](https://shopify.dev/docs/api/admin-rest)
2. [Admin GraqhQL API (Recommended)](https://shopify.dev/docs/api/admin-graphql)

The GraphQL API is the recommended choice — it gives access to all store data and new platform features, while the REST API is no longer updated.

You can quickly prototype your queries using the [Shopify GraphQL Explorer](https://shopify.dev/docs/api/usage/api-exploration/admin-graphiql-explorer).

![n8n-graphql-shopify](https://github.com/user-attachments/assets/1eb1b7cb-9169-415c-825f-21ed41936944)

Once you have a working query, copy the GraphQL code into the Shopify GraphQL node in n8n.

![n8n-graphql-editor](https://github.com/user-attachments/assets/8a0550c4-4057-44e1-b759-0dce139302bb)

### Shopify Bulk Query

The standard GraphQL API requires pagination when working with large datasets. For example, you can’t fetch all products or variants in one call.

Additionally, [rate-limiting](https://shopify.dev/docs/api/usage/limits) applies to standard queries.

[Bulk operations](https://shopify.dev/docs/api/usage/bulk-operations/queries) solve this by letting you run large queries asynchronously on Shopify’s servers. Once complete, Shopify provides a download URL to retrieve the results.

This node provides a simple interface to trigger and handle these bulk operations from n8n.

![n8n-graphql-bulk](https://github.com/user-attachments/assets/bf5f4f8e-ca6e-4a64-9bce-661f8906f71c)

> [!NOTE]
> Example: Fetching 5,242 products using a bulk query took only 7 seconds. The result is returned in JSONL format — which is line-delimited JSON — making it easy to handle large datasets efficiently. You can also enable the Hierarchy option to automatically reconstruct parent–child relationships in the result.

### Shopify Bulk Mutation

[Bulk Mutations](https://shopify.dev/docs/api/usage/bulk-operations/imports) allow you to create or update thousands of resources (e.g., products, inventory items, metafields) with one operation.

These mutations usually involve:

1. Preparing a .jsonl input file
2. Uploading it to Shopify
3. Executing the mutation referencing the uploaded file
4. Waiting for Shopify to finalize the bulk job

![n8n-shopify-bulk-mutation](https://github.com/user-attachments/assets/7382a647-af13-4508-bb09-813c3ca2b36f)

> [!NOTE]
> Example: You can use Shopify’s productSet mutation to create or update products in bulk depending on whether the ID or handle exists.

### Advanced Example: Update the Inventory of All Products Using Bulk Query and Mutation

This example demonstrates the full potential of Shopify Bulk Operations in n8n:

Workflow Overview

1. Bulk Query: Fetch all products and variants
2. Transformation: Increase stock quantity by 1
3. Bulk Mutation: Push updated inventory back to Shopify

Total Execution Time: Fetch, transform, and update 5,242 products → ~12 minutes (726 seconds)

#### Step 1: Fetch All Products (Bulk Query)

![n8n-graphql-editor-query](https://github.com/user-attachments/assets/5a54cd20-1d16-4552-858c-28141c0d8be1)

When building queries, include \_\_typename fields to maintain parent–child relationships when “hierarchy mode” is enabled in n8n.

```graphql
query VideoBulkProducts {
	products {
		edges {
			node {
				id
				handle
				title
				totalInventory
				options {
					name
					values
				}
				__typename
				variants {
					edges {
						node {
							id
							title
							inventoryQuantity
							price
							__typename
							selectedOptions {
								name
								value
							}
							metafields {
								edges {
									node {
										id
										key
										value
										__typename
									}
								}
							}
						}
					}
				}
				metafields {
					edges {
						node {
							id
							key
							value
							__typename
						}
					}
				}
			}
		}
	}
}
```

#### Step 2: Prepare Bulk Mutation Input

Use the bulk mutation option to generate bulk input data:

![n8n-graphql-editor-mutation](https://github.com/user-attachments/assets/66f2d51a-f43d-4700-9695-e172c9460fac)

#### Step 3: Execute Bulk Mutation in n8n

Finally, pass the generated .jsonl data into the Shopify Bulk Mutation node and execute the workflow to apply updates.

![n8n-graphql-editor-graphql](https://github.com/user-attachments/assets/97d032a4-e424-4da3-aabe-843dce750c73)

#### Expression:

```javascript
{
  "input": {
    "id": "{{ $json.id }}",
    "productOptions": {{ JSON.stringify($json.options?.map((option) => ({
      "name": option.name,
      "values": option.values.map((value) => ({
        "name": value
      }))
    })))}},
    "variants": {{ JSON.stringify($json.productVariants?.map((variant) => ({
        "optionValues": variant.selectedOptions?.map((option) => ({
          "optionName": option.name,
          "name": option.value
        })),
        "price": variant.price,
        "metafields": variant.metafields?.map((metafield) => ({
          "id": metafield.id,
          "key": metafield.key,
          "value": metafield.value
        })),
        "inventoryItem": {
          "tracked": true
        },
        "inventoryQuantities": [
          {
            "locationId": "gid://shopify/Location/1234567890",
            "name": "available",
            "quantity": variant.inventoryQuantity + 1
          }
        ]
      })))
    }}
  }
}
```

#### Shopify GraphQL Explorer for Prototyping

Before creating the n8n workflow, use the Shopify GraphQL Explorer to test your queries and mutations.

1. Fetching Products:

![n8n-graphql-inventory-query](https://github.com/user-attachments/assets/d1ae5441-79d0-4719-9c8d-e838eeb4a3a4)

2. Updating Products:

![n8n-graphql-inventory-mutation](https://github.com/user-attachments/assets/651c8b89-d7e7-4068-a01a-570a00b7b096)

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Shopify GraphQL Docs](https://shopify.dev/docs/api/admin-graphql)
- [Shopify Bulk Operations Guide](https://shopify.dev/docs/api/usage/bulk-operations)
- [Shopify API Explorer](https://shopify.dev/docs/api/usage/api-exploration/admin-graphiql-explorer)
