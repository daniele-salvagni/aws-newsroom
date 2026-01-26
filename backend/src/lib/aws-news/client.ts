/**
 * AWS News API Client
 *
 * Fetches What's New articles from AWS public (not documented) API.
 * Handles tag format inconsistencies defensively by trying multiple formats.
 */

import type {
  APIResponse,
  FetchOptions,
  FetchResult,
  FetchDiagnostics,
  MismatchedItem,
  NewsItem,
} from './types.js';
import {
  withRetry,
  deduplicateItems,
  sortByDateDesc,
  getItemYear,
  extractYearTags,
} from './utils.js';
import { createLogger } from '../logger.js';

const logger = createLogger('aws-news-client');
const API_BASE = 'https://aws.amazon.com/api/dirs/items/search';
const DEFAULT_PAGE_SIZE = 100;

/**
 * Tag format patterns observed in the API.
 * AWS has changed these over time, so we try multiple formats defensively.
 */
const TAG_FORMATS = {
  standard: (year: number) => `whats-new-v2#year#${year}`,
  global: (year: number) => `GLOBAL#local-tags-whats-new-v2-year#${year}`,
} as const;

type TagFormat = keyof typeof TAG_FORMATS;

/** Fetch news articles for a given year and page */
export async function fetchNews(options: FetchOptions): Promise<FetchResult> {
  const { year, page, pageSize = DEFAULT_PAGE_SIZE } = options;

  logger.info({ year, page, pageSize }, 'Fetching news articles');

  const diagnostics: FetchDiagnostics = {
    year,
    tagFormatsUsed: [],
    tagFormatResults: {},
    itemsWithMismatchedYearTag: [],
    duplicatesRemoved: 0,
    totalItemsFetched: 0,
  };

  // Try all tag formats and merge results
  const allItems: NewsItem[] = [];

  for (const [formatName, formatFn] of Object.entries(TAG_FORMATS)) {
    const tagId = formatFn(year);
    diagnostics.tagFormatsUsed.push(formatName);

    try {
      const response = await fetchWithTag(tagId, page, pageSize);
      diagnostics.tagFormatResults[formatName] = response.items.length;
      allItems.push(...response.items);
      logger.debug({ formatName, itemCount: response.items.length }, 'Tag format fetch succeeded');
    } catch (err) {
      diagnostics.tagFormatResults[formatName] = 0;
      logger.warn({ formatName, year, error: err }, 'Tag format fetch failed');
    }
  }

  diagnostics.totalItemsFetched = allItems.length;

  // Deduplicate (same item may appear in multiple tag formats)
  const uniqueItems = deduplicateItems(allItems);
  diagnostics.duplicatesRemoved = allItems.length - uniqueItems.length;

  // Find items with mismatched year tags (for diagnostics)
  diagnostics.itemsWithMismatchedYearTag = findMismatchedItems(uniqueItems, year);

  // Sort by date descending
  const sortedItems = sortByDateDesc(uniqueItems);

  logger.info(
    {
      year,
      page,
      totalItems: sortedItems.length,
      duplicatesRemoved: diagnostics.duplicatesRemoved,
      mismatchedItems: diagnostics.itemsWithMismatchedYearTag.length,
    },
    'News fetch completed'
  );

  return {
    items: sortedItems,
    totalHits: sortedItems.length,
    diagnostics,
  };
}

/** Fetch from API with a specific tag ID */
async function fetchWithTag(tagId: string, page: number, pageSize: number): Promise<APIResponse> {
  return withRetry(async () => {
    const url = buildUrl(tagId, page, pageSize);
    logger.debug({ url }, 'Fetching from API');
    const response = await fetch(url);

    if (!response.ok) {
      logger.error({ status: response.status, url }, 'API request failed');
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json() as Promise<APIResponse>;
  });
}

/** Build AWS News API URL with query parameters */
function buildUrl(tagId: string, page: number, pageSize: number): string {
  const url = new URL(API_BASE);
  url.searchParams.set('item.directoryId', 'whats-new-v2');
  url.searchParams.set('sort_by', 'item.additionalFields.postDateTime');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('item.locale', 'en_US');
  url.searchParams.set('size', pageSize.toString());
  url.searchParams.set('page', (page - 1).toString());
  url.searchParams.set('tags.id', tagId);
  return url.toString();
}

/** Find items where the actual year doesn't match the queried year */
function findMismatchedItems(items: NewsItem[], expectedYear: number): MismatchedItem[] {
  const mismatched: MismatchedItem[] = [];

  for (const item of items) {
    const actualYear = getItemYear(item);
    const taggedYears = extractYearTags(item.tags);

    // Item's actual date year doesn't match the year we queried for
    if (actualYear !== expectedYear) {
      mismatched.push({
        id: item.item.id,
        headline: item.item.additionalFields.headline ?? '',
        postDateTime: item.item.additionalFields.postDateTime ?? '',
        actualYear,
        taggedYears,
      });
    }
  }

  return mismatched;
}

export { TAG_FORMATS };
