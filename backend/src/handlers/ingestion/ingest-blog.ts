import crypto from 'node:crypto';
import { query } from '../../lib/db.js';
import { fetchPageOfBlogs } from '../../lib/aws-news-client.js';

interface IngestionInput {
  startDate?: string;
  endDate?: string;
  daysBack?: number;
}

interface BlogArticle {
  title: string;
  url: string;
  description?: string;
  content?: string;
  author?: string;
  publishedAt: string;
  category?: string;
}

export const handler = async (event: IngestionInput) => {
  console.log('Starting AWS Blog ingestion', event);

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

  console.log(`Ingesting blog posts from ${start.toISOString()} to ${end.toISOString()}`);

  try {
    // Fetch articles from AWS Blog RSS/API
    const articles = await fetchAwsBlog(start, end);

    // Store articles in database
    const result = await storeArticles(articles, 'aws-blog');

    return {
      statusCode: 200,
      source: 'aws-blog',
      articlesProcessed: articles.length,
      articlesInserted: result.inserted,
      articlesSkipped: result.skipped,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    };
  } catch (error) {
    console.error('Error ingesting blog:', error);
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

async function fetchAwsBlog(startDate: Date, endDate: Date): Promise<BlogArticle[]> {
  console.log('Fetching AWS News Blog articles...');

  const articles: BlogArticle[] = [];
  const PAGE_SIZE = 100;

  let pageNumber = 1;
  let shouldContinue = true;
  let totalFetched = 0;
  let filteredCount = 0;

  while (shouldContinue) {
    // Fetch blog posts with "news" category tag
    const response = await fetchPageOfBlogs({
      pageNumber,
      pageSize: PAGE_SIZE,
      categoryTag: 'blog-posts#category#news',
    });

    totalFetched += response.items.length;
    console.log(
      `Page ${pageNumber}: Fetched ${response.items.length} blog posts (${totalFetched}/${response.metadata.totalHits} total)`
    );

    let foundItemsInRange = false;
    let allItemsTooOld = true;

    for (const { item, tags } of response.items) {
      const url = item.additionalFields.link;
      if (!url) continue;

      // Only process posts from the AWS News Blog (/blogs/aws/)
      if (!url.includes('/blogs/aws/')) {
        filteredCount++;
        continue;
      }

      const publishedAt = new Date(item.additionalFields.createdDate || item.dateCreated);

      // Check if item is too old (since sorted desc, once we hit old items we can stop)
      if (publishedAt < startDate) {
        continue;
      }

      allItemsTooOld = false;

      // Check if item is in range
      if (publishedAt <= endDate) {
        foundItemsInRange = true;

        // Extract category from tags for storage
        const categoryTag = tags.find((t: any) => t.id.startsWith('blog-posts#category#'));
        const category = categoryTag ? categoryTag.name : null;

        // Blog posts only have excerpts - use as description, no content
        const excerpt = stripHtml(item.additionalFields.postExcerpt);

        articles.push({
          title: item.additionalFields.title || '',
          url,
          description: excerpt || undefined,
          content: undefined,
          author: item.author || undefined,
          publishedAt: publishedAt.toISOString(),
          category: category || undefined,
        });
      }
    }

    // Stop conditions:
    // 1. No more items on this page
    // 2. All items are too old (before startDate)
    // 3. We've fetched all available items
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

  console.log(`Filtered out ${filteredCount} non-AWS News Blog posts`);
  console.log(`Found ${articles.length} AWS News Blog posts in date range`);
  return articles;
}

async function storeArticles(articles: BlogArticle[], source: string) {
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

      // Insert new article (blog excerpt as description, no content)
      await query(
        `INSERT INTO news_articles (
          article_id, source, title, url, description, published_at, blog_category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          articleId,
          source,
          article.title,
          article.url,
          article.description, // Blog excerpt
          article.publishedAt,
          article.category,
        ]
      );

      inserted++;
    } catch (error) {
      console.error(`Error storing article ${article.url}:`, error);
    }
  }

  return { inserted, skipped };
}
