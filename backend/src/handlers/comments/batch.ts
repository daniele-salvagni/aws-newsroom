import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error, badRequest } from '../../lib/response.js';
import { getUserFromEvent } from '../../lib/auth.js';

interface CommentQueryResult {
  article_id: string;
  comment_id: string;
  user_id: string;
  username: string | null;
  content: string;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const articleIds = body.articleIds;

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return badRequest('articleIds array is required');
    }

    if (articleIds.length > 100) {
      return badRequest('Maximum 100 article IDs allowed');
    }

    // Enforced by API Gateway anyway, but could be optional
    const user = getUserFromEvent(event);

    // Batch fetch comment previews for multiple articles
    const commentPreviews = await query<CommentQueryResult>(
      `
      SELECT
        c.article_id,
        c.comment_id,
        c.user_id,
        u.username,
        c.content
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.user_id
      WHERE c.article_id = ANY($1)
      ORDER BY c.article_id, c.created_at ASC
    `,
      [articleIds]
    );

    // Group comments by article
    const commentsByArticle: Record<string, any[]> = {};
    commentPreviews.forEach((c) => {
      if (!commentsByArticle[c.article_id]) {
        commentsByArticle[c.article_id] = [];
      }
      commentsByArticle[c.article_id].push({
        commentId: c.comment_id,
        displayName: c.username || 'Anonymous',
        content: c.content,
        isOwn: user ? c.user_id === user.userId : false,
      });
    });

    return success({ commentsByArticle });
  } catch (err) {
    console.error('Error fetching batch comments:', err);
    return error('Failed to fetch comments');
  }
}
