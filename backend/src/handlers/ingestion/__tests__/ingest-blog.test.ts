import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as blogApi from '../../../lib/aws-news-client.js';
import * as db from '../../../lib/db.js';
import type { AWSNewsAPIResponse } from '../../../lib/aws-news-client.js';

// Mock dependencies
vi.mock('../../../lib/aws-news-client.js');
vi.mock('../../../lib/db.js');

const mockFetchPageOfBlogs = vi.mocked(blogApi.fetchPageOfBlogs);
const mockQuery = vi.mocked(db.query);

// Mock helper
const createMockBlogItem = (overrides: any): AWSNewsAPIResponse['items'][0] => ({
  item: {
    id: overrides.id || 'test-id',
    name: overrides.name || 'Test Item',
    dateCreated: overrides.dateCreated || new Date().toISOString(),
    dateUpdated: overrides.dateUpdated || new Date().toISOString(),
    additionalFields: {
      title: overrides.title || 'Test Title',
      link: overrides.link || 'https://example.com',
      createdDate: overrides.createdDate || new Date().toISOString(),
      postExcerpt: overrides.postExcerpt || 'Test excerpt',
      ...overrides.additionalFields,
    },
  },
  tags: overrides.tags || [],
});

describe('ingest-blog handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pagination logic', () => {
    it('should fetch multiple pages when totalHits exceeds page size', async () => {
      mockFetchPageOfBlogs
        .mockResolvedValueOnce({
          metadata: { count: 100, totalHits: 250 },
          fieldTypes: {},
          items: Array(100)
            .fill(null)
            .map((_, i) =>
              createMockBlogItem({
                id: `blog-${i}`,
                dateCreated: new Date('2024-01-15').toISOString(),
                title: `Blog ${i}`,
                link: `https://aws.amazon.com/blogs/aws/blog-${i}`,
                createdDate: new Date('2024-01-15').toISOString(),
                postExcerpt: `<p>Excerpt ${i}</p>`,
                tags: [
                  { id: 'blog-posts#category#news', name: 'News', description: 'News category' },
                ],
              })
            ),
        })
        .mockResolvedValueOnce({
          metadata: { count: 100, totalHits: 250 },
          fieldTypes: {},
          items: Array(100)
            .fill(null)
            .map((_, i) =>
              createMockBlogItem({
                id: `blog-${i + 100}`,
                dateCreated: new Date('2024-01-14').toISOString(),
                title: `Blog ${i + 100}`,
                link: `https://aws.amazon.com/blogs/aws/blog-${i + 100}`,
                createdDate: new Date('2024-01-14').toISOString(),
                postExcerpt: `<p>Excerpt ${i + 100}</p>`,
                tags: [
                  { id: 'blog-posts#category#news', name: 'News', description: 'News category' },
                ],
              })
            ),
        })
        .mockResolvedValueOnce({
          metadata: { count: 50, totalHits: 250 },
          fieldTypes: {},
          items: Array(50)
            .fill(null)
            .map((_, i) =>
              createMockBlogItem({
                id: `blog-${i + 200}`,
                dateCreated: new Date('2024-01-13').toISOString(),
                title: `Blog ${i + 200}`,
                link: `https://aws.amazon.com/blogs/aws/blog-${i + 200}`,
                createdDate: new Date('2024-01-13').toISOString(),
                postExcerpt: `<p>Excerpt ${i + 200}</p>`,
                tags: [
                  { id: 'blog-posts#category#news', name: 'News', description: 'News category' },
                ],
              })
            ),
        });

      mockQuery.mockResolvedValue([]);

      const { handler } = await import('../ingest-blog.js');

      const result = await handler({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      expect(mockFetchPageOfBlogs).toHaveBeenCalledTimes(3);
      expect(mockFetchPageOfBlogs).toHaveBeenNthCalledWith(1, {
        pageNumber: 1,
        pageSize: 100,
        categoryTag: 'blog-posts#category#news',
      });
      expect(result.articlesProcessed).toBe(250);
    });

    it('should stop pagination when items are too old', async () => {
      mockFetchPageOfBlogs
        .mockResolvedValueOnce({
          metadata: { count: 100, totalHits: 500 },
          fieldTypes: {},
          items: Array(100)
            .fill(null)
            .map((_, i) =>
              createMockBlogItem({
                id: `blog-${i}`,
                dateCreated: new Date('2024-01-15').toISOString(),
                title: `Blog ${i}`,
                link: `https://aws.amazon.com/blogs/aws/blog-${i}`,
                createdDate: new Date('2024-01-15').toISOString(),
                postExcerpt: `<p>Excerpt ${i}</p>`,
                tags: [
                  { id: 'blog-posts#category#news', name: 'News', description: 'News category' },
                ],
              })
            ),
        })
        .mockResolvedValueOnce({
          metadata: { count: 100, totalHits: 500 },
          fieldTypes: {},
          items: Array(100)
            .fill(null)
            .map((_, i) =>
              createMockBlogItem({
                id: `blog-${i + 100}`,
                dateCreated: new Date('2023-12-01').toISOString(),
                title: `Blog ${i + 100}`,
                link: `https://aws.amazon.com/blogs/aws/blog-${i + 100}`,
                createdDate: new Date('2023-12-01').toISOString(),
                postExcerpt: `<p>Excerpt ${i + 100}</p>`,
                tags: [
                  { id: 'blog-posts#category#news', name: 'News', description: 'News category' },
                ],
              })
            ),
        });

      mockQuery.mockResolvedValue([]);

      const { handler } = await import('../ingest-blog.js');

      await handler({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      expect(mockFetchPageOfBlogs).toHaveBeenCalledTimes(2);
    });
  });

  describe('URL filtering', () => {
    it('should only include posts from /blogs/aws/ path', async () => {
      mockFetchPageOfBlogs.mockResolvedValue({
        metadata: { count: 3, totalHits: 3 },
        fieldTypes: {},
        items: [
          createMockBlogItem({
            id: 'blog-1',
            dateCreated: '2024-01-15T00:00:00Z',
            title: 'AWS News Blog Post',
            link: 'https://aws.amazon.com/blogs/aws/news-post',
            createdDate: '2024-01-15T00:00:00Z',
            postExcerpt: '<p>AWS News</p>',
            tags: [{ id: 'blog-posts#category#news', name: 'News', description: 'News category' }],
          }),
          createMockBlogItem({
            id: 'blog-2',
            dateCreated: '2024-01-15T00:00:00Z',
            title: 'Other Blog Post',
            link: 'https://aws.amazon.com/blogs/compute/other-post',
            createdDate: '2024-01-15T00:00:00Z',
            postExcerpt: '<p>Other content</p>',
            tags: [{ id: 'blog-posts#category#news', name: 'News', description: 'News category' }],
          }),
          createMockBlogItem({
            id: 'blog-3',
            dateCreated: '2024-01-15T00:00:00Z',
            title: 'Another AWS News Post',
            link: 'https://aws.amazon.com/blogs/aws/another-news',
            createdDate: '2024-01-15T00:00:00Z',
            postExcerpt: '<p>More news</p>',
            tags: [{ id: 'blog-posts#category#news', name: 'News', description: 'News category' }],
          }),
        ],
      });

      mockQuery.mockResolvedValue([]);

      const { handler } = await import('../ingest-blog.js');

      const result = await handler({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      // Should only process 2 articles from /blogs/aws/
      expect(result.articlesProcessed).toBe(2);
    });
  });

  describe('HTML stripping', () => {
    it('should strip HTML tags from excerpts', async () => {
      mockFetchPageOfBlogs.mockResolvedValue({
        metadata: { count: 1, totalHits: 1 },
        fieldTypes: {},
        items: [
          createMockBlogItem({
            id: 'blog-1',
            dateCreated: '2024-01-15T00:00:00Z',
            title: 'Test Blog',
            link: 'https://aws.amazon.com/blogs/aws/test',
            createdDate: '2024-01-15T00:00:00Z',
            postExcerpt: '<p>This is <strong>bold</strong> text with <a href="#">link</a></p>',
            tags: [{ id: 'blog-posts#category#news', name: 'News', description: 'News category' }],
          }),
        ],
      });

      mockQuery.mockResolvedValue([]);

      const { handler } = await import('../ingest-blog.js');

      await handler({
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      });

      // Check that the insert was called with stripped HTML
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('This is bold text with link')])
      );
    });
  });

  describe('daysBack parameter', () => {
    it('should calculate correct date range from daysBack', async () => {
      mockFetchPageOfBlogs.mockResolvedValue({
        metadata: { count: 0, totalHits: 0 },
        fieldTypes: {},
        items: [],
      });

      const { handler } = await import('../ingest-blog.js');

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
