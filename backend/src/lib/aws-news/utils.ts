/**
 * AWS News Client Utilities
 */

import type { NewsItem, Tag } from './types.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries - 1) {
        const delay = Math.pow(1.3, attempt) * BASE_DELAY_MS;
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deduplicateItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.item.id)) return false;
    seen.add(item.item.id);
    return true;
  });
}

export function sortByDateDesc(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const dateA = getItemDate(a);
    const dateB = getItemDate(b);
    return dateB.getTime() - dateA.getTime();
  });
}

export function getItemDate(item: NewsItem): Date {
  return new Date(item.item.additionalFields.postDateTime ?? item.item.dateCreated);
}

export function getItemYear(item: NewsItem): number {
  return getItemDate(item).getFullYear();
}

export function extractYearTags(tags: Tag[]): number[] {
  const years: number[] = [];

  for (const tag of tags) {
    const match = tag.id.match(/year#(\d{4})$/);
    if (match) {
      years.push(parseInt(match[1], 10));
    }
  }

  return years;
}
