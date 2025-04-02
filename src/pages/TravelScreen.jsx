// src/pages/TravelScreen.jsx
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaMapPin,
  FaSpinner,
  FaTimes,
  FaWalking,
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
  subway: <FaSubway />,
  taxi: <FaTaxi />,
};

// Add caching for data that rarely changes
const cacheData = {
  neighborhoods: { data: null, timestamp: 0 },
  transportMethods: { data: null, timestamp: 0 },
  boroughDistances: { data: null, timestamp: 0 },
  // Cache store data by borough ID
  stores: {},
};

// Cache timeout (5 minutes)
const CACHE_TIMEOUT = 5 * 60 * 1000;

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
  ({ transport, isSelected, onSelect, travelDetails, disabled }) => (
    <div
      onClick={disabled ? undefined : onSelect}
      className={`transport-option ${isSelected ? 'selected' : ''} ${
        disabled ? 'disabled' : ''
      }`}
      style={{
        padding: '10px 5px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled
          ? '#f0f0f0'
          : isSelected
          ? '#e5f2ff'
          : '#f5f8ff',
        borderRadius: '8px',
        border: isSelected ? '2px solid #3b82f6' : '1px solid #ddd',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
      }}
    >
      {/* Row 1: Icon and Name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          marginBottom: '2px',
        }}
      >
        <span
          style={{ fontSize: '20px', color: disabled ? '#999' : 'inherit' }}
        >
          {transport.icon}
        </span>
        <span
          style={{
            fontSize: '16px',
            fontWeight: isSelected ? 'bold' : 'normal',
            color: disabled ? '#999' : 'inherit',
          }}
        >
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
          color: disabled ? '#999' : 'inherit',
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
          color: disabled ? '#999' : 'inherit',
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
          color: disabled ? '#999' : 'inherit',
        }}
      >
        <FaWarehouse style={{ marginRight: '4px' }} />
        <span>
          Cap: {transport.capacity_modifier > 0 ? '+' : ''}
          {transport.capacity_modifier}
        </span>
      </div>

      {/* Unavailable overlay for Staten Island */}
      {disabled && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#666',
            zIndex: 1,
          }}
        >
          Unavailable
        </div>
      )}
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

  // Load data once - optimized with caching
  useEffect(() => {
    let isMounted = true;

    const loadTravelData = async () => {
      try {
        setDataLoading(true);
        const now = Date.now();
        const fetchPromises = [];
        const fetchResults = {};

        // Check if neighborhoods need to be fetched
        if (
          !cacheData.neighborhoods.data ||
          now - cacheData.neighborhoods.timestamp > CACHE_TIMEOUT
        ) {
          fetchPromises.push(
            supabase
              .from('boroughs')
              .select('*')
              .then((result) => {
                fetchResults.neighborhoods = result;
              })
          );
        }

        // Check if transportation methods need to be fetched
        if (
          !cacheData.transportMethods.data ||
          now - cacheData.transportMethods.timestamp > CACHE_TIMEOUT
        ) {
          fetchPromises.push(
            supabase
              .from('transportation_methods')
              .select('*')
              .order('speed_factor', { ascending: true })
              .then((result) => {
                fetchResults.transportMethods = result;
              })
          );
        }

        // Check if borough distances need to be fetched
        if (
          !cacheData.boroughDistances.data ||
          now - cacheData.boroughDistances.timestamp > CACHE_TIMEOUT
        ) {
          fetchPromises.push(
            supabase
              .from('borough_distances')
              .select('*')
              .then((result) => {
                fetchResults.boroughDistances = result;
              })
          );
        }

        // Run all fetches in parallel
        if (fetchPromises.length > 0) {
          await Promise.all(fetchPromises);
        }

        if (!isMounted) return;

        // Process neighborhoods
        const neighborhoodData =
          fetchResults.neighborhoods?.data || cacheData.neighborhoods.data;
        if (neighborhoodData) {
          const neighborhoodsWithCoords = neighborhoodData.map((hood) => {
            const boroughKey = hood.name.toLowerCase();
            const coords = boroughCoordinates[boroughKey] || { x: 50, y: 50 };
            return {
              ...hood,
              x_coordinate: coords.x,
              y_coordinate: coords.y,
            };
          });
          setNeighborhoods(neighborhoodsWithCoords);

          // Update cache
          if (fetchResults.neighborhoods) {
            cacheData.neighborhoods.data = neighborhoodData;
            cacheData.neighborhoods.timestamp = now;
          }
        }

        // Process transportation methods
        const transportData =
          fetchResults.transportMethods?.data ||
          cacheData.transportMethods.data;
        if (transportData) {
          // Pre-filter to only include the three types we need (walk, subway, taxi)
          const transportTypes = ['walk', 'subway', 'taxi'];

          // Get the best option for each type
          const bestTransportByType = {};

          transportData.forEach((method) => {
            const lowerName = method.name.toLowerCase();

            // Skip bikes as specified
            if (lowerName.includes('bike')) return;

            // Determine the type
            let type = null;
            if (lowerName.includes('walk')) type = 'walk';
            else if (lowerName.includes('subway')) type = 'subway';
            else if (lowerName.includes('taxi')) type = 'taxi';
            else return; // Skip if not one of our needed types

            // Keep the best option based on speed_factor
            if (
              !bestTransportByType[type] ||
              method.speed_factor > bestTransportByType[type].speed_factor
            ) {
              bestTransportByType[type] = method;
            }
          });

          // Convert back to array and add icons
          const transportWithIcons = transportTypes
            .filter((type) => bestTransportByType[type])
            .map((type) => {
              const method = bestTransportByType[type];
              return {
                ...method,
                icon: TRANSPORT_ICONS[type],
              };
            });

          setTransportOptions(transportWithIcons);

          // Pre-select first transport option
          if (transportWithIcons.length > 0) {
            setSelectedTransport(transportWithIcons[0]);
          }

          // Update cache
          if (fetchResults.transportMethods) {
            cacheData.transportMethods.data = transportData;
            cacheData.transportMethods.timestamp = now;
          }
        }

        // Set borough distances
        const distanceData =
          fetchResults.boroughDistances?.data ||
          cacheData.boroughDistances.data;
        if (distanceData) {
          setBoroughDistances(distanceData);

          // Update cache
          if (fetchResults.boroughDistances) {
            cacheData.boroughDistances.data = distanceData;
            cacheData.boroughDistances.timestamp = now;
          }
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

  // Load stores for selected neighborhood - optimized with caching
  useEffect(() => {
    if (!selectedNeighborhood) {
      setNeighborhoodStores([]);
      return;
    }

    let isMounted = true;
    const fetchStores = async () => {
      try {
        const boroughId = selectedNeighborhood.id;
        const now = Date.now();

        // Check if we have cached data for this borough
        if (
          cacheData.stores[boroughId] &&
          now - cacheData.stores[boroughId].timestamp < CACHE_TIMEOUT
        ) {
          setNeighborhoodStores(cacheData.stores[boroughId].data);
          return;
        }

        // If not cached, fetch stores
        const { data, error } = await supabase
          .from('stores')
          .select('id, name, specialty_genre, open_hour, close_hour')
          .eq('borough_id', boroughId);

        if (error) throw error;

        // Update state and cache
        if (isMounted) {
          setNeighborhoodStores(data || []);
          cacheData.stores[boroughId] = {
            data: data || [],
            timestamp: now,
          };
        }
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

  // Automatically select taxi when Staten Island is involved
  useEffect(() => {
    if (!selectedNeighborhood || !transportOptions.length) return;

    // Check if travel involves Staten Island
    const currentNeighborhoodName = neighborhoods
      .find((n) => n.id === player?.current_borough_id)
      ?.name?.toLowerCase();

    const selectedNeighborhoodName = selectedNeighborhood?.name?.toLowerCase();

    const involvesStatenIsland =
      currentNeighborhoodName === 'staten island' ||
      selectedNeighborhoodName === 'staten island';

    if (involvesStatenIsland) {
      // Find and auto-select the taxi option
      const taxiOption = transportOptions.find((t) =>
        t.name.toLowerCase().includes('taxi')
      );

      if (taxiOption) {
        setSelectedTransport(taxiOption);
      }
    } else if (!selectedTransport) {
      // For non-Staten Island travel, select the first option if none selected
      setSelectedTransport(transportOptions[0]);
    }
  }, [
    selectedNeighborhood,
    transportOptions,
    neighborhoods,
    player?.current_borough_id,
    selectedTransport,
  ]);

  // Determine if Staten Island is involved - memoized to reduce recalculations
  const involvesStatenIsland = useMemo(() => {
    if (!selectedNeighborhood || !neighborhoods.length || !player) return false;

    const currentNeighborhoodName = neighborhoods
      .find((n) => n.id === player.current_borough_id)
      ?.name?.toLowerCase();

    const selectedNeighborhoodName = selectedNeighborhood?.name?.toLowerCase();

    return (
      currentNeighborhoodName === 'staten island' ||
      selectedNeighborhoodName === 'staten island'
    );
  }, [selectedNeighborhood, neighborhoods, player]);

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
      {/* Back Button - Moved outside the travel-container */}
      <button
        className="vinyl-back-button"
        style={{
          position: 'fixed',
          top: '90px' /* Position below the header */,
          left: '16px',
          zIndex: 150 /* Higher than any other element */,
        }}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/game/${gameId}`);
        }}
      >
        <FaArrowLeft />
      </button>

      <div className="map-overlay"></div>

      <div className="travel-container">
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
              style={{
                maxHeight: '80vh',
                overflow: 'auto',
                backgroundColor: 'white', // Ensure background is white
                zIndex: 100, // Higher z-index to ensure it's on top
                position: 'relative', // Position relative for proper stacking
              }}
            >
              <div className="drawer-handle"></div>

              <div
                className="drawer-header"
                style={{ marginBottom: '12px', paddingBottom: '8px' }}
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
                <div className="mb-4 px-2">
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
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  padding: '0 10px',
                  maxHeight: '180px',
                  marginBottom: '16px',
                }}
              >
                {/* Staten Island warning message */}
                {involvesStatenIsland && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      textAlign: 'center',
                      marginBottom: '10px',
                      padding: '8px',
                      backgroundColor: '#fffbea',
                      border: '1px solid #fbd38d',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#723b13',
                    }}
                  >
                    <strong>Note:</strong> Staten Island is only accessible by
                    taxi.
                  </div>
                )}

                {transportOptions.map((transport) => {
                  const travelDetails = getTravelDetails(
                    player.current_borough_id,
                    selectedNeighborhood?.id,
                    transport.id
                  );

                  // Instead of recalculating this for each transport option, use our memo
                  const isDisabled =
                    involvesStatenIsland &&
                    !transport.name.toLowerCase().includes('taxi');

                  // Highlight taxi for Staten Island
                  const isStatenIslandTaxi =
                    involvesStatenIsland &&
                    transport.name.toLowerCase().includes('taxi');

                  return (
                    <TransportOption
                      key={transport.id}
                      transport={transport}
                      isSelected={
                        selectedTransport?.id === transport.id ||
                        isStatenIslandTaxi
                      }
                      onSelect={() => setSelectedTransport(transport)}
                      travelDetails={travelDetails}
                      disabled={isDisabled}
                    />
                  );
                })}
              </div>

              {/* Travel button */}
              <div
                style={{
                  padding: '10px 10px 16px 10px',
                  position: 'sticky',
                  bottom: 0,
                  backgroundColor: 'white',
                  borderTop: '1px solid #eee',
                  marginTop: '10px',
                }}
              >
                <Button
                  onClick={handleTravel}
                  disabled={isLoading || !selectedTransport}
                  size="lg"
                  fullWidth
                  style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    padding: '14px',
                    backgroundColor: !selectedTransport
                      ? '#ccc'
                      : selectedTransport.name.toLowerCase().includes('taxi') &&
                        involvesStatenIsland
                      ? '#f59e0b'
                      : '#3b82f6',
                    color: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}
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
