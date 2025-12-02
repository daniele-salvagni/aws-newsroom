import { describe, it, expect } from 'vitest';
import { fetchPageOfNews, fetchPageOfBlogs } from '../aws-news-client.js';

/**
 * Integration tests for AWS News / Blog API
 */

const API_TIMEOUT = 30000; // 30 seconds for API calls

describe('AWS News API Integration Tests', () => {
  describe('fetchPageOfNews', () => {
    it(
      "should fetch What's New articles for 2024",
      async () => {
        const result = await fetchPageOfNews({
          year: 2024,
          pageNumber: 1,
          pageSize: 10,
        });

        // Verify response structure
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('items');
        expect(result.metadata).toHaveProperty('count');
        expect(result.metadata).toHaveProperty('totalHits');

        // Should have items
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items.length).toBeLessThanOrEqual(10);

        // Verify item structure
        const firstItem = result.items[0];
        expect(firstItem).toHaveProperty('item');
        expect(firstItem.item).toHaveProperty('id');
        expect(firstItem.item).toHaveProperty('additionalFields');
        expect(firstItem.item.additionalFields).toHaveProperty('headline');
        expect(firstItem.item.additionalFields).toHaveProperty('headlineUrl');
        expect(firstItem.item.additionalFields).toHaveProperty('postDateTime');

        // Verify data types
        expect(typeof firstItem.item.id).toBe('string');
        expect(typeof firstItem.item.additionalFields.headline).toBe('string');
        expect(typeof firstItem.item.additionalFields.headlineUrl).toBe('string');

        console.log(
          `✓ Fetched ${result.items.length} articles from ${result.metadata.totalHits} total`
        );
        console.log(`✓ First article: "${firstItem.item.additionalFields.headline}"`);
      },
      API_TIMEOUT
    );

    it(
      'should handle pagination correctly',
      async () => {
        const page1 = await fetchPageOfNews({
          year: 2024,
          pageNumber: 1,
          pageSize: 5,
        });

        const page2 = await fetchPageOfNews({
          year: 2024,
          pageNumber: 2,
          pageSize: 5,
        });

        // Both pages should have items
        expect(page1.items.length).toBeGreaterThan(0);
        expect(page2.items.length).toBeGreaterThan(0);

        // Items should be different
        const page1Ids = page1.items.map((item) => item.item.id);
        const page2Ids = page2.items.map((item) => item.item.id);

        const overlap = page1Ids.filter((id) => page2Ids.includes(id));
        expect(overlap.length).toBe(0);

        console.log(`✓ Page 1 IDs: ${page1Ids.slice(0, 2).join(', ')}...`);
        console.log(`✓ Page 2 IDs: ${page2Ids.slice(0, 2).join(', ')}...`);
      },
      API_TIMEOUT
    );

    it(
      'should return articles sorted by date descending',
      async () => {
        const result = await fetchPageOfNews({
          year: 2024,
          pageNumber: 1,
          pageSize: 10,
        });

        const dates = result.items.map(
          (item) => new Date(item.item.additionalFields.postDateTime || item.item.dateCreated)
        );

        // Check if dates are in descending order
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i + 1].getTime());
        }

        console.log(
          `✓ Dates range from ${dates[0].toISOString()} to ${dates[dates.length - 1].toISOString()}`
        );
      },
      API_TIMEOUT
    );

    it(
      'should handle year 2025 (transition year)',
      async () => {
        const result = await fetchPageOfNews({
          year: 2025,
          pageNumber: 1,
          pageSize: 10,
        });

        // Should return results
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('items');
        expect(Array.isArray(result.items)).toBe(true);

        console.log(`✓ Found ${result.items.length} articles for 2025`);
      },
      API_TIMEOUT
    );
  });

  describe('fetchPageOfBlogs', () => {
    it(
      'should fetch AWS Blog posts with news category',
      async () => {
        const result = await fetchPageOfBlogs({
          pageNumber: 1,
          pageSize: 100, // Increased to ensure we get /blogs/aws/ posts
          categoryTag: 'blog-posts#category#news',
        });

        // Verify response structure
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('items');
        expect(result.metadata).toHaveProperty('count');
        expect(result.metadata).toHaveProperty('totalHits');

        // Should have items
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items.length).toBeLessThanOrEqual(100);

        // Verify item structure
        const firstItem = result.items[0];
        expect(firstItem).toHaveProperty('item');
        expect(firstItem).toHaveProperty('tags');
        expect(firstItem.item).toHaveProperty('id');
        expect(firstItem.item).toHaveProperty('additionalFields');
        expect(firstItem.item.additionalFields).toHaveProperty('title');
        expect(firstItem.item.additionalFields).toHaveProperty('link');
        expect(firstItem.item.additionalFields).toHaveProperty('createdDate');

        // Verify at least some posts are from AWS News Blog
        const awsNewsBlogPosts = result.items.filter((item) =>
          item.item.additionalFields.link?.includes('/blogs/aws/')
        );
        expect(awsNewsBlogPosts.length).toBeGreaterThan(0);

        console.log(
          `✓ Fetched ${result.items.length} blog posts from ${result.metadata.totalHits} total`
        );
        console.log(`✓ ${awsNewsBlogPosts.length} posts from AWS News Blog`);
        console.log(`✓ First post: "${firstItem.item.additionalFields.title}"`);
      },
      API_TIMEOUT
    );

    it(
      'should return blog posts sorted by date descending',
      async () => {
        const result = await fetchPageOfBlogs({
          pageNumber: 1,
          pageSize: 10,
          categoryTag: 'blog-posts#category#news',
        });

        const dates = result.items.map(
          (item) => new Date(item.item.additionalFields.createdDate || item.item.dateCreated)
        );

        // Check if dates are in descending order
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i].getTime()).toBeGreaterThanOrEqual(dates[i + 1].getTime());
        }

        console.log(
          `✓ Dates range from ${dates[0].toISOString()} to ${dates[dates.length - 1].toISOString()}`
        );
      },
      API_TIMEOUT
    );

    it(
      'should handle pagination correctly',
      async () => {
        const page1 = await fetchPageOfBlogs({
          pageNumber: 1,
          pageSize: 5,
          categoryTag: 'blog-posts#category#news',
        });

        const page2 = await fetchPageOfBlogs({
          pageNumber: 2,
          pageSize: 5,
          categoryTag: 'blog-posts#category#news',
        });

        // Both pages should have items
        expect(page1.items.length).toBeGreaterThan(0);
        expect(page2.items.length).toBeGreaterThan(0);

        // Items should be different
        const page1Ids = page1.items.map((item) => item.item.id);
        const page2Ids = page2.items.map((item) => item.item.id);

        const overlap = page1Ids.filter((id) => page2Ids.includes(id));
        expect(overlap.length).toBe(0);

        console.log(`✓ Page 1 IDs: ${page1Ids.slice(0, 2).join(', ')}...`);
        console.log(`✓ Page 2 IDs: ${page2Ids.slice(0, 2).join(', ')}...`);
      },
      API_TIMEOUT
    );

    it(
      'should fetch blog posts without category filter',
      async () => {
        const result = await fetchPageOfBlogs({
          pageNumber: 1,
          pageSize: 10,
        });

        // Should return results
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('items');
        expect(result.items.length).toBeGreaterThan(0);

        console.log(`✓ Fetched ${result.items.length} blog posts without category filter`);
      },
      API_TIMEOUT
    );
  });

  describe('Error handling', () => {
    it(
      'should handle invalid year gracefully',
      async () => {
        // Very old year that likely has no data
        const result = await fetchPageOfNews({
          year: 2000,
          pageNumber: 1,
          pageSize: 10,
        });

        // Should return empty results, not throw
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('items');
        expect(result.items.length).toBe(0);
      },
      API_TIMEOUT
    );

    it(
      'should handle large page numbers gracefully',
      async () => {
        // Request a page that likely doesn't exist
        const result = await fetchPageOfNews({
          year: 2024,
          pageNumber: 9999,
          pageSize: 10,
        });

        // Should return empty results, not throw
        expect(result).toHaveProperty('metadata');
        expect(result).toHaveProperty('items');
        expect(result.items.length).toBe(0);
      },
      API_TIMEOUT
    );
  });
});
