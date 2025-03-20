// src/pages/TravelScreen.jsx
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
  FaBolt,
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

// NYC borough coordinates (this can be static)
const boroughCoordinates = {
  downtown: { x: 20, y: 62 },
  uptown: { x: 65, y: 25 },
  brooklyn: { x: 56, y: 85 },
  queens: { x: 78, y: 43 },
  bronx: { x: 85, y: 15 },
  staten_island: { x: 1, y: 1 },
};

// Memo-ized components for better performance
const LocationMarker = memo(
  ({ neighborhood, isCurrentLocation, isSelected, onSelect }) => (
    <div
      className={`location-marker ${
        isCurrentLocation ? 'current' : isSelected ? 'selected' : ''
      }`}
      style={{
        left: `${neighborhood.x_coordinate}%`,
        top: `${neighborhood.y_coordinate}%`,
      }}
      onClick={onSelect}
    >
      <FaMapPin size={24} />
      <div className="location-label">
        {neighborhood.name}
        {isCurrentLocation && ' (You)'}
      </div>
    </div>
  )
);

const TransportOption = memo(
  ({ transport, isSelected, onSelect, travelDetails }) => (
    <div
      onClick={onSelect}
      className={`transport-option ${isSelected ? 'selected' : ''}`}
      style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
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
        <span style={{ fontSize: '16px' }}>{transport.name}</span>
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
        <span>${Math.round(parseFloat(travelDetails.cost))}</span>
      </div>

      {/* Row 3: Actions - Replace clock with lightning bolt */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
        }}
      >
        <FaBolt style={{ marginRight: '4px' }} />
        <span>{travelDetails.time} actions</span>
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
  )
);

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

  // Memoized data fetching
  useEffect(() => {
    let isMounted = true;

    const loadTravelData = async () => {
      try {
        setDataLoading(true);

        // Load neighborhoods
        const { data: neighborhoodData, error: neighborhoodError } =
          await supabase.from('boroughs').select('*');

        if (neighborhoodError) throw neighborhoodError;

        // Process neighborhoods
        if (isMounted) {
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
        }

        // Run transportations and distances in parallel
        const [transportMethods, distanceResults] = await Promise.all([
          // Transportation methods
          supabase
            .from('transportation_methods')
            .select('*')
            .order('speed_factor', { ascending: true }),
          // Borough distances
          supabase.from('borough_distances').select('*'),
        ]);

        // Process transportation methods
        if (isMounted && transportMethods.data) {
          // Ensure we have unique transport methods (no duplicates)
          // Group by transport type
          const transportTypes = {};
          transportMethods.data.forEach((method) => {
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
          const limitedTransports = transportWithIcons.slice(0, 4);
          setTransportOptions(limitedTransports);

          // Pre-select walking by default (or first available transport)
          if (limitedTransports.length > 0) {
            setSelectedTransport(limitedTransports[0]);
          }
        }

        // Set borough distances
        if (isMounted && distanceResults.data) {
          setBoroughDistances(distanceResults.data);
        }
      } catch (err) {
        console.error('Error loading travel data:', err);
        if (isMounted) toast.error('Failed to load travel data');
      } finally {
        if (isMounted) setDataLoading(false);
      }
    };

    loadTravelData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Memoize the store data fetching and only trigger when neighborhood is selected
  useEffect(() => {
    // Clear stores when no neighborhood selected
    if (!selectedNeighborhood) {
      setNeighborhoodStores([]);
      return;
    }

    let isMounted = true;

    // Fetch stores for the selected neighborhood
    const fetchStores = async () => {
      try {
        // Optimized query - only get what we need
        const { data: stores, error } = await supabase
          .from('stores')
          .select('id, name, specialty_genre, open_hour, close_hour')
          .eq('borough_id', selectedNeighborhood.id);

        if (error) throw error;
        if (isMounted) setNeighborhoodStores(stores || []);
      } catch (err) {
        console.error(
          `Error fetching stores for ${selectedNeighborhood.name}:`,
          err
        );
        if (isMounted) setNeighborhoodStores([]);
      }
    };

    fetchStores();

    return () => {
      isMounted = false;
    };
  }, [selectedNeighborhood?.id]);

  // Memoize the expensive neighborhood selection handler
  const handleSelectNeighborhood = useCallback(
    (neighborhood, e) => {
      e.stopPropagation();
      // Don't select current location
      if (neighborhood.id === player?.current_borough_id) {
        toast.error("You're already here!");
        return;
      }
      setSelectedNeighborhood(neighborhood);
    },
    [player?.current_borough_id]
  );

  // Event handlers with useCallback for better performance
  const handleCloseDrawer = useCallback(() => {
    setSelectedNeighborhood(null);
  }, []);

  const handleTravel = useCallback(async () => {
    if (!selectedNeighborhood || !selectedTransport) {
      toast.error('Select destination and transport');
      return;
    }

    try {
      setIsLoading(true);
      await travelToNeighborhood(selectedNeighborhood.id, selectedTransport.id);

      // Navigate back with minimal data
      navigate(`/game/${gameId}`, {
        state: { refresh: true },
        replace: true,
      });
    } catch (err) {
      console.error('Travel error:', err);
      navigate(`/game/${gameId}`, {
        state: { refresh: true },
        replace: true,
      });
    }
  }, [
    selectedNeighborhood,
    selectedTransport,
    travelToNeighborhood,
    navigate,
    gameId,
  ]);

  // Memoize the touch handlers
  const handleTouchStart = useCallback((e) => {
    setStartY(e.touches[0].clientY);
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      // If swiping down with significant movement
      if (diff > 50) {
        handleCloseDrawer();
      }
    },
    [startY, handleCloseDrawer]
  );

  // Format time efficiently
  const formatTime = useCallback((hour) => {
    if (hour === null || hour === undefined) return 'N/A';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  }, []);

  // Current neighborhood - memoized
  const currentNeighborhood = useMemo(
    () => neighborhoods.find((n) => n.id === player?.current_borough_id),
    [neighborhoods, player?.current_borough_id]
  );

  // Memoize expensive travel details calculation
  const getTravelDetails = useCallback(
    (fromBoroughId, toBoroughId, transportId) => {
      // Default values in case data isn't loaded
      if (!boroughDistances.length || !transportOptions.length) {
        return { time: 1, cost: 0 };
      }

      // Find the distance record between the boroughs
      const distanceRecord = boroughDistances.find(
        (d) =>
          (d.from_borough_id === fromBoroughId &&
            d.to_borough_id === toBoroughId) ||
          (d.from_borough_id === toBoroughId &&
            d.to_borough_id === fromBoroughId)
      );

      // Find the selected transport method
      const transport = transportOptions.find((t) => t.id === transportId);

      if (!distanceRecord || !transport) return { time: 1, cost: 0 };

      // Get time and cost based on transport type
      let time = 1;
      let cost = transport.base_cost || 0;

      const transportType = transport.name.toLowerCase();
      if (transportType.includes('walk')) {
        time = distanceRecord.walking_time || 3;
      } else if (transportType.includes('bike')) {
        time = distanceRecord.bike_time || 2;
      } else if (transportType.includes('subway')) {
        time = distanceRecord.subway_time || 2;
      } else if (transportType.includes('taxi')) {
        time = distanceRecord.taxi_time || 1;
        if (distanceRecord.taxi_cost) {
          cost = distanceRecord.taxi_cost;
        }
      }

      return { time, cost };
    },
    [boroughDistances, transportOptions]
  );

  // Show loading state if necessary data isn't ready
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
            top: '56px',
            left: '16px',
            zIndex: 50,
          }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/game/${gameId}`);
          }}
        >
          <FaArrowLeft />
        </button>

        {/* Location Markers - Using memoized component */}
        {neighborhoods.map((neighborhood) => (
          <LocationMarker
            key={neighborhood.id}
            neighborhood={neighborhood}
            isCurrentLocation={neighborhood.id === player.current_borough_id}
            isSelected={selectedNeighborhood?.id === neighborhood.id}
            onSelect={(e) => handleSelectNeighborhood(neighborhood, e)}
          />
        ))}

        {/* Transport Options Panel */}
        {selectedNeighborhood && (
          <div
            className="travel-drawer-backdrop"
            onClick={(e) => {
              e.stopPropagation();
              handleCloseDrawer();
            }}
          >
            <div
              className="travel-drawer"
              ref={drawerRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onClick={(e) => e.stopPropagation()}
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
                    <div
                      key={store.id}
                      className="text-xs text-center font-sans"
                    >
                      {store.name} • {store.specialty_genre || 'Various'} •{' '}
                      {formatTime(store.open_hour)}-
                      {formatTime(store.close_hour)}
                    </div>
                  ))}
                </div>
              )}

              {/* Transport grid with memoized components */}
              <div
                className="transport-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '10px',
                  padding: '0 10px',
                  maxHeight: '180px',
                }}
              >
                {transportOptions.map((transport) => {
                  // Get travel details for this transport option
                  const travelDetails = getTravelDetails(
                    player.current_borough_id,
                    selectedNeighborhood?.id,
                    transport.id
                  );

                  return (
                    <TransportOption
                      key={transport.id}
                      transport={transport}
                      isSelected={selectedTransport?.id === transport.id}
                      onSelect={() => setSelectedTransport(transport)}
                      travelDetails={travelDetails}
                    />
                  );
                })}
              </div>

              {/* Travel button with reasonable padding */}
              <div style={{ padding: '12px 10px 6px 10px' }}>
                <Button
                  onClick={handleTravel}
                  disabled={loading || !selectedTransport}
                  size="md"
                  fullWidth
                >
                  {isLoading ? (
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
