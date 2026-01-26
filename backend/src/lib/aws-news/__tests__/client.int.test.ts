/**
 * Integration tests for AWS News Client
 *
 * These tests hit the real AWS API to verify behavior and gather diagnostics.
 * Run with: npx vitest run --config vitest.integration.config.ts
 */

import { describe, it, expect } from 'vitest';
import { fetchNews } from '../client.js';

describe('AWS News API Integration', () => {
  describe('fetchNews', () => {
    it('fetches 2024 articles (pre-transition year)', async () => {
      const result = await fetchNews({ year: 2024, page: 1, pageSize: 5 });

      expect(result.items.length).toBeGreaterThan(0);
      console.log('\n📊 2024 Diagnostics:', JSON.stringify(result.diagnostics, null, 2));

      // 2024 should primarily use standard format
      expect(result.diagnostics.tagFormatResults.standard).toBeGreaterThan(0);
    }, 30000);

    it('fetches 2025 articles (transition year)', async () => {
      const result = await fetchNews({ year: 2025, page: 1, pageSize: 5 });

      expect(result.items.length).toBeGreaterThan(0);
      console.log('\n📊 2025 Diagnostics:', JSON.stringify(result.diagnostics, null, 2));

      // Log which formats returned results
      const { tagFormatResults } = result.diagnostics;
      console.log('  Standard format items:', tagFormatResults.standard);
      console.log('  Global format items:', tagFormatResults.global);
    }, 30000);

    it('fetches 2026 articles', async () => {
      const result = await fetchNews({ year: 2026, page: 1, pageSize: 5 });

      expect(result.items.length).toBeGreaterThan(0);
      console.log('\n📊 2026 Diagnostics:', JSON.stringify(result.diagnostics, null, 2));
    }, 30000);

    it('detects mismatched year tags', async () => {
      // Fetch 2026 and check for items actually dated in 2025
      const result = await fetchNews({ year: 2026, page: 1, pageSize: 50 });

      if (result.diagnostics.itemsWithMismatchedYearTag.length > 0) {
        console.log('\n⚠️  Mismatched items found:');
        for (const item of result.diagnostics.itemsWithMismatchedYearTag) {
          console.log(`  - "${item.headline}"`);
          console.log(`    Date: ${item.postDateTime} (year ${item.actualYear})`);
          console.log(`    Tagged years: ${item.taggedYears.join(', ')}`);
        }
      }

      // This is informational - we expect some mismatches
      expect(result.diagnostics).toBeDefined();
    }, 30000);

    it('removes duplicates when same item appears in multiple tag formats', async () => {
      const result = await fetchNews({ year: 2025, page: 1, pageSize: 10 });

      console.log('\n📊 Deduplication stats:');
      console.log('  Total fetched:', result.diagnostics.totalItemsFetched);
      console.log('  Duplicates removed:', result.diagnostics.duplicatesRemoved);
      console.log('  Unique items:', result.items.length);

      // Verify no duplicate IDs in result
      const ids = result.items.map((item) => item.item.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    }, 30000);
  });

  describe('Tag Format Discovery', () => {
    it('reports which tag formats work for each year', async () => {
      console.log('\n📋 Tag Format Report:');
      console.log('='.repeat(50));

      for (const year of [2024, 2025, 2026]) {
        const result = await fetchNews({ year, page: 1, pageSize: 5 });
        const { tagFormatResults } = result.diagnostics;

        console.log(`\nYear ${year}:`);
        for (const [format, count] of Object.entries(tagFormatResults)) {
          const status = count > 0 ? '✅' : '❌';
          console.log(`  ${status} ${format}: ${count} items`);
        }
      }
    }, 60000);
  });

  describe('Pagination', () => {
    it('returns different items on subsequent pages (no overlap)', async () => {
      const page1 = await fetchNews({ year: 2025, page: 1, pageSize: 10 });
      const page2 = await fetchNews({ year: 2025, page: 2, pageSize: 10 });

      const page1Ids = new Set(page1.items.map((item) => item.item.id));
      const page2Ids = new Set(page2.items.map((item) => item.item.id));

      // Check for overlap
      const overlap = [...page2Ids].filter((id) => page1Ids.has(id));

      console.log('\n📊 Pagination (same pageSize):');
      console.log('  Page 1 items:', page1.items.length);
      console.log('  Page 2 items:', page2.items.length);
      console.log('  Overlap:', overlap.length);

      expect(overlap.length).toBe(0);
    }, 30000);

    it('has overlap when page size changes between requests', async () => {
      // Page 1 with size 10 = items 0-9
      // Page 1 with size 5 = items 0-4
      // Page 2 with size 5 = items 5-9 (overlaps with first request)
      const largePageResult = await fetchNews({ year: 2025, page: 1, pageSize: 10 });
      const smallPage2Result = await fetchNews({ year: 2025, page: 2, pageSize: 5 });

      const largePageIds = new Set(largePageResult.items.map((item) => item.item.id));
      const smallPage2Ids = smallPage2Result.items.map((item) => item.item.id);

      const overlap = smallPage2Ids.filter((id) => largePageIds.has(id));

      console.log('\n📊 Pagination (different pageSize):');
      console.log('  Page 1 (size 10) items:', largePageResult.items.length);
      console.log('  Page 2 (size 5) items:', smallPage2Result.items.length);
      console.log('  Overlap:', overlap.length);

      // We expect overlap since page boundaries shift with different sizes
      expect(overlap.length).toBeGreaterThan(0);
    }, 30000);
  });
});
