import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { queryOne } from '../../lib/db.js';
import { success, error, notFound } from '../../lib/response.js';
import { getUserFromEvent } from '../../lib/auth.js';

interface ArticleQueryResult {
  article_id: string;
  title: string;
  url: string;
  description: string;
  ai_summary: string | null;
  published_at: string;
  source: string;
  blog_category: string | null;
  comment_count: number;
  star_count: number;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const articleId = event.pathParameters?.articleId;

    if (!articleId) {
      return error('Article ID is required', 400);
    }

    // Enforced by API Gateway anyway, but could be optional
    const user = getUserFromEvent(event);

    const article = await queryOne<ArticleQueryResult>(
      `
      SELECT
        a.*,
        COUNT(DISTINCT c.comment_id)::INTEGER as comment_count,
        COUNT(DISTINCT s.star_id)::INTEGER as star_count
      FROM news_articles a
      LEFT JOIN comments c ON a.article_id = c.article_id
      LEFT JOIN user_starred_articles s ON a.article_id = s.article_id
      WHERE a.article_id = $1
      GROUP BY a.article_id
    `,
      [articleId]
    );

    if (!article) {
      return notFound('Article not found');
    }

    // Check if current user has starred this article
    let isStarred = false;
    if (user) {
      const starredCheck = await queryOne(
        `
        SELECT star_id FROM user_starred_articles
        WHERE user_id = $1 AND article_id = $2
      `,
        [user.userId, articleId]
      );
      isStarred = !!starredCheck;
    }

    return success({
      articleId: article.article_id,
      title: article.title,
      url: article.url,
      description: article.description,
      aiSummary: article.ai_summary,
      publishedAt: article.published_at,
      source: article.source,
      blogCategory: article.blog_category,
      isStarred,
      statistics: {
        commentCount: article.comment_count || 0,
        starCount: article.star_count || 0,
      },
    });
  } catch (err) {
    console.error('Error getting article:', err);
    return error('Failed to get article');
  }
}
