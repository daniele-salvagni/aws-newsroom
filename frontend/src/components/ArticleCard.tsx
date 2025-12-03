import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Article, starArticle, unstarArticle, createComment, deleteComment } from '../lib/api';
import HashtagText from './HashtagText';
import StreamingText from './StreamingText';

interface ArticleCardProps {
  article: Article;
  onStarred?: () => void;
  onCommented?: () => void;
  onHashtagClick?: (hashtag: string) => void;
  showPreview?: boolean;
  onTogglePreview: () => void;
  useAiSummary?: boolean;
  isUnread?: boolean;
  isFirstUnread?: boolean;
  onMarkAsRead?: () => void;
}

export default function ArticleCard({
  article,
  onStarred,
  onCommented,
  onHashtagClick,
  showPreview = false,
  onTogglePreview,
  useAiSummary = false,
  isUnread = false,
  isFirstUnread = false,
  onMarkAsRead,
}: ArticleCardProps) {
  const { user } = useAuthenticator((context) => [context.user]);
  const [starring, setStarring] = useState(false);
  const [localStarCount, setLocalStarCount] = useState(article.starCount);
  const [isStarred, setIsStarred] = useState(article.isStarred || false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localComments, setLocalComments] = useState<
    Array<{
      commentId: string;
      displayName: string;
      content: string;
      isOwn?: boolean;
    }>
  >(article.commentPreviews || []);

  const handleStar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Please sign in to star articles');
      return;
    }

    try {
      setStarring(true);
      if (isStarred) {
        await unstarArticle(article.articleId);
        setLocalStarCount((prev: number) => Math.max(0, prev - 1));
        setIsStarred(false);
      } else {
        await starArticle(article.articleId);
        setLocalStarCount((prev: number) => prev + 1);
        setIsStarred(true);
      }
      onStarred?.();
    } catch (err) {
      console.error('Failed to toggle star:', err);
    } finally {
      setStarring(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please sign in to comment');
      return;
    }

    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      const result = await createComment(article.articleId, commentText);

      // Add the new comment to local state
      const newComment = {
        commentId: result.commentId,
        displayName: result.username || 'You',
        content: commentText,
        isOwn: true,
      };
      setLocalComments([...localComments, newComment]);

      setCommentText('');
      setShowCommentBox(false);
      onCommented?.();
    } catch (err) {
      console.error('Failed to comment:', err);
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await deleteComment(commentId);
      setLocalComments(localComments.filter((c) => c.commentId !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isBlog = article.source === 'aws-blog';
  const sourceLabel = isBlog ? 'Blog' : 'News';

  return (
    <div
      className={`py-3 border-b border-gray-100 hover:bg-gray-50 transition-all duration-200 relative pl-3 ${
        isUnread ? 'border-l-2 border-dashed border-l-fuchsia-300' : ''
      }`}
    >
      {isFirstUnread && onMarkAsRead && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onMarkAsRead();
          }}
          className="absolute -left-5 top-0 text-xs text-fuchsia-500 hover:text-gray-800 uppercase tracking-wider cursor-pointer whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          title="Mark all as read"
        >
          ←&nbsp;Unread
        </a>
      )}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center flex-shrink-0 w-5">
          <button
            onClick={handleStar}
            disabled={starring || !user}
            className={`${
              isStarred ? 'text-black' : 'text-gray-300'
            } hover:text-black disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors text-sm`}
            title={
              user ? (isStarred ? 'Unstar this article' : 'Star this article') : 'Sign in to star'
            }
          >
            ★
          </button>
          {localStarCount > 0 && <span className="text-xs text-gray-500">{localStarCount}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="flex items-start justify-between gap-2 mb-1 cursor-pointer hover:underline px-2 py-0 -ml-2 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePreview();
            }}
          >
            <h2 className="text-sm font-medium text-black line-clamp-2 mb-2 flex-1">
              {article.title}
            </h2>
          </div>

          {showPreview && (article.aiSummary || article.description) && (
            <div
              className="text-sm text-gray-600 mb-3 leading-relaxed cursor-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {useAiSummary && article.aiSummary && (
                <span className="mr-1.5 text-xs font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent uppercase tracking-wide">
                  AI Summary:
                </span>
              )}
              {useAiSummary && article.aiSummary ? (
                <StreamingText text={article.aiSummary} speed={10} />
              ) : (
                article.description
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <span>{formatDate(article.publishedAt)}</span>
            <span className="text-gray-300">·</span>
            <span className={isBlog ? 'text-emerald-600' : 'text-lime-600'}>{sourceLabel}</span>
            <span className="text-gray-300">·</span>
            <Link
              to={`/article/${article.articleId}`}
              className="hover:text-black"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              Details
            </Link>
            <span className="text-gray-300">·</span>
            <a
              href={
                article.url.startsWith('http')
                  ? article.url
                  : `https://aws.amazon.com${article.url}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              Read ↗
            </a>
            <span className="text-gray-300">·</span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!user) {
                  alert('Please sign in to comment');
                  return;
                }
                setShowCommentBox(!showCommentBox);
              }}
              className="hover:text-black"
            >
              Comment
            </a>
          </div>

          {showCommentBox && (
            <form
              onSubmit={handleComment}
              className="mt-4 mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white mb-2"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="text-xs px-2 py-0.5 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer rounded"
                >
                  {submitting ? 'Posting...' : 'Post'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCommentBox(false);
                    setCommentText('');
                  }}
                  className="text-xs px-2 py-1 text-gray-600 hover:text-black cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* {article.hashtags && article.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {article.hashtags.map((hashtag) => (
                <a
                  key={hashtag}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onHashtagClick?.(hashtag);
                  }}
                  className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 hover:bg-orange-100"
                >
                  #{hashtag}
                </a>
              ))}
            </div>
          )} */}

      {localComments.length > 0 && (
        <div className="ml-[9px] pl-5 border-l-1 text-violet-600 mt-2 space-y-1">
          {localComments.map((comment) => (
            <div key={comment.commentId} className="text-sm text-gray-600 group hover:bg-gray-50">
              <span className="font-medium text-gray-900">{comment.displayName}:</span>{' '}
              {onHashtagClick ? (
                <HashtagText text={comment.content} onHashtagClick={onHashtagClick} />
              ) : (
                comment.content
              )}
              {comment.isOwn && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteComment(comment.commentId);
                  }}
                  className="ml-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Delete comment"
                >
                  ×
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
