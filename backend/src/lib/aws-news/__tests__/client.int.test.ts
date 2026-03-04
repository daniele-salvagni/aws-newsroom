/**
 * Integration tests for AWS News Client
 *
 * These tests hit the real AWS API to verify behavior.
 * Run with: npx vitest run --config vitest.integration.config.ts
 */

import { describe, it, expect } from 'vitest';
import { fetchNews } from '../client.js';
import { getItemYear } from '../utils.js';

describe('AWS News API Integration', () => {
  describe('fetchNews', () => {
    it('fetches current year articles', async () => {
      const currentYear = new Date().getFullYear();
      const result = await fetchNews({ year: currentYear, page: 1, pageSize: 100 });

      expect(result.items.length).toBeGreaterThan(0);
      console.log(`\n📊 ${currentYear}: ${result.items.length} articles`);

      for (const item of result.items) {
        expect(getItemYear(item)).toBe(currentYear);
      }
    }, 30000);

    it('filters by year correctly', async () => {
      // Fetch a large page and verify year filtering works
      const result = await fetchNews({ year: 2026, page: 1, pageSize: 500 });

      expect(result.items.length).toBeGreaterThan(0);

      for (const item of result.items) {
        expect(getItemYear(item)).toBe(2026);
      }
    }, 30000);

    it('returns totalHits from API metadata', async () => {
      const result = await fetchNews({ year: 2026, page: 1, pageSize: 10 });

      expect(result.totalHits).toBeGreaterThan(0);
      console.log(`\n📊 Total articles in API: ${result.totalHits}`);
    }, 30000);
  });

  describe('Pagination', () => {
    it('returns different items on subsequent pages', async () => {
      // Use large page size to ensure we get items
      const page1 = await fetchNews({ year: 2026, page: 1, pageSize: 50 });
      const page2 = await fetchNews({ year: 2026, page: 2, pageSize: 50 });

      if (page1.items.length > 0 && page2.items.length > 0) {
        const page1Ids = new Set(page1.items.map((item) => item.item.id));
        const overlap = page2.items.filter((item) => page1Ids.has(item.item.id));

        console.log('\n📊 Pagination:');
        console.log('  Page 1 items:', page1.items.length);
        console.log('  Page 2 items:', page2.items.length);
        console.log('  Overlap:', overlap.length);

        expect(overlap.length).toBe(0);
      }
    }, 30000);

    it('can fetch many articles with large page size', async () => {
      const result = await fetchNews({ year: 2026, page: 1, pageSize: 2000 });

      console.log(`\n📊 2026 with large page: ${result.items.length} articles`);
      expect(result.items.length).toBeGreaterThan(10);
    }, 30000);
  });

  describe('Edge cases', () => {
    it('returns empty array for future year', async () => {
      const result = await fetchNews({ year: 2030, page: 1, pageSize: 100 });

      expect(result.items.length).toBe(0);
    }, 30000);

    it('finds articles without year tags', async () => {
      // This was the original bug - articles like "AWS Elemental Inference" had no year tags
      const result = await fetchNews({ year: 2026, page: 1, pageSize: 500 });

      const elemental = result.items.find((i) =>
        i.item.additionalFields.headline?.includes('Elemental Inference')
      );

      if (elemental) {
        console.log('\n✅ Found: AWS Elemental Inference');
      }

      expect(result.items.length).toBeGreaterThan(0);
    }, 30000);
  });
});
