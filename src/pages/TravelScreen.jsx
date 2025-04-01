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
  FaCoins,
  FaWarehouse,
  FaBolt,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';
import Button from '../components/ui/Button';

// NYC borough coordinates (static)
const boroughCoordinates = {
  downtown: { x: 20, y: 62 },
  uptown: { x: 65, y: 25 },
  brooklyn: { x: 56, y: 85 },
  queens: { x: 78, y: 43 },
  bronx: { x: 85, y: 15 },
  'staten island': { x: 5, y: 82 },
};

// Pre-define transport icons for better performance
const TRANSPORT_ICONS = {
  walk: <FaWalking />,
  bike: <FaBicycle />,
  subway: <FaSubway />,
  taxi: <FaTaxi />,
};

// LocationMarker component - memoized
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

// TransportOption component - memoized
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

      {/* Row 3: Actions */}
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

// Optimize store row to avoid rerenders
const StoreInfo = memo(({ store, formatTime }) => (
  <div className="text-xs text-center font-sans">
    {store.name} • {store.specialty_genre || 'Various'} •{' '}
    {formatTime(store.open_hour)}-{formatTime(store.close_hour)}
  </div>
));

const TravelScreen = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { currentGame, player, travelToNeighborhood } = useGame();
  const drawerRef = useRef(null);

  // State
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [startY, setStartY] = useState(0);
  const [transportOptions, setTransportOptions] = useState([]);
  const [boroughDistances, setBoroughDistances] = useState([]);
  const [neighborhoodStores, setNeighborhoodStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Format time efficiently
  const formatTime = useCallback((hour) => {
    if (hour === null || hour === undefined) return 'N/A';
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${period}`;
  }, []);

  // Load data once - optimized to fetch everything in parallel
  useEffect(() => {
    let isMounted = true;

    const loadTravelData = async () => {
      try {
        setDataLoading(true);

        // Load all data in parallel
        const [neighborhoodResponse, transportResponse, distanceResponse] =
          await Promise.all([
            supabase.from('boroughs').select('*'),
            supabase
              .from('transportation_methods')
              .select('*')
              .order('speed_factor', { ascending: true }),
            supabase.from('borough_distances').select('*'),
          ]);

        if (!isMounted) return;

        // Process neighborhoods
        if (neighborhoodResponse.data) {
          const neighborhoodsWithCoords = neighborhoodResponse.data.map(
            (hood) => {
              const boroughKey = hood.name.toLowerCase();
              const coords = boroughCoordinates[boroughKey] || { x: 50, y: 50 };
              return {
                ...hood,
                x_coordinate: coords.x,
                y_coordinate: coords.y,
              };
            }
          );
          setNeighborhoods(neighborhoodsWithCoords);
        }

        // Process transportation methods
        if (transportResponse.data) {
          // Create a map to deduplicate by name
          const transportMap = new Map();
          transportResponse.data.forEach((method) => {
            const type = method.name.toLowerCase();
            if (!transportMap.has(type)) {
              transportMap.set(type, method);
            }
          });

          // Add icons
          const transportWithIcons = Array.from(transportMap.values()).map(
            (method) => {
              const type = method.name.toLowerCase();
              let icon = TRANSPORT_ICONS.walk;

              if (type.includes('bike')) icon = TRANSPORT_ICONS.bike;
              else if (type.includes('subway')) icon = TRANSPORT_ICONS.subway;
              else if (type.includes('taxi')) icon = TRANSPORT_ICONS.taxi;

              return { ...method, icon };
            }
          );

          // Limit to 4 options
          const limitedTransports = transportWithIcons.slice(0, 4);
          setTransportOptions(limitedTransports);

          // Pre-select first transport
          if (limitedTransports.length > 0) {
            setSelectedTransport(limitedTransports[0]);
          }
        }

        // Set borough distances
        if (distanceResponse.data) {
          setBoroughDistances(distanceResponse.data);
        }
      } catch (err) {
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

  // Load stores for selected neighborhood - optimized
  useEffect(() => {
    if (!selectedNeighborhood) {
      setNeighborhoodStores([]);
      return;
    }

    let isMounted = true;
    const fetchStores = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('id, name, specialty_genre, open_hour, close_hour')
          .eq('borough_id', selectedNeighborhood.id);

        if (error) throw error;
        if (isMounted) setNeighborhoodStores(data || []);
      } catch (err) {
        if (isMounted) setNeighborhoodStores([]);
      }
    };

    fetchStores();
    return () => {
      isMounted = false;
    };
  }, [selectedNeighborhood?.id]);

  // Memoize current neighborhood
  const currentNeighborhood = useMemo(
    () => neighborhoods.find((n) => n.id === player?.current_borough_id),
    [neighborhoods, player?.current_borough_id]
  );

  // Event handlers with useCallback
  const handleSelectNeighborhood = useCallback(
    (neighborhood, e) => {
      e.stopPropagation();
      if (neighborhood.id === player?.current_borough_id) {
        toast.error("You're already here!");
        return;
      }
      setSelectedNeighborhood(neighborhood);
    },
    [player?.current_borough_id]
  );

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
      navigate(`/game/${gameId}`, {
        state: { refresh: true },
        replace: true,
      });
    } catch (err) {
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

  const handleTouchStart = useCallback((e) => {
    setStartY(e.touches[0].clientY);
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      const diff = e.touches[0].clientY - startY;
      if (diff > 50) {
        handleCloseDrawer();
      }
    },
    [startY, handleCloseDrawer]
  );

  // Travel details calculation - memoized
  const getTravelDetails = useCallback(
    (fromBoroughId, toBoroughId, transportId) => {
      if (!boroughDistances.length || !transportOptions.length) {
        return { time: 1, cost: 0 };
      }

      const distanceRecord = boroughDistances.find(
        (d) =>
          (d.from_borough_id === fromBoroughId &&
            d.to_borough_id === toBoroughId) ||
          (d.from_borough_id === toBoroughId &&
            d.to_borough_id === fromBoroughId)
      );

      const transport = transportOptions.find((t) => t.id === transportId);
      if (!distanceRecord || !transport) return { time: 1, cost: 0 };

      // Calculate time and cost
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

  // Loading state
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

        {/* Location Markers */}
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

              {/* Stores in neighborhood */}
              {neighborhoodStores.length > 0 && (
                <div className="mb-1 px-2">
                  {neighborhoodStores.map((store) => (
                    <StoreInfo
                      key={store.id}
                      store={store}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              )}

              {/* Transport grid */}
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

              {/* Travel button */}
              <div style={{ padding: '12px 10px 6px 10px' }}>
                <Button
                  onClick={handleTravel}
                  disabled={isLoading || !selectedTransport}
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
