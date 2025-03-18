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

// Pages
import Home from './pages/Home';
import Game from './pages/Game';
import Lobby from './pages/Lobby';
import JoinGame from './pages/JoinGame';
import Store from './pages/Store';
import TravelScreen from './pages/TravelScreen';
import NotFound from './pages/NotFound';

// Import the CSS file to ensure styles are applied
import './App.css';

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
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </GameProvider>
    </Router>
  );
};

export default App;
