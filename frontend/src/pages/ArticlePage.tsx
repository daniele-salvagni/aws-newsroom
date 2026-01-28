import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import CustomAuthenticator from '../components/CustomAuthenticator';
import {
  getArticle,
  starArticle,
  unstarArticle,
  listComments,
  createComment,
  deleteComment,
  ArticleDetail,
  Comment,
} from '../lib/api';
import HashtagText from '../components/HashtagText';

export default function ArticlePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { user } = useAuthenticator((context) => [context.user]);
  const navigate = useNavigate();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [starring, setStarring] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [localStarCount, setLocalStarCount] = useState(0);

  useEffect(() => {
    if (articleId) {
      loadArticle();
      loadComments();
    }
  }, [articleId]);

  const loadArticle = async () => {
    try {
      const data = await getArticle(articleId!);
      setArticle(data);
      setIsStarred(data.isStarred || false);
      setLocalStarCount(data.statistics.starCount || 0);
    } catch (err) {
      console.error('Failed to load article:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const data = await listComments(articleId!);
      setComments(data.comments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  const handleStar = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      setStarring(true);
      if (isStarred) {
        await unstarArticle(articleId!);
        setLocalStarCount((prev: number) => Math.max(0, prev - 1));
        setIsStarred(false);
      } else {
        await starArticle(articleId!);
        setLocalStarCount((prev: number) => prev + 1);
        setIsStarred(true);
      }
    } catch (err) {
      console.error('Failed to toggle star:', err);
    } finally {
      setStarring(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      await createComment(articleId!, commentText);
      setCommentText('');
      loadComments();
      loadArticle(); // Refresh comment count
    } catch (err) {
      console.error('Failed to comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await deleteComment(commentId);
      loadComments();
      loadArticle(); // Refresh comment count
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment');
    }
  };

  const renderComment = (comment: Comment) => {
    const isOwnComment = user && comment.userId === user.userId;

    return (
      <div key={comment.commentId} className="text-sm text-gray-600 dark:text-stone-400 group py-1">
        <span className="font-medium text-gray-900 dark:text-stone-200">{comment.displayName}</span>
        <span className="text-gray-400 dark:text-stone-600 mx-1">·</span>
        <span className="text-gray-400 dark:text-stone-600">
          {new Date(comment.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {isOwnComment && (
          <button
            onClick={() => handleDeleteComment(comment.commentId)}
            className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
            title="Delete comment"
          >
            ×
          </button>
        )}
        <div className="mt-1">
          <HashtagText
            text={comment.content}
            onHashtagClick={(hashtag) => navigate(`/?hashtag=${hashtag}`)}
          />
        </div>
        {comment.replies.length > 0 && (
          <div className="ml-4 mt-2 space-y-1 border-l border-gray-200 dark:border-stone-700 pl-3">
            {comment.replies.map(renderComment)}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-stone-600 border-t-black dark:border-t-white"></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500 dark:text-stone-500 mb-2">Article not found</p>
        <Link to="/" className="text-sm hover:underline text-gray-700 dark:text-stone-300">
          ← Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 pb-3 border-b border-gray-200 dark:border-stone-800">
        <Link to="/" className="text-xs text-gray-600 dark:text-stone-400 hover:text-black dark:hover:text-white hover:underline">
          ← back
        </Link>
      </div>

      <article className="border-b border-gray-200 dark:border-stone-800 pb-6 mb-6">
        <div className="flex items-start justify-between gap-2 mb-1">
          <a
            href={
              article.url.startsWith('http') ? article.url : `https://aws.amazon.com${article.url}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            <h1 className="text-sm font-medium text-black dark:text-stone-100 line-clamp-2 mb-2">{article.title}</h1>
          </a>
        </div>

        {(article.rawHtml || article.description) && (
          <div className="text-sm text-gray-600 dark:text-stone-400 mb-3 leading-relaxed">
            {article.rawHtml ? (
              <div 
                className="[&_a]:text-violet-600 dark:[&_a]:text-violet-400 [&_a]:underline [&_a:hover]:text-violet-800 dark:[&_a:hover]:text-violet-300"
                dangerouslySetInnerHTML={{ __html: article.rawHtml }} 
              />
            ) : (
              article.description
            )}
          </div>
        )}

        {article.blogPosts && article.blogPosts.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {article.blogPosts.map((blogPost, idx) => (
              <a
                key={idx}
                href={blogPost.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-stone-800 border border-gray-200 dark:border-stone-700 rounded hover:border-gray-400 dark:hover:border-stone-500 transition-all group text-xs"
                title={blogPost.title}
              >
                <span>📝</span>
                <span className="text-gray-600 dark:text-stone-400 group-hover:text-gray-900 dark:group-hover:text-stone-200 truncate max-w-[450px]">{blogPost.title}</span>
                <span className="text-gray-400 dark:text-stone-500 group-hover:text-gray-600 dark:group-hover:text-stone-300">↗</span>
              </a>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-stone-500 mb-1">
          <span>
            {new Date(article.publishedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {article.author && (
            <>
              <span className="text-gray-300 dark:text-stone-600">·</span>
              <span>{article.author}</span>
            </>
          )}
          <span className="text-gray-300 dark:text-stone-600">·</span>
          <button
            onClick={handleStar}
            disabled={starring || !user}
            className={`${
              isStarred ? 'text-black dark:text-white' : 'text-gray-300 dark:text-stone-600'
            } hover:text-black dark:hover:text-white disabled:opacity-50 cursor-pointer transition-colors`}
            title={
              user ? (isStarred ? 'Unstar this article' : 'Star this article') : 'Sign in to star'
            }
          >
            {starring ? '...' : `★ ${localStarCount}`}
          </button>
        </div>
      </article>

      <div>
        <h2 className="text-sm font-medium mb-3 text-black dark:text-white">Comments ({comments.length})</h2>

        <form onSubmit={handleComment} className="mb-4">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-2 py-1.5 border border-gray-300 dark:border-stone-600 rounded text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white dark:bg-stone-800 dark:text-stone-100 mb-2"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="text-sm px-3 py-1 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer rounded"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>

        <div className="space-y-2">{comments.map(renderComment)}</div>

        {comments.length === 0 && (
          <p className="text-center text-xs text-gray-500 dark:text-stone-500 py-6 italic">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-stone-800 border border-gray-200 dark:border-stone-700 p-6 max-w-md w-full rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-black dark:text-white">Sign in required</h3>
            <p className="text-sm text-gray-600 dark:text-stone-400 mb-4">Please sign in to interact with articles.</p>
            <CustomAuthenticator />
            <button
              onClick={() => setShowAuthModal(false)}
              className="mt-4 text-sm text-gray-600 dark:text-stone-400 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
