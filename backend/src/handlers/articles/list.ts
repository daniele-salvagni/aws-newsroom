import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error } from '../../lib/response.js';
import { getUserFromEvent } from '../../lib/auth.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('articles-list');

interface ArticleQueryResult {
  article_id: string;
  title: string;
  url: string;
  description: string;
  raw_html: string | null;
  ai_summary: string | null;
  published_at: string;
  source: string;
  blog_category: string | null;
  comment_count: number;
  star_count: number;
}

interface ArticleLink {
  article_id: string;
  url: string;
  title: string;
}

/** List articles with pagination and optional hashtag filtering */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const page = parseInt(params.page || '1', 10);
    const limit = Math.min(parseInt(params.limit || '50', 10), 100);
    const hashtag = params.hashtag;
    const offset = (page - 1) * limit;

    const user = getUserFromEvent(event);

    let sql = `
      SELECT a.article_id, a.title, a.url, a.description, a.raw_html, a.ai_summary,
             a.published_at, a.source, a.blog_category,
             COUNT(DISTINCT c.comment_id)::INTEGER as comment_count,
             COUNT(DISTINCT s.star_id)::INTEGER as star_count
      FROM news_articles a
      LEFT JOIN comments c ON a.article_id = c.article_id
      LEFT JOIN user_starred_articles s ON a.article_id = s.article_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (hashtag) {
      sql += ` AND a.article_id IN (
        SELECT DISTINCT article_id FROM user_hashtags WHERE hashtag = $${paramIndex++}
      )`;
      queryParams.push(hashtag.toLowerCase());
    }

    sql += ` GROUP BY a.article_id
             ORDER BY a.published_at DESC, a.article_id DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    const articles = await query<ArticleQueryResult>(sql, queryParams);
    const articleIds = articles.map((a) => a.article_id);

    const starredArticleIds =
      user && articleIds.length > 0
        ? await query<{ article_id: string }>(
            `SELECT article_id FROM user_starred_articles
             WHERE user_id = $1 AND article_id = ANY($2)`,
            [user.userId, articleIds]
          )
        : [];

    const starredSet = new Set(starredArticleIds.map((s) => s.article_id));

    // Fetch blog posts for articles
    let blogLinks: ArticleLink[] = [];
    if (articleIds.length > 0) {
      blogLinks = await query<ArticleLink>(
        `SELECT article_id, url, title 
         FROM article_links 
         WHERE article_id = ANY($1)`,
        [articleIds]
      );
    }

    // Group all blog posts by article
    const blogLinksByArticle = new Map<string, Array<{ url: string; title: string }>>();
    for (const link of blogLinks) {
      const existing = blogLinksByArticle.get(link.article_id) || [];
      existing.push({ url: link.url, title: link.title });
      blogLinksByArticle.set(link.article_id, existing);
    }

    return success({
      articles: articles.map((a) => ({
        articleId: a.article_id,
        title: a.title,
        url: a.url,
        description: a.description,
        rawHtml: a.raw_html,
        aiSummary: a.ai_summary,
        publishedAt: a.published_at,
        source: a.source,
        blogCategory: a.blog_category,
        commentCount: a.comment_count || 0,
        starCount: a.star_count || 0,
        isStarred: starredSet.has(a.article_id),
        blogPosts: blogLinksByArticle.get(a.article_id) || [],
      })),
      page,
      limit,
      hasMore: articles.length === limit,
    });
  } catch (err) {
    logger.error('Failed to list articles', { error: err });
    return error('Failed to list articles');
  }
}
