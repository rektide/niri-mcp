import { z } from "zod";

export interface FilterOptions {
	include?: string[];
	exclude?: string[];
}

export interface RowFilter {
	field: string;
	operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains" | "startsWith" | "endsWith";
	value: unknown;
}

export interface QueryOptions extends FilterOptions {
	filter?: RowFilter[];
}

function pickKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const key of keys) {
		if (key in obj) {
			result[key] = obj[key];
		}
	}
	return result;
}

function omitKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	const result = { ...obj };
	for (const key of keys) {
		delete result[key];
	}
	return result;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const keys = path.split(".");
	let value: unknown = obj;
	for (const key of keys) {
		if (value && typeof value === "object" && key in value) {
			value = (value as Record<string, unknown>)[key];
		} else {
			return undefined;
		}
	}
	return value;
}

export function filterColumns<T extends Record<string, unknown>>(
	data: T | T[],
	options: FilterOptions,
): T | T[] {
	const isArray = Array.isArray(data);
	const items = isArray ? data : [data];

	const filtered = items.map((item) => {
		if (options.include && options.include.length > 0) {
			return pickKeys(item, options.include) as T;
		}
		if (options.exclude && options.exclude.length > 0) {
			return omitKeys(item, options.exclude) as T;
		}
		return item;
	});

	return (isArray ? filtered : filtered[0]) as T | T[];
}

export function filterRows<T extends Record<string, unknown>>(
	data: T[],
	filters: RowFilter[],
): T[] {
	if (!filters || filters.length === 0) {
		return data;
	}

	return data.filter((item) => {
		return filters.every(({ field, operator, value }) => {
			const itemValue = getNestedValue(item, field);

			switch (operator) {
				case "eq":
					return itemValue === value;
				case "ne":
					return itemValue !== value;
				case "gt":
					return typeof itemValue === "number" && typeof value === "number" && itemValue > value;
				case "lt":
					return typeof itemValue === "number" && typeof value === "number" && itemValue < value;
				case "gte":
					return typeof itemValue === "number" && typeof value === "number" && itemValue >= value;
				case "lte":
					return typeof itemValue === "number" && typeof value === "number" && itemValue <= value;
				case "contains":
					return typeof itemValue === "string" && typeof value === "string" && itemValue.includes(value);
				case "startsWith":
					return typeof itemValue === "string" && typeof value === "string" && itemValue.startsWith(value);
				case "endsWith":
					return typeof itemValue === "string" && typeof value === "string" && itemValue.endsWith(value);
				default:
					return false;
			}
		});
	});
}

export function query<T extends Record<string, unknown>>(
	data: T[],
	options: QueryOptions,
): T[] {
	let result = data;

	if (options.filter && options.filter.length > 0) {
		result = filterRows(result, options.filter);
	}

	if (options.include || options.exclude) {
		result = filterColumns(result, options) as T[];
	}

	return result;
}

export const filterOptionsSchema = z.object({
	include: z.array(z.string()).optional(),
	exclude: z.array(z.string()).optional(),
});

export const rowFilterSchema = z.object({
	field: z.string(),
	operator: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "startsWith", "endsWith"]),
	value: z.unknown(),
});

export const queryOptionsSchema = filterOptionsSchema.extend({
	filter: z.array(rowFilterSchema).optional(),
});
