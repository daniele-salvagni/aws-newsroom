/**
 * Unit tests for AWS News utilities
 */

import { describe, it, expect } from 'vitest';
import {
  deduplicateItems,
  sortByDateDesc,
  getItemDate,
  getItemYear,
  extractYearTags,
} from '../utils.js';
import {
  createNewsItem,
  standard2025Item,
  global2025Item,
  item2026,
  duplicateItem,
} from './fixtures.js';

describe('deduplicateItems', () => {
  it('removes items with duplicate IDs', () => {
    const items = [standard2025Item, duplicateItem, item2026];
    const result = deduplicateItems(items);

    expect(result).toHaveLength(2);
    expect(result[0].item.id).toBe(standard2025Item.item.id);
    expect(result[1].item.id).toBe(item2026.item.id);
  });

  it('keeps first occurrence when duplicates exist', () => {
    const items = [standard2025Item, duplicateItem];
    const result = deduplicateItems(items);

    expect(result[0].item.additionalFields.headline).toBe('Standard 2025 announcement');
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateItems([])).toEqual([]);
  });
});

describe('sortByDateDesc', () => {
  it('sorts items by date descending', () => {
    const items = [standard2025Item, item2026, global2025Item];
    const result = sortByDateDesc(items);

    expect(result[0].item.id).toBe(item2026.item.id);
    expect(result[1].item.id).toBe(global2025Item.item.id);
    expect(result[2].item.id).toBe(standard2025Item.item.id);
  });

  it('does not mutate original array', () => {
    const items = [standard2025Item, item2026];
    const original = [...items];
    sortByDateDesc(items);

    expect(items).toEqual(original);
  });
});

describe('getItemDate', () => {
  it('uses postDateTime when available', () => {
    const date = getItemDate(standard2025Item);
    expect(date.toISOString()).toBe('2025-06-15T12:00:00.000Z');
  });

  it('falls back to dateCreated when postDateTime missing', () => {
    const item = createNewsItem({ postDateTime: undefined });
    item.item.additionalFields.postDateTime = undefined;
    item.item.dateCreated = '2025-01-01T00:00:00Z';

    const date = getItemDate(item);
    expect(date.getFullYear()).toBe(2025);
  });
});

describe('getItemYear', () => {
  it('extracts year from item date', () => {
    expect(getItemYear(standard2025Item)).toBe(2025);
    expect(getItemYear(item2026)).toBe(2026);
  });
});

// This section is for diagnostics
describe('extractYearTags', () => {
  it('extracts year from standard tag format', () => {
    const tags = [{ id: 'whats-new-v2#year#2025', name: '2025' }];
    expect(extractYearTags(tags)).toEqual([2025]);
  });

  it('extracts year from GLOBAL tag format', () => {
    const tags = [{ id: 'GLOBAL#local-tags-whats-new-v2-year#2025', name: '2025' }];
    expect(extractYearTags(tags)).toEqual([2025]);
  });

  it('extracts multiple years', () => {
    const tags = [
      { id: 'whats-new-v2#year#2025', name: '2025' },
      { id: 'whats-new-v2#year#2026', name: '2026' },
    ];
    expect(extractYearTags(tags)).toEqual([2025, 2026]);
  });

  it('ignores non-year tags', () => {
    const tags = [
      { id: 'whats-new-v2#general-products#amazon-ec2', name: 'amazon-ec2' },
      { id: 'whats-new-v2#year#2025', name: '2025' },
    ];
    expect(extractYearTags(tags)).toEqual([2025]);
  });

  it('returns empty array when no year tags', () => {
    const tags = [{ id: 'whats-new-v2#general-products#amazon-s3', name: 's3' }];
    expect(extractYearTags(tags)).toEqual([]);
  });
});
