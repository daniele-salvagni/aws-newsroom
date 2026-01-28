/**
 * Test fixtures for AWS News Client
 */

import type { APIResponse, NewsItem } from '../types.js';

export function createNewsItem(overrides: {
  id?: string;
  headline?: string;
  postDateTime?: string;
  tags?: Array<{ id: string; name: string }>;
}): NewsItem {
  const id = overrides.id ?? 'whats-new-v2#test-item';
  const headline = overrides.headline ?? 'Test Headline';
  const postDateTime = overrides.postDateTime ?? '2025-06-15T12:00:00Z';

  return {
    item: {
      id,
      name: id.split('#')[1] ?? 'test-item',
      dateCreated: postDateTime,
      dateUpdated: postDateTime,
      additionalFields: {
        headline,
        headlineUrl: '/about-aws/whats-new/2025/test/',
        postBody: '<p>Test body content</p>',
        postDateTime,
      },
    },
    tags: overrides.tags ?? [{ id: 'whats-new-v2#year#2025', name: '2025' }],
  };
}

export function createAPIResponse(items: NewsItem[], totalHits?: number): APIResponse {
  return {
    metadata: {
      count: items.length,
      totalHits: totalHits ?? items.length,
    },
    items,
  };
}

/**
 * Fixture: Item tagged with wrong year (2026 tag but 2025 date)
 */
export const mismatchedYearItem = createNewsItem({
  id: 'whats-new-v2#mismatched-item',
  headline: 'Late 2025 item tagged as 2026',
  postDateTime: '2025-12-28T10:00:00Z',
  tags: [{ id: 'whats-new-v2#year#2026', name: '2026' }],
});

/**
 * Fixture: Standard 2025 item with standard tag format
 */
export const standard2025Item = createNewsItem({
  id: 'whats-new-v2#standard-2025',
  headline: 'Standard 2025 announcement',
  postDateTime: '2025-06-15T12:00:00Z',
  tags: [{ id: 'whats-new-v2#year#2025', name: '2025' }],
});

/**
 * Fixture: 2025 item with new GLOBAL tag format
 */
export const global2025Item = createNewsItem({
  id: 'whats-new-v2#global-2025',
  headline: '2025 item with GLOBAL tag',
  postDateTime: '2025-08-20T14:00:00Z',
  tags: [{ id: 'GLOBAL#local-tags-whats-new-v2-year#2025', name: '2025' }],
});

/**
 * Fixture: 2026 item
 */
export const item2026 = createNewsItem({
  id: 'whats-new-v2#item-2026',
  headline: '2026 announcement',
  postDateTime: '2026-01-15T09:00:00Z',
  tags: [{ id: 'whats-new-v2#year#2026', name: '2026' }],
});

/**
 * Fixture: Duplicate item (same ID, different content)
 */
export const duplicateItem = createNewsItem({
  id: 'whats-new-v2#standard-2025', // Same ID as standard2025Item
  headline: 'Duplicate with different headline',
  postDateTime: '2025-06-15T12:00:00Z',
});
