import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error } from '../../lib/response.js';
import { requireUser } from '../../lib/auth.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('user-starred');

interface StarredArticleQueryResult {
  star_id: string;
  starred_at: string;
  article_id: string;
  title: string;
  url: string;
  description: string;
  ai_summary: string;
  published_at: string;
  source: string;
  blog_category: string;
  comment_count: string;
  star_count: string;
}

/** Get all starred articles for the current user */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = requireUser(event);

    const starredArticles = await query<StarredArticleQueryResult>(
      `SELECT sa.star_id, sa.starred_at,
              a.article_id, a.title, a.url, a.description, a.ai_summary,
              a.published_at, a.source, a.blog_category,
              COUNT(DISTINCT c.comment_id)::INTEGER as comment_count,
              COUNT(DISTINCT s.star_id)::INTEGER as star_count
       FROM user_starred_articles sa
       JOIN news_articles a ON sa.article_id = a.article_id
       LEFT JOIN comments c ON a.article_id = c.article_id
       LEFT JOIN user_starred_articles s ON a.article_id = s.article_id
       WHERE sa.user_id = $1
       GROUP BY sa.star_id, sa.starred_at, a.article_id
       ORDER BY a.published_at DESC, a.article_id DESC`,
      [user.userId]
    );

    return success({
      starredArticles: starredArticles.map((sa) => ({
        starId: sa.star_id,
        starredAt: sa.starred_at,
        article: {
          articleId: sa.article_id,
          title: sa.title,
          url: sa.url,
          description: sa.description,
          aiSummary: sa.ai_summary,
          publishedAt: sa.published_at,
          source: sa.source,
          blogCategory: sa.blog_category,
          commentCount: parseInt(sa.comment_count) || 0,
          starCount: parseInt(sa.star_count) || 0,
          isStarred: true,
        },
      })),
    });
  } catch (err: any) {
    if (err.message === 'User not authenticated') {
      return error('Unauthorized', 401);
    }
    logger.error('Failed to get starred articles', { error: err });
    return error('Failed to get starred articles');
  }
}
