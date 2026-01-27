import { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import CustomAuthenticator from '../components/CustomAuthenticator';
import { getStarredArticles, batchComments } from '../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import ArticleCard from '../components/ArticleCard';

interface StarredPageProps {
  useAiSummaries: boolean;
}

export default function StarredPage({ useAiSummaries }: StarredPageProps) {
  const { user } = useAuthenticator((context) => [context.user]);
  const navigate = useNavigate();
  const [savedArticles, setSavedArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSavedArticles();
    }
  }, [user]);

  const loadSavedArticles = async () => {
    try {
      setLoading(true);
      const data = await getStarredArticles();

      let articlesWithComments = data.starredArticles;

      // Fetch comments for articles that have them
      const articlesWithCommentCount = data.starredArticles.filter(
        (sa) => sa.article.commentCount > 0
      );
      if (articlesWithCommentCount.length > 0) {
        try {
          const commentsData = await batchComments(
            articlesWithCommentCount.map((sa) => sa.article.articleId)
          );
          articlesWithComments = data.starredArticles.map((sa) => ({
            ...sa,
            article: {
              ...sa.article,
              commentPreviews: commentsData.commentsByArticle[sa.article.articleId] || [],
            },
          }));
        } catch (err) {
          console.error('Failed to load comments:', err);
        }
      }

      setSavedArticles(articlesWithComments);
    } catch (err) {
      console.error('Failed to load starred articles:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <h1 className="text-lg font-semibold mb-4 text-center">Sign in to view starred articles</h1>
        <CustomAuthenticator />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-black"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h1 className="text-lg font-semibold">Starred Articles ({savedArticles.length})</h1>
      </div>

      {savedArticles.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">
          <p className="mb-2">You haven't starred any articles yet.</p>
          <Link to="/" className="hover:text-black hover:underline">
            Browse articles →
          </Link>
        </div>
      ) : (
        <div>
          {savedArticles.map((sa) => (
            <div key={sa.starId} className="relative">
              <ArticleCard
                article={sa.article}
                showPreview={expandedArticleId === sa.article.articleId}
                useAiSummary={useAiSummaries}
                onTogglePreview={() => {
                  setExpandedArticleId(
                    expandedArticleId === sa.article.articleId ? null : sa.article.articleId
                  );
                }}
                onStarred={() => {
                  // Remove from list when unstarred
                  setSavedArticles((prev) => prev.filter((item) => item.starId !== sa.starId));
                }}
                onCommented={() => {
                  // Update comment count
                  setSavedArticles((prev) =>
                    prev.map((item) =>
                      item.starId === sa.starId
                        ? {
                            ...item,
                            article: {
                              ...item.article,
                              commentCount: item.article.commentCount + 1,
                            },
                          }
                        : item
                    )
                  );
                }}
                onHashtagClick={(hashtag) => {
                  navigate(`/?hashtag=${hashtag}`);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
