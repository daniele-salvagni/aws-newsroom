export interface AWSNewsAPIResponse {
  metadata: {
    count: number;
    totalHits: number;
  };
  fieldTypes?: any;
  items: Array<{
    item: {
      id: string;
      name: string;
      author?: string;
      dateCreated: string;
      dateUpdated: string;
      additionalFields: {
        // What's New fields
        headline?: string;
        headlineUrl?: string;
        postBody?: string;
        postDateTime?: string;
        postSummary?: string;
        regionalAvailability?: string;
        // Blog post fields
        title?: string;
        link?: string;
        postExcerpt?: string;
        contributors?: string;
        createdDate?: string;
        displayDate?: string;
        modifiedDate?: string;
        contentType?: string;
        slug?: string;
        featuredImageUrl?: string;
      };
    };
    tags: Array<{
      id: string;
      name: string;
      description: string;
    }>;
  }>;
}

type TagFormat = 'old' | 'new';

// Constants -------------------------------------------------------------------

const API_BASE_URL = 'https://aws.amazon.com/api/dirs/items/search';
const MAX_RETRIES = 5;
const TAG_FORMATS = {
  old: (year: number) => `whats-new-v2#year#${year}`,
  new: (year: number) => `GLOBAL#local-tags-whats-new-v2-year#${year}`,
} as const;

// Utility Functions -----------------------------------------------------------

/**
 * Retry a function with exponential backoff
 */
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      const delay = Math.pow(1.3, i) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Merge and deduplicate items from multiple API responses
 */
function mergeAndDeduplicateItems(responses: AWSNewsAPIResponse[]): AWSNewsAPIResponse['items'] {
  const seenIds = new Set<string>();
  const mergedItems: AWSNewsAPIResponse['items'] = [];

  for (const response of responses) {
    for (const item of response.items) {
      if (!seenIds.has(item.item.id)) {
        seenIds.add(item.item.id);
        mergedItems.push(item);
      }
    }
  }

  return mergedItems;
}

/**
 * Sort items by date descending (most recent first)
 */
function sortByDateDesc(items: AWSNewsAPIResponse['items']): void {
  items.sort((a, b) => {
    const dateA = new Date(
      a.item.additionalFields.postDateTime ||
        a.item.additionalFields.createdDate ||
        a.item.dateCreated
    );
    const dateB = new Date(
      b.item.additionalFields.postDateTime ||
        b.item.additionalFields.createdDate ||
        b.item.dateCreated
    );
    return dateB.getTime() - dateA.getTime();
  });
}

// What's New API --------------------------------------------------------------

/**
 * Fetch What's New articles with a specific year and tag format
 */
async function fetchWhatsNewWithTagFormat(params: {
  year: number;
  pageNumber: number;
  pageSize: number;
  tagFormat: TagFormat;
}): Promise<AWSNewsAPIResponse> {
  const { year, pageSize, pageNumber, tagFormat } = params;
  const url = new URL(API_BASE_URL);

  // Set common parameters
  url.searchParams.set('item.directoryId', 'whats-new-v2');
  url.searchParams.set('sort_by', 'item.additionalFields.postDateTime');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('item.locale', 'en_US');
  url.searchParams.set('size', pageSize.toString());
  url.searchParams.set('page', (pageNumber - 1).toString()); // Convert to 0-based

  // Set year tag based on format
  const tagId = TAG_FORMATS[tagFormat](year);
  url.searchParams.set('tags.id', tagId);

  const requestUrl = url.toString();
  console.log(`Fetching What's New API: ${requestUrl}`);

  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`What's New API request failed: ${response.status}`);
  }

  return response.json() as Promise<AWSNewsAPIResponse>;
}

/**
 * Fetch a page of What's New articles for a specific year
 */
export async function fetchPageOfNews(params: {
  year: number;
  pageNumber: number;
  pageSize: number;
}): Promise<AWSNewsAPIResponse> {
  return fetchWithRetry(async () => {
    const { year } = params;

    // Pre-2025: Use old tag format
    if (year <= 2024) {
      return fetchWhatsNewWithTagFormat({ ...params, tagFormat: 'old' });
    }

    // Post-2025: Use new tag format
    if (year >= 2026) {
      return fetchWhatsNewWithTagFormat({ ...params, tagFormat: 'new' });
    }

    // Year 2025: Transition year - fetch from both formats and merge
    const [oldFormatResult, newFormatResult] = await Promise.all([
      fetchWhatsNewWithTagFormat({ ...params, tagFormat: 'old' }),
      fetchWhatsNewWithTagFormat({ ...params, tagFormat: 'new' }),
    ]);

    // Merge and deduplicate items
    const mergedItems = mergeAndDeduplicateItems([oldFormatResult, newFormatResult]);

    // Sort by date
    sortByDateDesc(mergedItems);

    return {
      metadata: {
        count: mergedItems.length,
        totalHits: oldFormatResult.metadata.totalHits + newFormatResult.metadata.totalHits,
      },
      fieldTypes: oldFormatResult.fieldTypes,
      items: mergedItems,
    };
  });
}

// Blog Posts API --------------------------------------------------------------

/**
 * Fetch a page of AWS Blog posts
 *
 * @param categoryTag - Optional tag to filter by category (e.g., 'blog-posts#category#news')
 */
export async function fetchPageOfBlogs(params: {
  pageNumber: number;
  pageSize: number;
  categoryTag?: string;
}): Promise<AWSNewsAPIResponse> {
  return fetchWithRetry(async () => {
    const { pageSize, pageNumber, categoryTag } = params;
    const url = new URL(API_BASE_URL);

    // Set common parameters
    url.searchParams.set('item.directoryId', 'blog-posts');
    url.searchParams.set('item.locale', 'en_US');
    url.searchParams.set('sort_by', 'item.additionalFields.createdDate');
    url.searchParams.set('sort_order', 'desc');
    url.searchParams.set('size', pageSize.toString());
    url.searchParams.set('page', (pageNumber - 1).toString()); // Convert to 0-based

    // Filter by category tag if provided
    if (categoryTag) {
      url.searchParams.set('tags.id', categoryTag);
    }

    const requestUrl = url.toString();
    console.log(`Fetching Blog API: ${requestUrl}`);

    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(`Blog API request failed: ${response.status}`);
    }

    return response.json() as Promise<AWSNewsAPIResponse>;
  });
}
