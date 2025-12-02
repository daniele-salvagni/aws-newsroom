/**
 * Extract unique hashtags from text with normalization:
 * - Converted to lowercase
 * - Length between 1 and 100 characters
 * - # symbol stripped
 */

export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#([a-zA-Z0-9_-]+)/g;
  const matches = text.matchAll(hashtagRegex);
  const hashtags = new Set<string>();

  for (const match of matches) {
    const tag = match[1].toLowerCase();
    if (tag.length > 0 && tag.length <= 100) {
      hashtags.add(tag);
    }
  }

  return Array.from(hashtags);
}
