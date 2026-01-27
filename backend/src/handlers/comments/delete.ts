import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error, badRequest } from '../../lib/response.js';
import { requireUser } from '../../lib/auth.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('comments-delete');

/** Delete a comment and its associated hashtags */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = requireUser(event);
    const commentId = event.pathParameters?.commentId;

    if (!commentId) {
      return badRequest('Comment ID is required');
    }

    const comments = await query<{ user_id: string }>(
      `SELECT user_id FROM comments WHERE comment_id = $1`,
      [commentId]
    );

    if (comments.length === 0) {
      return error('Comment not found', 404);
    }

    if (comments[0].user_id !== user.userId) {
      return error('You can only delete your own comments', 403);
    }

    await query(`DELETE FROM user_hashtags WHERE comment_id = $1`, [commentId]);
    await query(`DELETE FROM comments WHERE comment_id = $1`, [commentId]);

    logger.info('Comment deleted', { commentId });

    return success({ message: 'Comment deleted successfully' });
  } catch (err: any) {
    if (err.message === 'User not authenticated') {
      return error('Unauthorized', 401);
    }
    logger.error('Failed to delete comment', { error: err });
    return error('Failed to delete comment');
  }
}
