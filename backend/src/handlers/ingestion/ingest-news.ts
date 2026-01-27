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
  const end = new Date();

  if (input.startDate && input.endDate) {
    return { start: input.startDate, end: input.endDate };
  }

  const start = new Date();
  start.setDate(start.getDate() - (input.daysBack ?? 7));
  return { start: start.toISOString(), end: end.toISOString() };
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

      articles.push({
        awsSourceId: item.item.id,
        title: item.item.additionalFields.headline || '',
        url: item.item.additionalFields.headlineUrl!,
        description: stripHtml(item.item.additionalFields.postBody),
        publishedAt: publishedAt.toISOString(),
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
function stripHtml(html: string | null | undefined): string | undefined {
  return html?.replace(/<[^>]*>/g, '').trim() || undefined;
}

/** Generate deterministic article ID */
function generateArticleId(awsSourceId: string): string {
  return crypto.createHash('sha256').update(awsSourceId).digest('hex').substring(0, 32);
}

/** Store articles in database, skipping duplicates */
async function storeArticles(articles: Awaited<ReturnType<typeof fetchArticlesInRange>>) {
  let inserted = 0;
  let skipped = 0;

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
        `INSERT INTO news_articles (article_id, aws_source_id, source, title, url, description, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          articleId,
          article.awsSourceId,
          SOURCE,
          article.title,
          article.url,
          article.description,
          article.publishedAt,
        ]
      );
      inserted++;
    } catch (error) {
      logger.error('Failed to store article', { articleId, error });
      skipped++;
    }
  }

  logger.info('Storage completed', { inserted, skipped });
  return { inserted, skipped };
}
