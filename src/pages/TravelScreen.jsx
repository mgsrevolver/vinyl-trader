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
  getBoroughStores,
  getPlayerActions,
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
  const [neighborhoodStores, setNeighborhoodStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playerActions, setPlayerActions] = useState({ used: 0, available: 4 });

  // NYC borough coordinates based on the screenshot
  const boroughCoordinates = {
    downtown: { x: 20, y: 62 },
    uptown: { x: 65, y: 25 },
    brooklyn: { x: 56, y: 85 },
    queens: { x: 78, y: 43 },
    bronx: { x: 85, y: 15 },
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

  useEffect(() => {
    // Only fetch stores when a neighborhood is selected
    const fetchStoresForNeighborhood = async () => {
      if (!selectedNeighborhood) {
        setNeighborhoodStores([]);
        return;
      }

      try {
        // Special case for Uptown - use the correct ID
        if (selectedNeighborhood.name === 'Uptown') {
          // Use the known correct ID for Uptown
          const uptownId = '5886f15f-e81d-4d83-8705-100a58adada1';

          console.log('Using hardcoded Uptown ID:', uptownId);
          console.log('Selected neighborhood ID was:', selectedNeighborhood.id);

          // Get stores for the known Uptown ID
          const stores = await getBoroughStores(uptownId);
          console.log(`Found ${stores.length} stores for Uptown`);

          setNeighborhoodStores(stores || []);
        } else {
          // Normal behavior for other neighborhoods
          const stores = await getBoroughStores(selectedNeighborhood.id);
          console.log(
            'Stores found for borough:',
            stores.length,
            'borough id:',
            selectedNeighborhood.id
          );

          setNeighborhoodStores(stores || []);
        }
      } catch (err) {
        console.error('Error fetching stores for neighborhood:', err);
        toast.error('Failed to load stores');
      }
    };

    fetchStoresForNeighborhood();
  }, [selectedNeighborhood]);

  useEffect(() => {
    const fetchPlayerActions = async () => {
      if (!player?.id || !currentGame?.id) return;

      try {
        const actionsData = await getPlayerActions(
          player.id,
          currentGame.id,
          currentGame.current_hour
        );

        setPlayerActions({
          used: actionsData.actions_used || 0,
          available: actionsData.actions_available || 4,
        });
      } catch (err) {
        console.error('Error fetching player actions:', err);
      }
    };

    fetchPlayerActions();
  }, [player?.id, currentGame?.id, currentGame?.current_hour]);

  const handleSelectNeighborhood = (neighborhood) => {
    // Don't select current location
    if (neighborhood.id === player.current_borough_id) {
      toast.error("You're already in this neighborhood!");
      return;
    }

    // Add logging to see which ID is being selected
    console.log('Selected neighborhood:', neighborhood.name, neighborhood.id);

    // Check if this is Uptown and log both Uptown IDs
    if (neighborhood.name === 'Uptown') {
      console.log(
        'Uptown IDs in database:',
        '5886f15f-e81d-4d83-8705-100a58adada1',
        '27ea6aa4-e00d-43e1-93fd-78dccf329b98'
      );
      console.log(
        'Stores linked to which Uptown ID?',
        'Check your store records'
      );
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

    try {
      // Set UI to loading state
      setIsLoading(true);

      console.log('Starting travel to:', selectedNeighborhood.name);

      // Call travel function with selected neighborhood and transport
      const result = await travelToNeighborhood(
        selectedNeighborhood.id,
        selectedTransport.id
      );

      // Show special message for hours advancing
      if (result && result.hourAdvanced) {
        toast.success(
          `Advanced to next hour - ${result.newHour} hours remaining`
        );
      }

      // Always wait a bit for backend operations to complete
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Navigate back to game with refresh flag regardless of result
      // This ensures the UI updates with current data from the database
      navigate(`/game/${gameId}`, {
        state: {
          refresh: true,
          fromTravel: true,
          destinationName: selectedNeighborhood.name,
        },
        replace: true, // Replace history to prevent back-button issues
      });
    } catch (err) {
      console.error('Travel error:', err);

      // Still navigate back to game
      navigate(`/game/${gameId}`, {
        state: { refresh: true },
        replace: true,
      });
    } finally {
      setIsLoading(false);
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

  // Format time to 12-hour format
  const formatTime = (hour) => {
    if (hour === null || hour === undefined) return 'N/A';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  };

  // Check if player has enough actions
  const hasEnoughActions = playerActions.available - playerActions.used > 0;

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
              style={{ maxHeight: '80vh', overflow: 'auto' }}
            >
              <div className="drawer-handle"></div>

              <div
                className="drawer-header"
                style={{ marginBottom: '4px', paddingBottom: '4px' }}
              >
                <h2 className="text-xl font-bold">
                  Travel to {selectedNeighborhood.name}
                </h2>
                <button
                  className="close-button bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md"
                  onClick={handleCloseDrawer}
                >
                  <FaTimes />
                </button>
              </div>

              {/* Stores in this neighborhood - Super compact single line format */}
              {neighborhoodStores.length > 0 && (
                <div className="mb-1 px-2">
                  {neighborhoodStores.map((store) => (
                    <div key={store.id} className="text-xs text-center">
                      {store.name} • {store.specialty_genre || 'Various'} •{' '}
                      {formatTime(store.open_hour)}-
                      {formatTime(store.close_hour)}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs mb-1 text-center">
                How do you want to get there?
              </p>

              {/* Make transport grid more compact but not overly cramped */}
              <div
                className="transport-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  padding: '0 10px',
                  maxHeight: '180px', // Slightly taller to allow more breathing room
                }}
              >
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
                      style={{
                        padding: '8px', // More padding
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px', // Slightly more gap between rows
                      }}
                    >
                      {/* Row 1: Icon and Name */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          marginBottom: '2px',
                        }}
                      >
                        <span>{transport.icon}</span>
                        <span style={{ fontSize: '16px' }}>
                          {transport.name}
                        </span>
                      </div>

                      {/* Row 2: Cost */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                        }}
                      >
                        <FaCoins style={{ marginRight: '4px' }} />
                        <span>{formatMoney(cost)}</span>
                      </div>

                      {/* Row 3: Time */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                        }}
                      >
                        <FaClock style={{ marginRight: '4px' }} />
                        <span>{time} hours</span>
                      </div>

                      {/* Row 4: Capacity */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                        }}
                      >
                        <FaWarehouse style={{ marginRight: '4px' }} />
                        <span>
                          Cap: {transport.capacity_modifier > 0 ? '+' : ''}
                          {transport.capacity_modifier}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Travel button with reasonable padding */}
              <div style={{ padding: '12px 10px 6px 10px' }}>
                {!hasEnoughActions && (
                  <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-2 mb-2 text-sm">
                    <p>
                      <strong>No actions left for this hour!</strong> Traveling
                      will advance to the next hour.
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleTravel}
                  disabled={loading || !selectedTransport}
                  size="md" // Back to medium size
                  fullWidth
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <FaSpinner className="animate-spin mr-2" />
                      Traveling...
                    </span>
                  ) : hasEnoughActions ? (
                    'Travel Now'
                  ) : (
                    'Advance Hour & Travel'
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
