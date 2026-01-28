import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error } from '../../lib/response.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('hashtags-popular');

interface HashtagQueryResult {
  hashtag: string;
  article_count: number;
  usage_count: number;
}

/** Get most popular hashtags by article count */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const limit = Math.min(parseInt(params.limit || '20', 10), 100);

    const hashtags = await query<HashtagQueryResult>(
      `SELECT hashtag,
              COUNT(DISTINCT article_id)::INTEGER as article_count,
              COUNT(DISTINCT comment_id)::INTEGER as usage_count
       FROM user_hashtags
       GROUP BY hashtag
       ORDER BY article_count DESC, usage_count DESC
       LIMIT $1`,
      [limit]
    );

    return success({
      hashtags: hashtags.map((h) => ({
        hashtag: h.hashtag,
        articleCount: h.article_count,
        usageCount: h.usage_count,
      })),
    });
  } catch (err) {
    logger.error('Failed to fetch popular hashtags', { error: err });
    return error('Failed to fetch popular hashtags');
  }
}
