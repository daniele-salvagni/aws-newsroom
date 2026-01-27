import { fetchAuthSession } from 'aws-amplify/auth';

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'http://localhost:3001';

async function getAuthHeaders(requireAuth = false): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get auth session:', error);
    }
  }

  return headers;
}

export interface Article {
  articleId: string;
  title: string;
  url: string;
  description: string;
  rawHtml?: string | null;
  aiSummary?: string | null; // Null if not generated yet
  publishedAt: string;
  source: string;
  commentCount: number;
  starCount: number;
  isStarred?: boolean;
  // hashtags?: string[]; // DISABLED
  blogPosts?: Array<{
    title: string;
    url: string;
  }>;
  commentPreviews?: Array<{
    commentId: string;
    displayName: string;
    content: string;
    isOwn?: boolean;
  }>;
}

export interface ArticleDetail extends Article {
  content?: string;
  author?: string;
  isStarred?: boolean;
  statistics: {
    commentCount: number;
    starCount: number;
  };
}

export interface Comment {
  commentId: string;
  userId: string;
  username: string;
  displayName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  replies: Comment[];
}

export async function listArticles(params?: {
  page?: number;
  limit?: number;
  hashtag?: string;
}): Promise<{ articles: Article[]; page: number; limit: number; hasMore: boolean }> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.hashtag) queryParams.set('hashtag', params.hashtag);

  const response = await fetch(`${API_ENDPOINT}/articles?${queryParams}`, {
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to fetch articles');
  return response.json();
}

export async function getArticle(articleId: string): Promise<ArticleDetail> {
  const response = await fetch(`${API_ENDPOINT}/articles/${articleId}`, {
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to fetch article');
  return response.json();
}

export async function starArticle(articleId: string, notes?: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINT}/articles/${articleId}/star`, {
    method: 'POST',
    headers: await getAuthHeaders(true), // Requires auth
    body: JSON.stringify({ notes }),
  });

  if (!response.ok) throw new Error('Failed to star article');
}

export async function unstarArticle(articleId: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINT}/articles/${articleId}/star`, {
    method: 'DELETE',
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to unstar article');
}

export async function listComments(
  articleId: string
): Promise<{ comments: Comment[]; total: number }> {
  const response = await fetch(`${API_ENDPOINT}/articles/${articleId}/comments`, {
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to fetch comments');
  return response.json();
}

export async function createComment(
  articleId: string,
  content: string,
  parentCommentId?: string
): Promise<{ commentId: string; username: string }> {
  const response = await fetch(`${API_ENDPOINT}/articles/${articleId}/comments`, {
    method: 'POST',
    headers: await getAuthHeaders(true), // Requires auth
    body: JSON.stringify({ content, parentCommentId }),
  });

  if (!response.ok) throw new Error('Failed to create comment');
  return response.json();
}

export async function deleteComment(commentId: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINT}/comments/${commentId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to delete comment');
}

export async function batchComments(articleIds: string[]): Promise<{
  commentsByArticle: Record<
    string,
    Array<{
      commentId: string;
      displayName: string;
      content: string;
    }>
  >;
}> {
  const response = await fetch(`${API_ENDPOINT}/comments/batch`, {
    method: 'POST',
    headers: await getAuthHeaders(true), // Requires auth
    body: JSON.stringify({ articleIds }),
  });

  if (!response.ok) throw new Error('Failed to fetch batch comments');
  return response.json();
}

export async function getStarredArticles(): Promise<{
  starredArticles: Array<{
    starId: string;
    starredAt: string;
    notes?: string;
    article: Article;
  }>;
}> {
  const response = await fetch(`${API_ENDPOINT}/user/starred`, {
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to fetch starred articles');
  return response.json();
}

export async function getPopularHashtags(limit = 20): Promise<{
  hashtags: Array<{
    hashtag: string;
    articleCount: number;
    usageCount: number;
  }>;
}> {
  const response = await fetch(`${API_ENDPOINT}/hashtags/popular?limit=${limit}`, {
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to fetch popular hashtags');
  return response.json();
}

export async function getUpcomingEvent(): Promise<{
  event: {
    eventId: string;
    title: string;
    url: string;
    category: string;
    startTime: string;
    endTime: string;
  } | null;
}> {
  const response = await fetch(`${API_ENDPOINT}/events/upcoming`, {
    headers: await getAuthHeaders(true), // Requires auth
  });

  if (!response.ok) throw new Error('Failed to fetch upcoming event');
  return response.json();
}
