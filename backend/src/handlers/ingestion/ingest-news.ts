import crypto from 'node:crypto';
import { query } from '../../lib/db.js';
import { fetchPageOfNews } from '../../lib/aws-news-client.js';

interface IngestionInput {
  startDate?: string;
  endDate?: string;
  daysBack?: number; // Alternative: number of days to look back
}

interface ArticleData {
  title: string;
  url: string;
  description?: string;
  content?: string;
  author?: string;
  publishedAt: string;
}

export const handler = async (event: IngestionInput) => {
  console.log('Starting AWS News ingestion', event);

  const { startDate, endDate, daysBack } = event;

  // Calculate date range
  let start: Date;
  let end: Date = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else if (daysBack) {
    start = new Date();
    start.setDate(start.getDate() - daysBack);
  } else {
    // Default: last 7 days
    start = new Date();
    start.setDate(start.getDate() - 7);
  }

  console.log(`Ingesting news from ${start.toISOString()} to ${end.toISOString()}`);

  try {
    // Fetch articles from AWS News RSS/API
    const articles = await fetchAwsNews(start, end);

    // Store articles in database
    const result = await storeArticles(articles, 'aws-news');

    return {
      statusCode: 200,
      source: 'aws-news',
      articlesProcessed: articles.length,
      articlesInserted: result.inserted,
      articlesSkipped: result.skipped,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  } catch (error) {
    console.error('Error ingesting news:', error);
    throw error;
  }
};

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, '').trim();
}

function generateArticleId(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').substring(0, 32);
}

async function fetchAwsNews(startDate: Date, endDate: Date): Promise<ArticleData[]> {
  console.log('Fetching AWS News articles...');

  const articles: ArticleData[] = [];
  const currentYear = new Date().getFullYear();
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const PAGE_SIZE = 100;

  // Fetch articles for each year in the date range
  // Start from the most recent year in the range (or current year if endDate is in the future)
  const maxYear = Math.min(currentYear, endYear);

  for (let year = maxYear; year >= startYear; year--) {
    console.log(`Fetching What's New for year ${year}...`);

    let pageNumber = 1;
    let shouldContinue = true;
    let totalFetched = 0;

    while (shouldContinue) {
      const response = await fetchPageOfNews({
        year,
        pageNumber,
        pageSize: PAGE_SIZE,
      });

      totalFetched += response.items.length;
      console.log(
        `Page ${pageNumber}: Fetched ${response.items.length} articles (${totalFetched}/${response.metadata.totalHits} total)`
      );

      // Process items on this page
      let foundItemsInRange = false;
      let allItemsTooOld = true;

      for (const { item } of response.items) {
        const url = item.additionalFields.headlineUrl;
        if (!url) continue;

        const publishedAt = new Date(item.additionalFields.postDateTime || item.dateCreated);

        // Check if item is too old (since sorted desc, once we hit old items we can stop)
        if (publishedAt < startDate) {
          continue;
        }

        allItemsTooOld = false;

        // Check if item is in range
        if (publishedAt <= endDate) {
          foundItemsInRange = true;
          articles.push({
            title: item.additionalFields.headline || '',
            url,
            description: stripHtml(item.additionalFields.postBody) || undefined,
            content: undefined,
            author: item.author || undefined,
            publishedAt: publishedAt.toISOString(),
          });
        }
      }

      // Stop conditions:
      // 1. No more items on this page
      // 2. All items are too old (before startDate)
      // 3. We fetched all available items
      if (
        response.items.length === 0 ||
        allItemsTooOld ||
        totalFetched >= response.metadata.totalHits
      ) {
        shouldContinue = false;
      } else {
        pageNumber++;
      }
    }

    console.log(`Year ${year}: Found ${articles.length} total articles so far`);
  }

  console.log(`Found ${articles.length} articles in date range`);
  return articles;
}

async function storeArticles(articles: ArticleData[], source: string) {
  let inserted = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      const articleId = generateArticleId(article.url);

      // Generate content hash for change detection
      const contentHash = article.content
        ? crypto.createHash('sha256').update(article.content).digest('hex')
        : null;

      // Check if article already exists
      const existing = await query(`SELECT article_id FROM news_articles WHERE article_id = $1`, [
        articleId,
      ]);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert new article (full text in description for AI summary generation)
      await query(
        `INSERT INTO news_articles (
          article_id, source, title, url, description, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          articleId,
          source,
          article.title,
          article.url,
          article.description, // Full text - will be replaced by AI summary
          article.publishedAt,
        ]
      );

      inserted++;
    } catch (error) {
      console.error(`Error storing article ${article.url}:`, error);
      // Continue with next article
    }
  }

  return { inserted, skipped };
}
