// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GameProvider } from './contexts/GameContext';

// Pages
import Home from './pages/Home';
import Game from './pages/Game';
import Lobby from './pages/Lobby';
import JoinGame from './pages/JoinGame';
import Market from './pages/Market';
import TravelScreen from './pages/TravelScreen';
import NotFound from './pages/NotFound';

const App = () => {
  return (
    <Router>
      <GameProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 2000,
              iconTheme: {
                primary: '#10B981',
                secondary: 'white',
              },
            },
            error: {
              duration: 3000,
              iconTheme: {
                primary: '#EF4444',
                secondary: 'white',
              },
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/lobby/:gameId" element={<Lobby />} />
          <Route path="/join/:gameId" element={<JoinGame />} />
          <Route
            path="/market/:gameId/:neighborhoodId/:storeName"
            element={<Market />}
          />
          <Route path="/travel/:gameId" element={<TravelScreen />} />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </GameProvider>
    </Router>
  );
};

export default App;
