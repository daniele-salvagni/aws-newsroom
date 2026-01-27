import { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import CustomAuthenticator from '../components/CustomAuthenticator';
import { useSearchParams } from 'react-router-dom';
import {
  listArticles,
  batchComments,
  getPopularHashtags,
  getUpcomingEvent,
  Article,
} from '../lib/api';
import ArticleCard from '../components/ArticleCard';

// todo: refactor this thing

interface HomePageProps {
  useAiSummaries: boolean;
}

export default function HomePage({ useAiSummaries }: HomePageProps) {
  const { user } = useAuthenticator((context) => [context.user]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({
    hashtag: '',
  });
  const [lastReadTimestamp, setLastReadTimestamp] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [popularHashtags, setPopularHashtags] = useState<
    Array<{ hashtag: string; articleCount: number }>
  >([]);
  const [upcomingEvent, setUpcomingEvent] = useState<{
    title: string;
    url: string;
    category: string;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize and sync filters from URL params
  useEffect(() => {
    setFilters({
      hashtag: searchParams.get('hashtag') || '',
    });
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [searchParams]);

  useEffect(() => {
    // Load last "mark as read" timestamp from localStorage
    const stored = localStorage.getItem('lastReadTimestamp');
    setLastReadTimestamp(stored);

    // Load hashtags and events only when user is authenticated
    if (user) {
      loadPopularHashtags();
      loadUpcomingEvent();
    }
  }, [user]);

  useEffect(() => {
    // Load articles when page or filters change (but only after initialization and when authenticated)
    if (isInitialized && user) {
      loadArticles();
    }
  }, [page, filters, isInitialized, user]);

  // Sync URL params with filters (only when filters change from user action)
  useEffect(() => {
    if (!isInitialized) return; // Don't sync until initialized

    const currentHashtag = searchParams.get('hashtag') || '';

    // Only update URL if filters actually changed
    if (filters.hashtag !== currentHashtag) {
      const params = new URLSearchParams();
      if (filters.hashtag) params.set('hashtag', filters.hashtag);
      setSearchParams(params);
    }
  }, [filters, isInitialized]);

  useEffect(() => {
    // Infinite scroll: load more when near bottom
    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      if (loading || !hasMore) return;

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollPosition = window.innerHeight + window.scrollY;
        const bottomPosition = document.documentElement.scrollHeight - 500; // 500px before bottom

        if (scrollPosition >= bottomPosition) {
          setPage((p) => p + 1);
        }
      }, 300); // 300ms delay
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [loading, hasMore]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const data = await listArticles({
        page,
        limit: 100,
        hashtag: filters.hashtag || undefined,
      });

      let articlesWithComments = data.articles;

      // Fetch comments for articles that have them
      const articlesWithCommentCount = data.articles.filter((a) => a.commentCount > 0);
      if (articlesWithCommentCount.length > 0) {
        try {
          const commentsData = await batchComments(
            articlesWithCommentCount.map((a) => a.articleId)
          );
          articlesWithComments = data.articles.map((article) => ({
            ...article,
            commentPreviews: commentsData.commentsByArticle[article.articleId] || [],
          }));
        } catch (err) {
          console.error('Failed to load comments:', err);
          // Continue without comments if fetch fails
        }
      }

      if (page === 1) {
        setArticles(articlesWithComments);
      } else {
        setArticles((prev) => [...prev, ...articlesWithComments]);
      }

      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError('Failed to load articles. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPopularHashtags = async () => {
    try {
      const data = await getPopularHashtags(40);
      setPopularHashtags(data.hashtags);
    } catch (err) {
      console.error('Failed to load popular hashtags:', err);
    }
  };

  const loadUpcomingEvent = async () => {
    try {
      const data = await getUpcomingEvent();
      setUpcomingEvent(data.event);
    } catch (err) {
      console.error('Failed to load upcoming event:', err);
    }
  };

  const isNewArticle = (publishedAt: string) => {
    // On first visit (no timestamp), all articles are unread (show marker)
    if (!lastReadTimestamp) return true;
    return new Date(publishedAt) > new Date(lastReadTimestamp);
  };

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
    setArticles([]);
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <h1 className="text-lg font-semibold mb-4 text-center">Sign in to view AWS Newsroom</h1>
        <CustomAuthenticator />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold flex items-center gap-3">
            Latest AWS News
            {filters.hashtag && (
              <span className="text-sm font-normal text-violet-600">
                #{filters.hashtag}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleFilterChange({ hashtag: '' });
                  }}
                  className="ml-2 text-gray-400 hover:text-black"
                >
                  ×
                </a>
              </span>
            )}
          </h1>
          {import.meta.env.VITE_BRANDING_LOGO_URL && (
            <a 
              href={import.meta.env.VITE_BRANDING_LOGO_LINK || '#'} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:opacity-70 transition-opacity"
            >
              <img 
                src={import.meta.env.VITE_BRANDING_LOGO_URL} 
                alt="Branding" 
                className="h-5"
              />
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-gray-50 border border-gray-200 text-sm px-3 py-2 mb-6">{error}</div>
      )}

      {/* Up Next - show on unfiltered view or when filtering by source only */}
      {!filters.hashtag &&
        upcomingEvent &&
        (() => {
          const now = new Date();
          const eventDate = new Date(upcomingEvent.startTime);
          const diffMs = eventDate.getTime() - now.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          let timeRemaining = '';
          if (diffDays > 0) {
            timeRemaining = `in ${diffDays}d ${diffHours}h`;
          } else if (diffHours > 0) {
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            timeRemaining = `in ${diffHours}h ${diffMinutes}m`;
          } else {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            timeRemaining = diffMinutes > 0 ? `in ${diffMinutes}m` : 'starting now';
          }

          const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          const formattedTime = eventDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          });

          return (
            <div className="mb-4 bg-linear-to-r from-fuchsia-50 to-violet-50 px-3 py-2 rounded border-l-2 border-fuchsia-400">
              <div className="flex items-baseline gap-2 text-xs">
                <span className="text-fuchsia-600 font-medium">{upcomingEvent.category}</span>
                <span className="text-gray-400">·</span>
                <span
                  className="text-gray-700 font-medium"
                  title={`${formattedDate} ${formattedTime}`}
                >
                  {timeRemaining}
                </span>
                <span className="text-gray-400">·</span>
                <a
                  href={upcomingEvent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-700 hover:text-black hover:underline"
                >
                  {upcomingEvent.title}
                </a>
              </div>
            </div>
          );
        })()}

      {popularHashtags.length > 0 ? (
        <div className="mb-6 text-xs text-gray-500">
          <span className="mr-2">Popular:</span>
          {popularHashtags.map(({ hashtag, articleCount }, idx) => (
            <span key={hashtag}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleFilterChange({ hashtag });
                }}
                className={`transition-colors ${
                  filters.hashtag === hashtag
                    ? 'text-violet-600 font-medium'
                    : 'text-gray-600 hover:text-black hover:underline'
                }`}
              >
                #{hashtag} <span className="text-gray-400">({articleCount})</span>
              </a>
              {idx < popularHashtags.length - 1 && <span className="mx-1.5">·</span>}
            </span>
          ))}
        </div>
      ) : (
        <div className="mb-4 text-xs text-gray-500">
          <span className="mr-2">Popular:</span>
          <span className="italic">
            No tags yet. Add #hashtags in your comments to organize articles!
          </span>
        </div>
      )}

      <div>
        {articles.map((article, index) => {
          const articleDate = new Date(article.publishedAt);
          const reinventDate = new Date('2025-11-01T00:00:00Z');
          const prevArticleDate = index > 0 ? new Date(articles[index - 1].publishedAt) : null;

          // Show divider if this is the first article before Nov 1, 2025 (pre-re:Invent 2025)
          // todo: do the same for each year on 1st november? keep it simple client-side?
          const showReinventDivider =
            prevArticleDate && prevArticleDate >= reinventDate && articleDate < reinventDate;

          return (
            <div key={article.articleId}>
              {showReinventDivider && (
                <div className="py-2 text-xs text-fuchsia-600 text-center border-dashed border-t border-fuchsia-400">
                  ↑ pre-re:Invent 2025
                </div>
              )}
              <ArticleCard
                article={article}
                showPreview={expandedArticleId === article.articleId}
                useAiSummary={useAiSummaries}
                onTogglePreview={() => {
                  setExpandedArticleId(
                    expandedArticleId === article.articleId ? null : article.articleId
                  );
                }}
                onCommented={() => {
                  // Update comment count in local state
                  setArticles((prev) =>
                    prev.map((a) =>
                      a.articleId === article.articleId
                        ? { ...a, commentCount: a.commentCount + 1 }
                        : a
                    )
                  );
                }}
                onHashtagClick={(hashtag) => {
                  handleFilterChange({ hashtag });
                }}
                isUnread={isNewArticle(article.publishedAt) && !filters.hashtag}
                isFirstUnread={index === 0 && isNewArticle(article.publishedAt) && !filters.hashtag}
                onMarkAsRead={() => {
                  if (articles.length > 0) {
                    const mostRecentDate = articles[0].publishedAt;
                    localStorage.setItem('lastReadTimestamp', mostRecentDate);
                    setLastReadTimestamp(mostRecentDate);
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-black"></div>
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-500">
          No articles found. Try adjusting your filters.
        </div>
      )}

      {!loading && hasMore && (
        <div className="text-center mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-gray-600 hover:text-black underline"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
