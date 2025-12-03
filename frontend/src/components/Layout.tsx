import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import CustomAuthenticator from './CustomAuthenticator';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const navigate = useNavigate();
  const location = useLocation();

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
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-baseline gap-3 sm:gap-6">
              <a
                href="/"
                onClick={handleHomeClick}
                className="font-bold text-base tracking-tight bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent hover:brightness-125 transition-all"
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
                  className="text-sm text-gray-600 hover:text-black hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                >
                  Starred
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-sm">
              {user ? (
                <>
                  <span className="hidden sm:inline text-gray-600 truncate max-w-[200px]">
                    {displayName}
                  </span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      signOut();
                    }}
                    className="text-gray-600 hover:text-black hover:bg-gray-100 px-2 py-1 rounded transition-colors"
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
                  className="text-gray-600 hover:text-black hover:bg-gray-100 px-2 py-1 rounded transition-colors"
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
          <div className="bg-white border border-gray-200 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Sign In</h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-gray-500 hover:text-black text-xl"
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
