/**
 * AWS News Client
 *
 * Simple client for fetching AWS What's New articles by date.
 */

export { fetchNews, fetchNewsInDateRange } from './client.js';
export type { NewsItem, Tag, APIResponse, FetchOptions, FetchResult } from './types.js';
export { deduplicateItems, sortByDateDesc, getItemDate, getItemYear } from './utils.js';
