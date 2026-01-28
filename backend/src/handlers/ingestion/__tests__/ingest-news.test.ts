import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractBlogUrls, stripHtml, fetchBlogTitle } from '../ingest-news.js';

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

describe('extractBlogUrls', () => {
  it('extracts AWS blog URLs from HTML', () => {
    const html = `<p>To learn more, visit our <a href="https://aws.amazon.com/blogs/big-data/safely-remove-kafka-brokers/" target="_blank">launch blog</a>.</p>`;

    const urls = extractBlogUrls(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe('https://aws.amazon.com/blogs/big-data/safely-remove-kafka-brokers/');
  });

  it('extracts multiple blog URLs from HTML', () => {
    const html = `
      <p>Visit the <a href="https://aws.amazon.com/blogs/aws/new-feature/">blog post</a> and 
      the <a href="https://aws.amazon.com/blogs/compute/another-post/">compute blog</a>.</p>
    `;

    const urls = extractBlogUrls(html);

    expect(urls).toHaveLength(2);
  });

  it('ignores non-blog AWS links', () => {
    const html = `<a href="https://docs.aws.amazon.com/guide.html">docs</a>
                  <a href="https://console.aws.amazon.com/">console</a>`;

    const urls = extractBlogUrls(html);

    expect(urls).toHaveLength(0);
  });

  it('ignores aws.amazon.com links without /blogs/ path', () => {
    const html = `
      <a href="https://aws.amazon.com/msk/">MSK product page</a>
      <a href="https://aws.amazon.com/about-aws/whats-new/2024/">whats new</a>
      <a href="https://aws.amazon.com/solutions/case-studies/">case studies</a>
    `;

    const urls = extractBlogUrls(html);

    expect(urls).toHaveLength(0);
  });

  it('deduplicates URLs', () => {
    const html = `
      <a href="https://aws.amazon.com/blogs/aws/post/">first</a>
      <a href="https://aws.amazon.com/blogs/aws/post/">second</a>
    `;

    const urls = extractBlogUrls(html);

    expect(urls).toHaveLength(1);
  });

  it('returns empty array for null/undefined input', () => {
    expect(extractBlogUrls(null)).toEqual([]);
    expect(extractBlogUrls(undefined)).toEqual([]);
    expect(extractBlogUrls('')).toEqual([]);
  });

  it('handles real AWS announcement HTML', () => {
    const html = `<p>To learn more, visit our <a href="https://aws.amazon.com/blogs/big-data/safely-remove-kafka-brokers-from-amazon-msk-provisioned-clusters/" target="_blank" rel="noopener">launch blog</a> and the <a href="https://docs.aws.amazon.com/msk/latest/developerguide/msk-remove-broker.html" target="_blank" rel="noopener">Amazon MSK Developer Guide</a>.</p>`;

    const urls = extractBlogUrls(html);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      'https://aws.amazon.com/blogs/big-data/safely-remove-kafka-brokers-from-amazon-msk-provisioned-clusters/'
    );
  });
});

describe('stripHtml', () => {
  it('removes HTML tags from string', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('returns undefined for null/undefined input', () => {
    expect(stripHtml(null)).toBeUndefined();
    expect(stripHtml(undefined)).toBeUndefined();
  });

  it('trims whitespace', () => {
    expect(stripHtml('  <p>text</p>  ')).toBe('text');
  });
});

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
