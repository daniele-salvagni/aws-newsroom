import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as newsApi from '../../../lib/aws-news-client.js';
import * as db from '../../../lib/db.js';
import type { AWSNewsAPIResponse } from '../../../lib/aws-news-client.js';

// Mock dependencies
vi.mock('../../../lib/aws-news-client.js');
vi.mock('../../../lib/db.js');

const mockFetchPageOfNews = vi.mocked(newsApi.fetchPageOfNews);
const mockQuery = vi.mocked(db.query);

// Mock helper
const createMockNewsItem = (overrides: any): AWSNewsAPIResponse['items'][0] => ({
  item: {
    id: overrides.id || 'test-id',
    name: overrides.name || 'Test Item',
    dateCreated: overrides.dateCreated || new Date().toISOString(),
    dateUpdated: overrides.dateUpdated || new Date().toISOString(),
    additionalFields: {
      headline: overrides.headline || 'Test Headline',
      headlineUrl: overrides.headlineUrl || 'https://example.com',
      postDateTime: overrides.postDateTime || new Date().toISOString(),
      postBody: overrides.postBody || 'Test content',
      ...overrides.additionalFields,
    },
  },
  tags: overrides.tags || [],
});

describe('ingest-news handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pagination logic', () => {
    it('should fetch multiple pages when totalHits exceeds page size', async () => {
      mockFetchPageOfNews
        .mockResolvedValueOnce({
          metadata: { count: 100, totalHits: 250 },
          fieldTypes: {},
          items: Array(100)
            .fill(null)
            .map((_, i) =>
              createMockNewsItem({
                id: `item-${i}`,
                dateCreated: new Date('2024-01-15').toISOString(),
                headline: `Article ${i}`,
                headlineUrl: `https://aws.amazon.com/about-aws/whats-new/2024/01/article-${i}`,
                postDateTime: new Date('2024-01-15').toISOString(),
                postBody: `Content ${i}`,
              })
            ),
        })
        .mockResolvedValueOnce({
          metadata: { count: 100, totalHits: 250 },
          fieldTypes: {},
          items: Array(100)
            .fill(null)
            .map((_, i) =>
              createMockNewsItem({
                id: `item-${i + 100}`,
                dateCreated: new Date('2024-01-14').toISOString(),
                headline: `Article ${i + 100}`,
                headlineUrl: `https://aws.amazon.com/about-aws/whats-new/2024/01/article-${
                  i + 100
                }`,
                postDateTime: new Date('2024-01-14').toISOString(),
                postBody: `Content ${i + 100}`,
              })
            ),
        })
        .mockResolvedValueOnce({
          metadata: { count: 50, totalHits: 250 },
          fieldTypes: {},
          items: Array(50)
            .fill(null)
            .map((_, i) =>
              createMockNewsItem({
                id: `item-${i + 200}`,
                dateCreated: new Date('2024-01-13').toISOString(),
                headline: `Article ${i + 200}`,
                headlineUrl: `https://aws.amazon.com/about-aws/whats-new/2024/01/article-${
                  i + 200
                }`,
                postDateTime: new Date('2024-01-13').toISOString(),
                postBody: `Content ${i + 200}`,
              })
            ),
        });

      mockQuery.mockResolvedValue([]);

      const { handler } = await import('../ingest-news.js');

      const result = await handler({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      // Should have called API 3 times (only year 2024, 3 pages)
      expect(mockFetchPageOfNews).toHaveBeenCalledTimes(3);
      expect(result.articlesProcessed).toBe(250);
    });

    it('should stop pagination when items are too old', async () => {
      // Year 2024 - page 1 with recent items
      mockFetchPageOfNews.mockResolvedValueOnce({
        metadata: { count: 100, totalHits: 500 },
        fieldTypes: {},
        items: Array(100)
          .fill(null)
          .map((_, i) =>
            createMockNewsItem({
              id: `item-${i}`,
              dateCreated: new Date('2024-01-15').toISOString(),
              headline: `Article ${i}`,
              headlineUrl: `https://aws.amazon.com/about-aws/whats-new/2024/01/article-${i}`,
              postDateTime: new Date('2024-01-15').toISOString(),
              postBody: `Content ${i}`,
            })
          ),
      });

      // Year 2024 - page 2 with old items (stops pagination for this year)
      mockFetchPageOfNews.mockResolvedValueOnce({
        metadata: { count: 100, totalHits: 500 },
        fieldTypes: {},
        items: Array(100)
          .fill(null)
          .map((_, i) =>
            createMockNewsItem({
              id: `item-${i + 100}`,
              dateCreated: new Date('2023-12-01').toISOString(),
              headline: `Article ${i + 100}`,
              headlineUrl: `https://aws.amazon.com/about-aws/whats-new/2023/12/article-${i + 100}`,
              postDateTime: new Date('2023-12-01').toISOString(),
              postBody: `Content ${i + 100}`,
            })
          ),
      });

      mockQuery.mockResolvedValue([]);

      const { handler } = await import('../ingest-news.js');

      await handler({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      // Should call API 2 times: 2 pages for 2024 (stops when too old)
      expect(mockFetchPageOfNews).toHaveBeenCalledTimes(2);
    });
  });

  describe('date range filtering', () => {
    it('should only include articles within date range', async () => {
      // Mock for year 2024 (only fetches years in date range)
      mockFetchPageOfNews.mockResolvedValueOnce({
        metadata: { count: 3, totalHits: 3 },
        fieldTypes: {},
        items: [
          createMockNewsItem({
            id: 'item-1',
            dateCreated: '2024-01-15T00:00:00Z',
            headline: 'Article 1',
            headlineUrl: 'https://aws.amazon.com/about-aws/whats-new/2024/01/article-1',
            postDateTime: '2024-01-15T00:00:00Z',
            postBody: 'Content 1',
          }),
          createMockNewsItem({
            id: 'item-2',
            dateCreated: '2024-02-01T00:00:00Z',
            headline: 'Article 2',
            headlineUrl: 'https://aws.amazon.com/about-aws/whats-new/2024/02/article-2',
            postDateTime: '2024-02-01T00:00:00Z',
            postBody: 'Content 2',
          }),
          createMockNewsItem({
            id: 'item-3',
            dateCreated: '2023-12-31T00:00:00Z',
            headline: 'Article 3',
            headlineUrl: 'https://aws.amazon.com/about-aws/whats-new/2023/12/article-3',
            postDateTime: '2023-12-31T00:00:00Z',
            postBody: 'Content 3',
          }),
        ],
      });

      mockQuery.mockResolvedValue([]);

      const { handler } = await import('../ingest-news.js');

      const result = await handler({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      // Only 1 article is within range (item-1)
      // item-2 is after endDate, item-3 is before startDate
      expect(result.articlesProcessed).toBe(1);
    });
  });

  describe('daysBack parameter', () => {
    it('should calculate correct date range from daysBack', async () => {
      mockFetchPageOfNews.mockResolvedValue({
        metadata: { count: 0, totalHits: 0 },
        fieldTypes: {},
        items: [],
      });

      const { handler } = await import('../ingest-news.js');

      const result = await handler({ daysBack: 7 });

      const startDate = new Date(result.dateRange.start);
      const endDate = new Date(result.dateRange.end);
      const daysDiff = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBe(7);
    });
  });
});
