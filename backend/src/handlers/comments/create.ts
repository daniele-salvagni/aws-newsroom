import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { query, queryOne } from '../../lib/db.js';
import { success, error, badRequest, notFound } from '../../lib/response.js';
import { requireUser } from '../../lib/auth.js';
import { extractHashtags } from '../../lib/hashtags.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('comments-create');

/** Create a comment on an article */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = requireUser(event);
    const articleId = event.pathParameters?.articleId;

    if (!articleId) {
      return badRequest('Article ID is required');
    }

    const body = JSON.parse(event.body || '{}');
    const content = body.content?.trim();

    if (!content || content.length === 0) {
      return badRequest('Comment content is required');
    }

    if (content.length > 5000) {
      return badRequest('Comment is too long (max 5000 characters)');
    }

    const article = await queryOne('SELECT article_id FROM news_articles WHERE article_id = $1', [
      articleId,
    ]);
    if (!article) {
      return notFound('Article not found');
    }

    const commentId = randomUUID();
    await query(
      `INSERT INTO comments (comment_id, article_id, user_id, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [commentId, articleId, user.userId, content]
    );

    // Extract and store hashtags
    const hashtags = extractHashtags(content);
    for (const hashtag of hashtags) {
      await query(
        `INSERT INTO user_hashtags (hashtag_id, article_id, comment_id, hashtag, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (comment_id, hashtag) DO NOTHING`,
        [randomUUID(), articleId, commentId, hashtag, user.userId]
      );
    }

    logger.info('Comment created', { commentId, articleId, hashtags });

    return success(
      { message: 'Comment created', commentId, username: user.username, hashtags },
      201
    );
  } catch (err: any) {
    if (err.message === 'User not authenticated') {
      return error('Unauthorized', 401);
    }
    logger.error('Failed to create comment', { error: err });
    return error('Failed to create comment');
  }
}
