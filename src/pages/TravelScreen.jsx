// src/pages/TravelScreen.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaMapPin,
  FaSpinner,
  FaTimes,
  FaWalking,
  FaBicycle,
  FaSubway,
  FaTaxi,
  FaDollarSign,
  FaClock,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';
import Button from '../components/ui/Button';

// You'll need to add an NYC map image to your public/assets folder
// This image should be a simplified map of NYC showing the boroughs

const TravelScreen = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { currentGame, player, loading, travelToNeighborhood } = useGame();
  const drawerRef = useRef(null);

  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [startY, setStartY] = useState(0);

  // NYC borough coordinates based on the screenshot
  const boroughCoordinates = {
    manhattan: { x: 42, y: 55 },
    brooklyn: { x: 52, y: 75 },
    queens: { x: 65, y: 55 },
    bronx: { x: 45, y: 40 },
    staten_island: { x: 25, y: 85 },
  };

  // Fixed transportation options in the correct order
  const transportOptions = [
    {
      id: 'walking',
      name: 'Walking',
      base_cost: 0.0,
      speed_factor: 1,
      icon: <FaWalking />,
    },
    {
      id: 'bike',
      name: 'Bike',
      base_cost: 0.0,
      speed_factor: 1.5,
      icon: <FaBicycle />,
    },
    {
      id: 'subway',
      name: 'Subway',
      base_cost: 1.0,
      speed_factor: 2,
      icon: <FaSubway />,
    },
    {
      id: 'taxi',
      name: 'Taxi',
      base_cost: 10.0,
      speed_factor: 3,
      icon: <FaTaxi />,
    },
  ];

  useEffect(() => {
    const loadTravelData = async () => {
      try {
        setDataLoading(true);

        // Load neighborhoods
        const { data: neighborhoodData, error: neighborhoodError } =
          await supabase.from('boroughs').select('*');

        if (neighborhoodError) throw neighborhoodError;

        // Add coordinates from our mapping
        const neighborhoodsWithCoords = neighborhoodData.map((hood) => {
          // Using a simplified mapping for demo purposes
          const boroughKey = hood.name.toLowerCase().replace(/\s+/g, '_');
          const coords = boroughCoordinates[boroughKey] || { x: 50, y: 50 };

          return {
            ...hood,
            x_coordinate: coords.x,
            y_coordinate: coords.y,
          };
        });

        setNeighborhoods(neighborhoodsWithCoords || []);

        // Pre-select walking by default
        setSelectedTransport(transportOptions[0]);
      } catch (err) {
        console.error('Error loading travel data:', err);
        toast.error('Failed to load travel data');
      } finally {
        setDataLoading(false);
      }
    };

    loadTravelData();
  }, []);

  const handleSelectNeighborhood = (neighborhood) => {
    // Don't select current location
    if (neighborhood.id === player.current_borough_id) {
      toast.error("You're already in this neighborhood!");
      return;
    }

    setSelectedNeighborhood(neighborhood);
  };

  const handleCloseDrawer = () => {
    setSelectedNeighborhood(null);
  };

  const handleTravel = async () => {
    if (!selectedNeighborhood || !selectedTransport) {
      toast.error('Please select a destination and transport method');
      return;
    }

    // For demo purposes, we're just using the transport ID as a parameter
    // In a real app, you'd use the actual transport ID from the database
    const { success, error } = await travelToNeighborhood(
      selectedNeighborhood.id,
      selectedTransport.id
    );

    if (success) {
      toast.success(`Traveled to ${selectedNeighborhood.name}`);
      navigate(`/game/${gameId}`);
    } else {
      toast.error(`Travel failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const formatMoney = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Handle drawer swipe down
  const handleTouchStart = (e) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    // If swiping down
    if (diff > 50) {
      handleCloseDrawer();
    }
  };

  // Get the current neighborhood object
  const currentNeighborhood = neighborhoods.find(
    (n) => n.id === player?.current_borough_id
  );

  if (dataLoading || !player) {
    return (
      <div className="nyc-map-bg flex items-center justify-center">
        <div className="text-center bg-white bg-opacity-80 p-6 rounded-lg">
          <FaSpinner className="animate-spin text-4xl mx-auto text-blue-600 mb-3" />
          <p className="text-blue-900 font-semibold">
            Loading travel options...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="nyc-map-bg"
      onClick={selectedNeighborhood ? handleCloseDrawer : undefined}
    >
      <div className="map-overlay"></div>

      <div className="travel-container">
        {/* Back Button */}
        <button
          className="back-button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/game/${gameId}`);
          }}
        >
          <FaArrowLeft />
        </button>

        {/* Location Markers - Simplified Design */}
        {neighborhoods.map((neighborhood) => (
          <div
            key={neighborhood.id}
            className={`location-marker ${
              neighborhood.id === player.current_borough_id
                ? 'current'
                : selectedNeighborhood?.id === neighborhood.id
                ? 'selected'
                : ''
            }`}
            style={{
              left: `${neighborhood.x_coordinate}%`,
              top: `${neighborhood.y_coordinate}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectNeighborhood(neighborhood);
            }}
          >
            <FaMapPin size={24} />
            <div className="location-label">
              {neighborhood.name}
              {neighborhood.id === player.current_borough_id && ' (You)'}
            </div>
          </div>
        ))}

        {/* Transport Options Panel */}
        {selectedNeighborhood && (
          <div
            className="travel-drawer-backdrop"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="travel-drawer"
              ref={drawerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
            >
              <div className="drawer-handle"></div>

              <div className="drawer-header">
                <h2 className="text-xl font-bold">
                  Travel to {selectedNeighborhood.name}
                </h2>
                <button className="close-button" onClick={handleCloseDrawer}>
                  <FaTimes />
                </button>
              </div>

              <p className="text-sm mb-2 px-4">
                Choose your transportation method:
              </p>

              <div className="transport-grid">
                {transportOptions.map((transport) => (
                  <div
                    key={transport.id}
                    onClick={() => setSelectedTransport(transport)}
                    className={`transport-option ${
                      selectedTransport?.id === transport.id ? 'selected' : ''
                    }`}
                  >
                    <div className="transport-icon">{transport.icon}</div>
                    <div className="transport-name">{transport.name}</div>
                    <div className="transport-price">
                      <FaDollarSign className="text-gray-500" size={10} />
                      <span>{formatMoney(transport.base_cost)}</span>
                    </div>
                    <div className="transport-time">
                      <FaClock className="text-gray-500" size={10} />
                      <span>{transport.speed_factor} hours</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4 pt-2">
                <Button
                  onClick={handleTravel}
                  disabled={loading || !selectedTransport}
                  className="w-full py-3"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <FaSpinner className="animate-spin mr-2" />
                      Traveling...
                    </span>
                  ) : (
                    'Travel Now'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TravelScreen;
