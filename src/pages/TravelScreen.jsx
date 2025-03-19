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
  FaCoins,
  FaWarehouse,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';
import Button from '../components/ui/Button';
import {
  getTransportationMethods,
  getBoroughDistances,
} from '../lib/gameActions';

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
  const [transportOptions, setTransportOptions] = useState([]);
  const [boroughDistances, setBoroughDistances] = useState([]);

  // NYC borough coordinates based on the screenshot
  const boroughCoordinates = {
    downtown: { x: 42, y: 60 },
    uptown: { x: 42, y: 45 },
    brooklyn: { x: 52, y: 75 },
    queens: { x: 65, y: 55 },
    bronx: { x: 45, y: 40 },
    staten_island: { x: 25, y: 85 },
  };

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
          // Convert borough name to lowercase for matching with our coordinates
          const boroughKey = hood.name.toLowerCase();
          const coords = boroughCoordinates[boroughKey] || { x: 50, y: 50 };

          return {
            ...hood,
            x_coordinate: coords.x,
            y_coordinate: coords.y,
          };
        });

        setNeighborhoods(neighborhoodsWithCoords || []);

        // Fetch transportation methods from database
        const transportationMethods = await getTransportationMethods();

        // Ensure we have unique transport methods (no duplicates)
        // Group by transport type and take the first of each type
        const transportTypes = {};
        transportationMethods.forEach((method) => {
          const type = method.name.toLowerCase();
          if (!transportTypes[type]) {
            transportTypes[type] = method;
          }
        });

        // Map transportation methods to include icons
        const transportWithIcons = Object.values(transportTypes).map(
          (method) => {
            // Add icons based on name/type
            let icon = <FaWalking />;
            const type = method.name.toLowerCase();

            if (type.includes('bike')) icon = <FaBicycle />;
            else if (type.includes('subway')) icon = <FaSubway />;
            else if (type.includes('taxi')) icon = <FaTaxi />;

            return {
              ...method,
              icon,
            };
          }
        );

        // Limit to 4 transport methods for 2x2 grid
        setTransportOptions(transportWithIcons.slice(0, 4));

        // Fetch borough distances
        const distances = await getBoroughDistances();
        setBoroughDistances(distances);

        // Pre-select walking by default (or first available transport)
        if (transportWithIcons.length > 0) {
          setSelectedTransport(transportWithIcons[0]);
        }
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

  // Function to get travel time and cost for selected destination
  const getTravelDetails = (fromBoroughId, toBoroughId, transportId) => {
    // Find the distance record between the boroughs
    const distanceRecord = boroughDistances.find(
      (d) =>
        (d.from_borough_id === fromBoroughId &&
          d.to_borough_id === toBoroughId) ||
        (d.from_borough_id === toBoroughId && d.to_borough_id === fromBoroughId)
    );

    // Find the selected transport method
    const transport = transportOptions.find((t) => t.id === transportId);

    if (!distanceRecord || !transport) return { time: 1, cost: 0 };

    // Get time and cost based on transport type
    let time = 1;
    let cost = transport.base_cost || 0; // Default to the base_cost from the transportation method

    const transportType = transport.name.toLowerCase();
    if (transportType.includes('walk')) {
      time = distanceRecord.walking_time || 3;
      // Walking usually has no cost, but we'll use base_cost if it exists
    } else if (transportType.includes('bike')) {
      time = distanceRecord.bike_time || 2;
      // Biking usually has no cost, but we'll use base_cost if it exists
    } else if (transportType.includes('subway')) {
      time = distanceRecord.subway_time || 2;
      // Subway uses base_cost, which we've already set
    } else if (transportType.includes('taxi')) {
      time = distanceRecord.taxi_time || 1;
      // For taxi, we'll use the taxi_cost from the distance record if available
      if (distanceRecord.taxi_cost) {
        cost = distanceRecord.taxi_cost;
      }
    }

    return { time, cost };
  };

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
        {/* Back Button - Using inline styles for more precise positioning */}
        <button
          className="back-button bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-md"
          style={{
            position: 'absolute',
            top: '56px', // Use explicit pixels instead of Tailwind classes
            left: '16px',
            zIndex: 50, // Higher z-index to ensure it's above other elements
          }}
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

                {/* Close Button - Keeping the original class but adding the white circular style */}
                <button
                  className="close-button bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-md"
                  onClick={handleCloseDrawer}
                >
                  <FaTimes />
                </button>
              </div>

              <p className="text-sm mb-2 px-4">How do you want to get there?</p>

              <div className="transport-grid">
                {transportOptions.map((transport) => {
                  // Get travel details for this transport option
                  const { time, cost } = getTravelDetails(
                    player.current_borough_id,
                    selectedNeighborhood?.id,
                    transport.id
                  );

                  return (
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
                        <FaCoins className="text-gray-500" size={10} />
                        <span>{formatMoney(cost)}</span>
                      </div>
                      <div className="transport-time">
                        <FaClock className="text-gray-500" size={10} />
                        <span>{time} hours</span>
                      </div>
                      <div className="transport-price">
                        <FaWarehouse className="text-gray-500" size={10} />
                        <span>
                          Capacity: {transport.capacity_modifier > 0 ? '+' : ''}
                          {transport.capacity_modifier}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 pb-4 pt-2">
                <Button
                  onClick={handleTravel}
                  disabled={loading || !selectedTransport}
                  size="lg"
                  fullWidth
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
