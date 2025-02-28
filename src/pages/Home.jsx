import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="py-6 flex items-center justify-between">
          <div className="flex-1 flex">
            <h1 className="font-display text-2xl font-bold text-primary-700">
              Deli Wars
            </h1>
          </div>
          <nav className="flex items-center space-x-4">
            {user ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/auth"
                className="px-4 py-2 rounded bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                Login / Register
              </Link>
            )}
          </nav>
        </header>

        <main className="mt-8 sm:mt-16">
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl font-display font-bold text-gray-900">
              Buy Low, Sell High, Dominate The Market
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Deli Wars is a turn-based trading game where you become a deli
              proprietor buying and selling artisanal food products across
              neighborhoods.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="px-8 py-3 rounded-md bg-primary-600 text-white font-medium text-lg hover:bg-primary-700 transition-colors w-full sm:w-auto"
                  >
                    Go to Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/auth?mode=register"
                    className="px-8 py-3 rounded-md bg-primary-600 text-white font-medium text-lg hover:bg-primary-700 transition-colors w-full sm:w-auto"
                  >
                    Get Started
                  </Link>
                  <Link
                    to="/auth?mode=login"
                    className="px-8 py-3 rounded-md bg-white text-primary-700 font-medium text-lg border border-primary-200 hover:bg-gray-50 transition-colors w-full sm:w-auto"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-display text-xl font-semibold text-gray-900">
                Trade Products
              </h3>
              <p className="mt-2 text-gray-600">
                Buy low and sell high across different neighborhoods. Each
                location has its own market dynamics.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-display text-xl font-semibold text-gray-900">
                Manage Resources
              </h3>
              <p className="mt-2 text-gray-600">
                Balance your inventory space, cash flow, and loans to maximize
                profits within the 30-day game period.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-display text-xl font-semibold text-gray-900">
                Compete With Friends
              </h3>
              <p className="mt-2 text-gray-600">
                Play with up to 4 players, trade directly with other players,
                and see who can build the most profitable deli empire.
              </p>
            </div>
          </div>

          <div className="mt-16 bg-white p-8 rounded-lg shadow-md">
            <h2 className="font-display text-2xl font-bold text-gray-900">
              How to Play
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-display text-lg font-semibold text-gray-900">
                  1. Create or Join a Game
                </h3>
                <p className="mt-1 text-gray-600">
                  Start a new game or join an existing one with friends.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-gray-900">
                  2. Take Turns
                </h3>
                <p className="mt-1 text-gray-600">
                  Each turn represents one day. Buy, sell, travel, or trade with
                  other players.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-gray-900">
                  3. Navigate Markets
                </h3>
                <p className="mt-1 text-gray-600">
                  Visit different neighborhoods to find the best prices for your
                  goods.
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-gray-900">
                  4. Win the Game
                </h3>
                <p className="mt-1 text-gray-600">
                  Have the highest profit after 30 days to win, but be sure to
                  repay your loans!
                </p>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-16 py-8 border-t border-gray-200">
          <div className="text-center text-gray-500">
            <p>
              © {new Date().getFullYear()} Deli Wars - A turn-based trading game
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
