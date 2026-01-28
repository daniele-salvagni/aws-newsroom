import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryOne, query } from '../../lib/db.js';
import { success, error, notFound } from '../../lib/response.js';
import { getUserFromEvent } from '../../lib/auth.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('articles-get');

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
  url: string;
  title: string;
}

/** Get a single article by ID */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const articleId = event.pathParameters?.articleId;

    if (!articleId) {
      return error('Article ID is required', 400);
    }

    const user = getUserFromEvent(event);

    const article = await queryOne<ArticleQueryResult>(
      `SELECT a.*,
              COUNT(DISTINCT c.comment_id)::INTEGER as comment_count,
              COUNT(DISTINCT s.star_id)::INTEGER as star_count
       FROM news_articles a
       LEFT JOIN comments c ON a.article_id = c.article_id
       LEFT JOIN user_starred_articles s ON a.article_id = s.article_id
       WHERE a.article_id = $1
       GROUP BY a.article_id`,
      [articleId]
    );

    if (!article) {
      return notFound('Article not found');
    }

    let isStarred = false;
    if (user) {
      const starredCheck = await queryOne(
        `SELECT star_id FROM user_starred_articles WHERE user_id = $1 AND article_id = $2`,
        [user.userId, articleId]
      );
      isStarred = !!starredCheck;
    }

    // Fetch blog posts for this article
    const blogLinks = await query<ArticleLink>(
      `SELECT url, title FROM article_links WHERE article_id = $1`,
      [articleId]
    );

    return success({
      articleId: article.article_id,
      title: article.title,
      url: article.url,
      description: article.description,
      rawHtml: article.raw_html,
      aiSummary: article.ai_summary,
      publishedAt: article.published_at,
      source: article.source,
      blogCategory: article.blog_category,
      isStarred,
      blogPosts: blogLinks.map((link) => ({ url: link.url, title: link.title })),
      statistics: {
        commentCount: article.comment_count || 0,
        starCount: article.star_count || 0,
      },
    });
  } catch (err) {
    logger.error('Failed to get article', { error: err });
    return error('Failed to get article');
  }
}
