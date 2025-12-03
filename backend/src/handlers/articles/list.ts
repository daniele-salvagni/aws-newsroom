import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error } from '../../lib/response.js';
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
    const params = event.queryStringParameters || {};
    const page = parseInt(params.page || '1', 10);
    const limit = Math.min(parseInt(params.limit || '50', 10), 100);
    const source = params.source;
    const hashtag = params.hashtag;

    const offset = (page - 1) * limit;

    // Enforced by API Gateway anyway, but could be optional
    const user = getUserFromEvent(event);

    let sql = `
      SELECT
        a.article_id,
        a.title,
        a.url,
        a.description,
        a.ai_summary,
        a.published_at,
        a.source,
        a.blog_category,
        COUNT(DISTINCT c.comment_id)::INTEGER as comment_count,
        COUNT(DISTINCT s.star_id)::INTEGER as star_count
      FROM news_articles a
      LEFT JOIN comments c ON a.article_id = c.article_id
      LEFT JOIN user_starred_articles s ON a.article_id = s.article_id
      WHERE 1=1
    `; // WHERE 1=1 is a trick for dynamic query building

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (source) {
      sql += ` AND a.source = $${paramIndex++}`;
      queryParams.push(source);
    }

    if (hashtag) {
      sql += `
        AND a.article_id IN (
          SELECT DISTINCT article_id FROM user_hashtags
          WHERE hashtag = $${paramIndex++}
        )
      `;
      queryParams.push(hashtag.toLowerCase());
    }

    sql += ` GROUP BY a.article_id ORDER BY a.published_at DESC, a.article_id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    const articles = await query<ArticleQueryResult>(sql, queryParams);

    // Get article IDs for batch queries
    const articleIds = articles.map((a) => a.article_id);

    // Batch fetch user's starred articles
    const starredArticleIds =
      user && articleIds.length > 0
        ? await query<{ article_id: string }>(
            `
          SELECT article_id
          FROM user_starred_articles
          WHERE user_id = $1 AND article_id = ANY($2)
          `,
            [user.userId, articleIds]
          )
        : [];

    const starredSet = new Set(starredArticleIds.map((s) => s.article_id));

    // DISABLED
    // const hashtagsResult = articleIds.length > 0 ? await query<{ article_id: string; hashtag: string }>(`
    //   SELECT DISTINCT article_id, hashtag
    //   FROM user_hashtags
    //   WHERE article_id = ANY($1)
    //   ORDER BY hashtag
    // `, [articleIds]) : [];

    // Group hashtags by article
    // const hashtagsByArticle = new Map<string, string[]>();
    // for (const row of hashtagsResult) {
    //   if (!hashtagsByArticle.has(row.article_id)) {
    //     hashtagsByArticle.set(row.article_id, []);
    //   }
    //   hashtagsByArticle.get(row.article_id)!.push(row.hashtag);
    // }

    return success({
      articles: articles.map((a) => ({
        articleId: a.article_id,
        title: a.title,
        url: a.url,
        description: a.description,
        aiSummary: a.ai_summary,
        publishedAt: a.published_at,
        source: a.source,
        blogCategory: a.blog_category,
        commentCount: a.comment_count || 0,
        starCount: a.star_count || 0,
        isStarred: starredSet.has(a.article_id),
        // hashtags: hashtagsByArticle.get(a.article_id) || [], // DISABLED
      })),
      page,
      limit,
      hasMore: articles.length === limit,
    });
  } catch (err) {
    console.error('Error listing articles:', err);
    return error('Failed to list articles');
  }
}
