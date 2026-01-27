import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing handler
vi.mock('../../../lib/db.js', () => ({
  query: vi.fn(),
}));

vi.mock('../../../lib/aws-news/index.js', () => ({
  fetchNews: vi.fn(),
}));

import { query } from '../../../lib/db.js';
import { fetchNews } from '../../../lib/aws-news/index.js';

const mockQuery = vi.mocked(query);
const mockFetchNews = vi.mocked(fetchNews);

describe('ingest-news handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-27T12:00:00Z'));
  });

  it('uses daysBack to calculate date range', async () => {
    mockFetchNews.mockResolvedValue({ items: [], totalHits: 0, diagnostics: {} as any });

    const { handler } = await import('../ingest-news.js');
    const result = await handler({ daysBack: 3 });

    expect(result.dateRange.start).toBe('2026-01-24T12:00:00.000Z');
    expect(result.dateRange.end).toBe('2026-01-27T12:00:00.000Z');
  });

  it('uses explicit startDate and endDate when provided', async () => {
    mockFetchNews.mockResolvedValue({ items: [], totalHits: 0, diagnostics: {} as any });

    const { handler } = await import('../ingest-news.js');
    const result = await handler({
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-01-15T00:00:00Z',
    });

    expect(result.dateRange.start).toBe('2026-01-01T00:00:00Z');
    expect(result.dateRange.end).toBe('2026-01-15T00:00:00Z');
  });

  it('inserts new articles into database', async () => {
    const mockItem = createMockNewsItem('item-1', '2026-01-26T10:00:00Z');
    mockFetchNews
      .mockResolvedValueOnce({ items: [mockItem], totalHits: 1, diagnostics: {} as any })
      .mockResolvedValue({ items: [], totalHits: 0, diagnostics: {} as any });
    mockQuery.mockResolvedValue([]);

    const { handler } = await import('../ingest-news.js');
    const result = await handler({ daysBack: 2 });

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO news_articles'),
      expect.any(Array)
    );
  });

  it('skips existing articles', async () => {
    const mockItem = createMockNewsItem('item-1', '2026-01-26T10:00:00Z');
    mockFetchNews
      .mockResolvedValueOnce({ items: [mockItem], totalHits: 1, diagnostics: {} as any })
      .mockResolvedValue({ items: [], totalHits: 0, diagnostics: {} as any });
    mockQuery.mockResolvedValueOnce([{ exists: 1 }]); // SELECT returns existing

    const { handler } = await import('../ingest-news.js');
    const result = await handler({ daysBack: 2 });

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('returns correct response structure', async () => {
    mockFetchNews.mockResolvedValue({ items: [], totalHits: 0, diagnostics: {} as any });

    const { handler } = await import('../ingest-news.js');
    const result = await handler({ daysBack: 1 });

    expect(result).toMatchObject({
      statusCode: 200,
      inserted: 0,
      skipped: 0,
      dateRange: {
        start: expect.any(String),
        end: expect.any(String),
      },
    });
  });
});

/** Helper to create mock news items */
function createMockNewsItem(id: string, postDateTime: string) {
  return {
    item: {
      id,
      name: `item-${id}`,
      dateCreated: postDateTime,
      dateUpdated: postDateTime,
      additionalFields: {
        headline: `Test headline ${id}`,
        headlineUrl: `https://aws.amazon.com/about-aws/whats-new/${id}`,
        postDateTime,
        postBody: '<p>Test body</p>',
      },
    },
    tags: [],
  };
}
