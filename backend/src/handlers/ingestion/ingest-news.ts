import crypto from 'node:crypto';
import { query } from '../../lib/db.js';
import { fetchNews, type NewsItem } from '../../lib/aws-news/index.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('ingest-news');
const PAGE_SIZE = 100;
const SOURCE = 'aws-news';

interface IngestionInput {
  startDate?: string;
  endDate?: string;
  daysBack?: number;
}

/** Lambda handler for ingesting AWS What's New announcements */
export const handler = async (event: IngestionInput) => {
  logger.info('Starting AWS News ingestion', { event });

  const { start, end } = getDateRange(event);
  logger.info('Date range calculated', { start, end });

  const articles = await fetchArticlesInRange(start, end);
  const result = await storeArticles(articles);

  logger.info('Ingestion completed', { ...result, total: articles.length });
  return { statusCode: 200, ...result, dateRange: { start, end } };
};

/** Calculate date range from input parameters */
function getDateRange(input: IngestionInput): { start: string; end: string } {
  // endDate without startDate is invalid
  if (input.endDate && !input.startDate) {
    throw new Error('endDate requires startDate to be specified');
  }

  const now = new Date();
  const end = input.endDate ?? now.toISOString();

  // If startDate provided, use it with endDate (or now)
  if (input.startDate) {
    return { start: input.startDate, end };
  }

  // Otherwise use daysBack (defaults to 7)
  const start = new Date();
  start.setDate(start.getDate() - (input.daysBack ?? 7));
  return { start: start.toISOString(), end };
}

/** Fetch all articles within date range across years */
async function fetchArticlesInRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const years = getYearRange(
    start.getFullYear(),
    Math.min(end.getFullYear(), new Date().getFullYear())
  );

  const articles = [];

  for (const year of years) {
    for await (const item of paginateYear(year, start)) {
      const publishedAt = getPublishedDate(item);
      if (publishedAt > end) continue;

      const postBody = item.item.additionalFields.postBody;

      articles.push({
        awsSourceId: item.item.id,
        title: item.item.additionalFields.headline || '',
        url: item.item.additionalFields.headlineUrl!,
        description: stripHtml(postBody),
        rawHtml: postBody || null,
        publishedAt: publishedAt.toISOString(),
        blogUrls: extractBlogUrls(postBody), // Just extract URLs, fetch titles later for new articles only
      });
    }
  }

  logger.info('Articles fetched', { count: articles.length });
  return articles;
}

/** Generate year range from most recent to oldest */
function getYearRange(startYear: number, endYear: number): number[] {
  return Array.from({ length: endYear - startYear + 1 }, (_, i) => endYear - i);
}

/** Paginate through a year's articles until we hit items older than startDate */
async function* paginateYear(year: number, startDate: Date): AsyncGenerator<NewsItem> {
  for (let page = 1; ; page++) {
    const { items } = await fetchNews({ year, page, pageSize: PAGE_SIZE });
    if (items.length === 0) break;

    let hasItemsInRange = false;

    for (const item of items) {
      if (!item.item.additionalFields.headlineUrl) continue;

      const publishedAt = getPublishedDate(item);
      if (publishedAt < startDate) continue;

      hasItemsInRange = true;
      yield item;
    }

    if (!hasItemsInRange) break;
  }
}

/** Extract published date from news item */
function getPublishedDate(item: NewsItem): Date {
  return new Date(item.item.additionalFields.postDateTime || item.item.dateCreated);
}

/** Strip HTML tags from string */
export function stripHtml(html: string | null | undefined): string | undefined {
  return html?.replace(/<[^>]*>/g, '').trim() || undefined;
}

export interface BlogPost {
  url: string;
  title: string;
}

/** Extract AWS blog URLs from HTML content */
export function extractBlogUrls(html: string | null | undefined): string[] {
  if (!html) return [];

  const urls: string[] = [];
  const seen = new Set<string>();

  // Match anchor tags with href
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];

    // Only AWS blog URLs
    if (!url.includes('aws.amazon.com/blogs/')) continue;
    if (seen.has(url)) continue;

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

/** Fetch blog post title from URL */
export async function fetchBlogTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AWS-Newsroom-Bot/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

    if (!titleMatch) return null;

    // Clean up title - remove " | AWS Blog Name" suffix
    let title = titleMatch[1].trim();
    title = title.replace(/\s*\|.*$/, '').trim();

    return title || null;
  } catch {
    return null;
  }
}

/** Extract blog posts with titles from HTML content */
export async function extractBlogPosts(html: string | null | undefined): Promise<BlogPost[]> {
  const urls = extractBlogUrls(html);
  const posts: BlogPost[] = [];

  for (const url of urls) {
    const title = await fetchBlogTitle(url);
    if (title) {
      posts.push({ url, title });
    }
  }

  return posts;
}

/** Generate deterministic link ID from article ID and URL */
function generateLinkId(articleId: string, url: string): string {
  return crypto.createHash('sha256').update(`${articleId}:${url}`).digest('hex').substring(0, 32);
}

/** Generate deterministic article ID */
function generateArticleId(awsSourceId: string): string {
  return crypto.createHash('sha256').update(awsSourceId).digest('hex').substring(0, 32);
}

/** Store articles in database, skipping duplicates */
async function storeArticles(articles: Awaited<ReturnType<typeof fetchArticlesInRange>>) {
  let inserted = 0;
  let skipped = 0;
  let linksInserted = 0;

  for (const article of articles) {
    const articleId = generateArticleId(article.awsSourceId);

    try {
      // Check if article already exists
      const existing = await query('SELECT 1 FROM news_articles WHERE article_id = $1', [
        articleId,
      ]);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO news_articles (article_id, aws_source_id, source, title, url, description, raw_html, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          articleId,
          article.awsSourceId,
          SOURCE,
          article.title,
          article.url,
          article.description,
          article.rawHtml,
          article.publishedAt,
        ]
      );
      inserted++;

      // Fetch blog titles and store - only for new articles
      for (const blogUrl of article.blogUrls) {
        const title = await fetchBlogTitle(blogUrl);
        if (!title) continue;

        const linkId = generateLinkId(articleId, blogUrl);
        try {
          await query(
            `INSERT INTO article_links (link_id, article_id, url, title, domain)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [linkId, articleId, blogUrl, title, 'aws.amazon.com']
          );
          linksInserted++;
        } catch (linkError) {
          logger.warn('Failed to store blog post', { articleId, url: blogUrl, error: linkError });
        }
      }
    } catch (error) {
      logger.error('Failed to store article', { articleId, error });
      skipped++;
    }
  }

  logger.info('Storage completed', { inserted, skipped, linksInserted });
  return { inserted, skipped, linksInserted };
}
