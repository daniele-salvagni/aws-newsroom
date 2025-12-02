import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error, badRequest } from '../../lib/response.js';

interface CommentQueryResult {
  comment_id: string;
  article_id: string;
  user_id: string;
  username: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const articleId = event.pathParameters?.articleId;

    if (!articleId) {
      return badRequest('Article ID is required');
    }

    // Get all comments for the article
    const comments = await query<CommentQueryResult>(
      `
      SELECT
        c.comment_id, c.article_id, c.user_id,
        c.content, c.created_at, c.updated_at,
        u.username
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.user_id
      WHERE c.article_id = $1
      ORDER BY c.created_at ASC
    `,
      [articleId]
    );

    // Map comments to response format
    const formattedComments = comments.map((c) => ({
      commentId: c.comment_id,
      userId: c.user_id,
      username: c.username || 'Anonymous',
      displayName: c.username || 'Anonymous',
      content: c.content,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      likeCount: 0,
      replies: [],
    }));

    return success({
      comments: formattedComments,
      total: comments.length,
    });
  } catch (err) {
    console.error('Error listing comments:', err);
    return error('Failed to list comments');
  }
}
