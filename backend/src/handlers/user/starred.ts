import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { success, error } from '../../lib/response.js';
import { requireUser } from '../../lib/auth.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('user-starred');

interface StarredArticleQueryResult {
  star_id: string;
  starred_at: string;
  article_id: string;
  title: string;
  url: string;
  description: string;
  raw_html: string | null;
  ai_summary: string;
  published_at: string;
  source: string;
  blog_category: string;
  comment_count: string;
  star_count: string;
}

interface ArticleLink {
  article_id: string;
  url: string;
  title: string;
}

/** Get all starred articles for the current user */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = requireUser(event);

    const starredArticles = await query<StarredArticleQueryResult>(
      `SELECT sa.star_id, sa.starred_at,
              a.article_id, a.title, a.url, a.description, a.raw_html, a.ai_summary,
              a.published_at, a.source, a.blog_category,
              COUNT(DISTINCT c.comment_id)::INTEGER as comment_count,
              COUNT(DISTINCT s.star_id)::INTEGER as star_count
       FROM user_starred_articles sa
       JOIN news_articles a ON sa.article_id = a.article_id
       LEFT JOIN comments c ON a.article_id = c.article_id
       LEFT JOIN user_starred_articles s ON a.article_id = s.article_id
       WHERE sa.user_id = $1
       GROUP BY sa.star_id, sa.starred_at, a.article_id
       ORDER BY a.published_at DESC, a.article_id DESC`,
      [user.userId]
    );

    // Fetch blog posts for starred articles
    const articleIds = starredArticles.map((sa) => sa.article_id);
    let blogLinks: ArticleLink[] = [];
    if (articleIds.length > 0) {
      blogLinks = await query<ArticleLink>(
        `SELECT article_id, url, title 
         FROM article_links 
         WHERE article_id = ANY($1)`,
        [articleIds]
      );
    }

    // Group blog posts by article
    const blogLinksByArticle = new Map<string, Array<{ url: string; title: string }>>();
    for (const link of blogLinks) {
      const existing = blogLinksByArticle.get(link.article_id) || [];
      existing.push({ url: link.url, title: link.title });
      blogLinksByArticle.set(link.article_id, existing);
    }

    return success({
      starredArticles: starredArticles.map((sa) => ({
        starId: sa.star_id,
        starredAt: sa.starred_at,
        article: {
          articleId: sa.article_id,
          title: sa.title,
          url: sa.url,
          description: sa.description,
          rawHtml: sa.raw_html,
          aiSummary: sa.ai_summary,
          publishedAt: sa.published_at,
          source: sa.source,
          blogCategory: sa.blog_category,
          commentCount: parseInt(sa.comment_count) || 0,
          starCount: parseInt(sa.star_count) || 0,
          isStarred: true,
          blogPosts: blogLinksByArticle.get(sa.article_id) || [],
        },
      })),
    });
  } catch (err: any) {
    if (err.message === 'User not authenticated') {
      return error('Unauthorized', 401);
    }
    logger.error('Failed to get starred articles', { error: err });
    return error('Failed to get starred articles');
  }
}
