import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import CustomAuthenticator from './CustomAuthenticator';

interface LayoutProps {
  children: React.ReactNode;
  useAiSummaries: boolean;
  setUseAiSummaries: (value: boolean) => void;
}

export default function Layout({ children, useAiSummaries, setUseAiSummaries }: LayoutProps) {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) return JSON.parse(stored);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Fetch username from Cognito attributes
  useEffect(() => {
    if (user) {
      fetchUserAttributes()
        .then((attributes) => {
          setDisplayName(attributes.name || 'User');
        })
        .catch((err) => {
          console.error('Failed to fetch user attributes:', err);
          setDisplayName('User');
        });
    }
  }, [user]);

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      // If already on homepage, reload the page
      window.location.reload();
    } else {
      // Otherwise navigate to home
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-stone-900 transition-colors duration-200">
      <nav className="border-b border-gray-200 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 z-40 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-baseline gap-3 sm:gap-6">
              <a
                href="/"
                onClick={handleHomeClick}
                className="font-bold text-base tracking-tight bg-linear-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent hover:brightness-125 transition-all"
                style={{
                  backgroundSize: '200% auto',
                  animation: 'gradient 3s ease infinite',
                }}
              >
                AWS Newsroom
              </a>
              {user && (
                <Link
                  to="/starred"
                  className="text-sm text-gray-600 dark:text-stone-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-stone-800 px-2 py-1 rounded transition-colors"
                >
                  Starred
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-sm">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="text-gray-500 dark:text-stone-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-stone-800 px-2 py-1 rounded transition-colors cursor-pointer"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={useAiSummaries}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setUseAiSummaries(newValue);
                    localStorage.setItem('useAiSummaries', JSON.stringify(newValue));
                  }}
                  className="w-3.5 h-3.5 cursor-pointer"
                />
                <span className="font-semibold bg-linear-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent uppercase tracking-wide">
                  AI
                </span>
              </label>
              {user ? (
                <>
                  <span className="hidden sm:inline text-gray-600 dark:text-stone-400 truncate max-w-[200px]">
                    {displayName}
                  </span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      signOut();
                    }}
                    className="text-gray-600 dark:text-stone-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-stone-800 px-2 py-1 rounded transition-colors"
                  >
                    Sign Out
                  </a>
                </>
              ) : (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowAuthModal(true);
                  }}
                  className="text-gray-600 dark:text-stone-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-stone-800 px-2 py-1 rounded transition-colors"
                >
                  Sign In
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6">{children}</main>

      {showAuthModal && !user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-stone-800 border border-gray-200 dark:border-stone-700 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-black dark:text-white">Sign In</h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-gray-500 dark:text-stone-400 hover:text-black dark:hover:text-white text-xl cursor-pointer"
              >
                ×
              </button>
            </div>
            <CustomAuthenticator />
          </div>
        </div>
      )}
    </div>
  );
}
