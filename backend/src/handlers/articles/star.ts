import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { query, queryOne } from '../../lib/db.js';
import { success, error, badRequest, notFound } from '../../lib/response.js';
import { requireUser } from '../../lib/auth.js';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = requireUser(event);
    const articleId = event.pathParameters?.articleId;
    const method = event.httpMethod;

    if (!articleId) {
      return badRequest('Article ID is required');
    }

    // Check if article exists
    const article = await queryOne('SELECT article_id FROM news_articles WHERE article_id = $1', [
      articleId,
    ]);
    if (!article) {
      return notFound('Article not found');
    }

    if (method === 'POST') {
      // Star article
      await query(
        `
        INSERT INTO user_starred_articles (star_id, user_id, article_id, starred_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, article_id) DO NOTHING
      `,
        [randomUUID(), user.userId, articleId]
      );

      return success({ message: 'Article starred' });
    } else if (method === 'DELETE') {
      // Unstar article
      await query(
        `
        DELETE FROM user_starred_articles
        WHERE user_id = $1 AND article_id = $2
      `,
        [user.userId, articleId]
      );

      return success({ message: 'Article unstarred' });
    }

    return badRequest('Invalid method');
  } catch (err: any) {
    console.error('Error starring/unstarring article:', err);
    if (err.message === 'User not authenticated') {
      return error('Unauthorized', 401);
    }
    return error('Failed to star/unstar article');
  }
}
