export type FlatItem = {
	id?: string;
	__typename?: string;
	__parentId?: string;
	[key: string]: unknown;
};

type TreeItem = Omit<FlatItem, '__parentId'> & {
	productVariants?: TreeItem[];
	metafields?: TreeItem[];
	children?: TreeItem[];
	[key: string]: unknown;
};

const convertTypenameToArrayKey = (typename: string): string => {
	return typename.charAt(0).toLowerCase() + typename.slice(1) + 's';
};

export const flatToTree = (flat: FlatItem[]): TreeItem[] => {
	const result: TreeItem[] = [];
	const itemsMap = new Map<string, Map<string, TreeItem>>();

	flat.forEach((item) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { __parentId, ...itemWithoutParent } = item;
		const typename = item.__typename || 'Unknown';

		if (!itemsMap.has(typename)) {
			itemsMap.set(typename, new Map());
		}

		itemsMap.get(typename)!.set(item.id!, { ...itemWithoutParent } as TreeItem);
	});

	flat.forEach((item) => {
		const typename = item.__typename || 'Unknown';
		const parentTypeMap = itemsMap.get(typename);
		if (!parentTypeMap) return;

		const currentItem = parentTypeMap.get(item.id!);
		if (!currentItem) return;

		if (item.__parentId) {
			let parent: TreeItem | null = null;
			for (const typeMap of itemsMap.values()) {
				if (typeMap.has(item.__parentId!)) {
					parent = typeMap.get(item.__parentId!)!;
					break;
				}
			}

			if (parent) {
				const arrayKey = item.__typename ? convertTypenameToArrayKey(item.__typename) : 'children';

				if (!parent[arrayKey]) {
					parent[arrayKey] = [];
				}

				(parent[arrayKey] as TreeItem[]).push(currentItem);
			}
		} else {
			result.push(currentItem);
		}
	});

	return result;
};
