import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { query, queryOne } from '../../lib/db.js';
import { success, error, badRequest, notFound } from '../../lib/response.js';
import { requireUser } from '../../lib/auth.js';
import { extractHashtags } from '../../lib/hashtags.js';

/**
 * TODO: Use transactions, add retries as multiple users may add/remove tags at
 * the same time (DSQL optimistic concurrency control)
 * Low priority due to the current scope of this project.
 */

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

    // Check if article exists
    const article = await queryOne('SELECT article_id FROM news_articles WHERE article_id = $1', [
      articleId,
    ]);
    if (!article) {
      return notFound('Article not found');
    }

    // Ensure user exists in users table
    await query(
      `
      INSERT INTO users (user_id, email, username, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `,
      [user.userId, user.email, user.username]
    );

    // Create comment
    const commentId = randomUUID();
    await query(
      `
      INSERT INTO comments (comment_id, article_id, user_id, content, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
    `,
      [commentId, articleId, user.userId, content]
    );

    // Extract and store hashtags
    const hashtags = extractHashtags(content);
    for (const hashtag of hashtags) {
      const hashtagId = randomUUID();
      await query(
        `
        INSERT INTO user_hashtags (hashtag_id, article_id, comment_id, hashtag, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (comment_id, hashtag) DO NOTHING
      `,
        [hashtagId, articleId, commentId, hashtag, user.userId]
      );
    }

    return success(
      {
        message: 'Comment created',
        commentId,
        hashtags,
      },
      201
    );
  } catch (err: any) {
    console.error('Error creating comment:', err);
    if (err.message === 'User not authenticated') {
      return error('Unauthorized', 401);
    }
    return error('Failed to create comment');
  }
}
