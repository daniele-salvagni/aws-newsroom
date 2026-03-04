import crypto from 'node:crypto';
import { query } from '../../lib/db.js';
import { fetchNewsInDateRange, type NewsItem } from '../../lib/aws-news/index.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('ingest-news');
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

  const articles = await fetchArticles(start, end);
  const result = await storeArticles(articles);

  logger.info('Ingestion completed', { ...result, total: articles.length });
  return { statusCode: 200, ...result, dateRange: { start, end } };
};

/** Calculate date range from input parameters */
function getDateRange(input: IngestionInput): { start: string; end: string } {
  if (input.endDate && !input.startDate) {
    throw new Error('endDate requires startDate to be specified');
  }

  const now = new Date();
  const end = input.endDate ?? now.toISOString();

  if (input.startDate) {
    return { start: input.startDate, end };
  }

  const start = new Date();
  start.setDate(start.getDate() - (input.daysBack ?? 7));
  return { start: start.toISOString(), end };
}

/** Fetch articles within date range */
async function fetchArticles(startDate: string, endDate: string) {
  const items = await fetchNewsInDateRange({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  const articles = items
    .filter((item) => item.item.additionalFields.headlineUrl)
    .map((item) => {
      const postBody = item.item.additionalFields.postBody;
      return {
        awsSourceId: item.item.id,
        title: item.item.additionalFields.headline || '',
        url: item.item.additionalFields.headlineUrl!,
        description: stripHtml(postBody),
        rawHtml: postBody || null,
        publishedAt: getPublishedDate(item).toISOString(),
        blogUrls: extractBlogUrls(postBody),
      };
    });

  logger.info('Articles fetched', { count: articles.length });
  return articles;
}

/** Extract published date from news item */
function getPublishedDate(item: NewsItem): Date {
  return new Date(item.item.additionalFields.postDateTime || item.item.dateCreated);
}

/** Strip HTML tags from string */
export function stripHtml(html: string | null | undefined): string | undefined {
  return html?.replace(/<[^>]*>/g, '').trim() || undefined;
}

/** Extract AWS blog URLs from HTML content */
export function extractBlogUrls(html: string | null | undefined): string[] {
  if (!html) return [];

  const urls: string[] = [];
  const seen = new Set<string>();
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
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

    let title = titleMatch[1].trim();
    title = title.replace(/\s*\|.*$/, '').trim();

    return title || null;
  } catch {
    return null;
  }
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
async function storeArticles(articles: Awaited<ReturnType<typeof fetchArticles>>) {
  let inserted = 0;
  let skipped = 0;
  let linksInserted = 0;

  for (const article of articles) {
    const articleId = generateArticleId(article.awsSourceId);

    try {
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
