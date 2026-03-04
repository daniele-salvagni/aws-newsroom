/**
 * AWS News API Client
 *
 * Fetches What's New articles from AWS public (undocumented) API.
 * Uses date-based pagination instead of year tags for reliability.
 */

import type { APIResponse, FetchOptions, FetchResult, NewsItem } from './types.js';
import { withRetry, deduplicateItems, sortByDateDesc, getItemYear, getItemDate } from './utils.js';
import { createLogger } from '../logger.js';

const logger = createLogger('aws-news-client');
const API_BASE = 'https://aws.amazon.com/api/dirs/items/search';
const DEFAULT_PAGE_SIZE = 2000; // Max reliable page size

/** Fetch news articles for a given year and page */
export async function fetchNews(options: FetchOptions): Promise<FetchResult> {
  const { year, page, pageSize = DEFAULT_PAGE_SIZE } = options;

  logger.info('Fetching news articles', { year, page, pageSize });

  const response = await fetchPage(page, pageSize);

  // Filter to items matching the requested year
  const yearItems = response.items.filter((item) => getItemYear(item) === year);

  // Deduplicate (shouldn't be needed, but defensive)
  const uniqueItems = deduplicateItems(yearItems);
  const duplicatesRemoved = yearItems.length - uniqueItems.length;

  // Sort by date descending
  const sortedItems = sortByDateDesc(uniqueItems);

  logger.info('News fetch completed', {
    year,
    page,
    totalFetched: response.items.length,
    matchingYear: sortedItems.length,
    duplicatesRemoved,
  });

  return {
    items: sortedItems,
    totalHits: response.metadata.totalHits,
  };
}

export interface DateRangeOptions {
  startDate: Date;
  endDate: Date;
  pageSize?: number;
}

/** Fetch all news articles within a date range */
export async function fetchNewsInDateRange(options: DateRangeOptions): Promise<NewsItem[]> {
  const { startDate, endDate, pageSize = DEFAULT_PAGE_SIZE } = options;

  logger.info('Fetching news in date range', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    pageSize,
  });

  const articles: NewsItem[] = [];

  for (let page = 1; ; page++) {
    const response = await fetchPage(page, pageSize);
    if (response.items.length === 0) break;

    let foundOlderThanStart = false;

    for (const item of response.items) {
      const publishedAt = getItemDate(item);

      // Skip articles newer than end date
      if (publishedAt > endDate) continue;

      // Stop collecting if we've gone past the start date
      if (publishedAt < startDate) {
        foundOlderThanStart = true;
        continue;
      }

      articles.push(item);
    }

    // If we found items older than start, no need to fetch more pages
    if (foundOlderThanStart) break;
  }

  logger.info('Date range fetch completed', { count: articles.length });
  return articles;
}

/** Fetch a page of articles without any tag filter */
async function fetchPage(page: number, pageSize: number): Promise<APIResponse> {
  return withRetry(async () => {
    const url = buildUrl(page, pageSize);
    logger.debug('Fetching from API', { url });
    const response = await fetch(url);

    if (!response.ok) {
      logger.error('API request failed', { status: response.status, url });
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json() as Promise<APIResponse>;
  });
}

/** Build AWS News API URL */
function buildUrl(page: number, pageSize: number): string {
  const url = new URL(API_BASE);
  url.searchParams.set('item.directoryId', 'whats-new-v2');
  url.searchParams.set('sort_by', 'item.additionalFields.postDateTime');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('item.locale', 'en_US');
  url.searchParams.set('size', pageSize.toString());
  url.searchParams.set('page', (page - 1).toString()); // API is 0-indexed
  return url.toString();
}
