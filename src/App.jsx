// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GameProvider } from './contexts/GameContext';
import GameHeader from './components/ui/GameHeader';
import { useEffect } from 'react';

// Pages
import Home from './pages/Home';
import Game from './pages/Game';
import Lobby from './pages/Lobby';
import JoinGame from './pages/JoinGame';
import Store from './pages/Store';
import TravelScreen from './pages/TravelScreen';
import NotFound from './pages/NotFound';
import Inventory from './pages/Inventory';

// Import the CSS file to ensure styles are applied
import './index.css';
import './App.css';

const App = () => {
  useEffect(() => {
    console.log('App component mounted');
    return () => console.log('App component unmounted');
  }, []);

  console.log('App rendering');

  return (
    <Router basename={import.meta.env.BASE_URL || '/'}>
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
          <Route
            path="/game/:gameId"
            element={
              <>
                <Game />
                <GameHeader />
              </>
            }
          />
          <Route
            path="/lobby/:gameId"
            element={
              <>
                <Lobby />
                <GameHeader />
              </>
            }
          />
          <Route path="/join/:gameId" element={<JoinGame />} />
          <Route
            path="/store/:gameId/:boroughId/:storeId"
            element={
              <>
                <Store />
                <GameHeader />
              </>
            }
          />
          <Route
            path="/travel/:gameId"
            element={
              <>
                <TravelScreen />
                <GameHeader />
              </>
            }
          />
          <Route path="/404" element={<NotFound />} />
          <Route path="/game/:gameId/inventory" element={<Inventory />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </GameProvider>
    </Router>
  );
};

export default App;
