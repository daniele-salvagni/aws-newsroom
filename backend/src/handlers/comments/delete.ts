import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error, badRequest } from '../../lib/response.js';
import { requireUser } from '../../lib/auth.js';

/**
 * TODO: Use transactions, add retries as multiple users may add/remove tags at
 * the same time (DSQL optimistic concurrency control)
 * Low priority due to the current scope of this project.
 */

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = requireUser(event);
    const commentId = event.pathParameters?.commentId;

    if (!commentId) {
      return badRequest('Comment ID is required');
    }

    // Check if comment exists and belongs to user
    const comments = await query(
      `
      SELECT user_id
      FROM comments
      WHERE comment_id = $1
    `,
      [commentId]
    );

    if (comments.length === 0) {
      return error('Comment not found', 404);
    }

    const comment = comments[0];

    if (comment.user_id !== user.userId) {
      return error('You can only delete your own comments', 403);
    }

    // Delete associated hashtags
    await query(
      `
      DELETE FROM user_hashtags
      WHERE comment_id = $1
    `,
      [commentId]
    );

    // Hard delete the comment
    await query(
      `
      DELETE FROM comments
      WHERE comment_id = $1
    `,
      [commentId]
    );

    return success({ message: 'Comment deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting comment:', err);
    if (err.message === 'User not authenticated') {
      return error('Unauthorized', 401);
    }
    return error('Failed to delete comment');
  }
}
