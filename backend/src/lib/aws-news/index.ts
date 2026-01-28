/**
 * AWS News Client
 *
 * Clean, defensive client for fetching AWS What's New articles.
 */

export { fetchNews, TAG_FORMATS } from './client.js';
export type {
  NewsItem,
  Tag,
  APIResponse,
  FetchOptions,
  FetchResult,
  FetchDiagnostics,
  MismatchedItem,
} from './types.js';
export {
  deduplicateItems,
  sortByDateDesc,
  getItemDate,
  getItemYear,
  extractYearTags,
} from './utils.js';
