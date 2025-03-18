// src/pages/TravelScreen.jsx
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaMapMarkerAlt,
  FaCarSide,
  FaSubway,
  FaBicycle,
  FaSpinner,
  FaTaxi,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useGame } from '../contexts/GameContext';

const TravelScreen = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { currentGame, player, loading, travelToNeighborhood } = useGame();

  const [neighborhoods, setNeighborhoods] = useState([]);
  const [transportMethods, setTransportMethods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [mapSize, setMapSize] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const loadTravelData = async () => {
      try {
        setDataLoading(true);

        // Load neighborhoods
        const { data: neighborhoodData, error: neighborhoodError } =
          await supabase.from('neighborhoods').select('*');

        if (neighborhoodError) throw neighborhoodError;

        setNeighborhoods(neighborhoodData || []);

        // Load transport methods
        const { data: transportData, error: transportError } = await supabase
          .from('transportation_methods')
          .select('*');

        if (transportError) throw transportError;

        setTransportMethods(transportData || []);

        // Set default transport method (usually the cheapest one)
        if (transportData && transportData.length > 0) {
          const cheapestTransport = transportData.reduce(
            (cheapest, current) =>
              current.base_cost < cheapest.base_cost ? current : cheapest,
            transportData[0]
          );

          setSelectedTransport(cheapestTransport);
        }
      } catch (err) {
        console.error('Error loading travel data:', err);
        toast.error('Failed to load travel data');
      } finally {
        setDataLoading(false);
      }
    };

    loadTravelData();

    // Set map size based on screen width
    const updateMapSize = () => {
      const width = Math.min(window.innerWidth - 40, 600);
      setMapSize({
        width,
        height: width * 0.67, // Maintain aspect ratio
      });
    };

    updateMapSize();
    window.addEventListener('resize', updateMapSize);

    return () => window.removeEventListener('resize', updateMapSize);
  }, []);

  const handleSelectNeighborhood = (neighborhood) => {
    // Don't select current location
    if (neighborhood.id === player.location) {
      toast.error("You're already in this neighborhood!");
      return;
    }

    setSelectedNeighborhood(neighborhood);
  };

  const handleSelectTransport = (transport) => {
    setSelectedTransport(transport);
  };

  const handleTravel = async () => {
    if (!selectedNeighborhood || !selectedTransport) {
      toast.error('Please select a destination and transport method');
      return;
    }

    // In a real implementation, we would:
    // 1. Calculate travel cost based on distance and transport method
    // 2. Check if player has enough money
    // 3. Deduct travel cost from player cash
    // 4. Advance game day based on travel time

    const { success, error } = await travelToNeighborhood(
      selectedNeighborhood.id
    );

    if (success) {
      toast.success(`Traveled to ${selectedNeighborhood.name}`);
      navigate(`/game/${gameId}`);
    } else {
      toast.error(`Travel failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const calculateTravelCost = (neighborhood) => {
    if (!selectedTransport) return 0;

    // In a real implementation, you would calculate distance between neighborhoods
    // and apply the transport method's cost factor

    // For now, just return the base cost of the transport method
    return selectedTransport.base_cost;
  };

  const formatMoney = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  // Get the current neighborhood object
  const currentNeighborhood = neighborhoods.find(
    (n) => n.id === player?.location
  );

  if (dataLoading || !player) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-blue-700">Loading travel options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      {/* Game Jam Banner */}
      <a
        target="_blank"
        href="https://jam.pieter.com"
        style={{
          fontFamily: "'system-ui', sans-serif",
          position: 'fixed',
          bottom: '-1px',
          right: '-1px',
          padding: '7px',
          fontSize: '14px',
          fontWeight: 'bold',
          background: '#fff',
          color: '#000',
          textDecoration: 'none',
          zIndex: 10,
          borderTopLeftRadius: '12px',
          border: '1px solid #fff',
        }}
      >
        🕹️ Vibe Jam 2025
      </a>

      {/* Header */}
      <header className="bg-white shadow-md p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center">
            <Link
              to={`/game/${gameId}`}
              className="mr-4 text-blue-600 hover:text-blue-800"
            >
              <FaArrowLeft />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-blue-700">Travel</h1>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <span>
                  Current Location:{' '}
                  {currentNeighborhood?.name || player.location}
                </span>
                <span className="mx-2">•</span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  {formatMoney(player.cash)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-4 mt-4">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4">
            <h2 className="text-lg font-medium mb-4">Select Destination</h2>

            {/* Map visualization */}
            <div
              className="border rounded-lg overflow-hidden mb-6 relative bg-blue-50"
              style={{
                height: mapSize.height,
                width: '100%',
                maxWidth: mapSize.width,
                margin: '0 auto',
              }}
            >
              {neighborhoods.map((neighborhood) => (
                <button
                  key={neighborhood.id}
                  onClick={() => handleSelectNeighborhood(neighborhood)}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                    neighborhood.id === player.location
                      ? 'text-red-600'
                      : selectedNeighborhood?.id === neighborhood.id
                      ? 'text-green-600'
                      : 'text-blue-600'
                  }`}
                  style={{
                    left: `${
                      (neighborhood.x_coordinate / 100) * mapSize.width
                    }px`,
                    top: `${
                      (neighborhood.y_coordinate / 100) * mapSize.height
                    }px`,
                  }}
                  title={neighborhood.name}
                >
                  <div className="relative">
                    <FaMapMarkerAlt size={26} />
                    {neighborhood.id === player.location && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div
                    className={`text-xs mt-1 font-medium ${
                      neighborhood.id === player.location
                        ? 'text-red-700'
                        : selectedNeighborhood?.id === neighborhood.id
                        ? 'text-green-700'
                        : 'text-gray-700'
                    }`}
                  >
                    {neighborhood.name}
                  </div>
                </button>
              ))}

              {/* Legend */}
              <div className="absolute bottom-2 left-2 bg-white bg-opacity-80 p-2 rounded text-xs">
                <div className="flex items-center">
                  <FaMapMarkerAlt className="text-red-600 mr-1" />
                  <span>Your Location</span>
                </div>
                <div className="flex items-center mt-1">
                  <FaMapMarkerAlt className="text-blue-600 mr-1" />
                  <span>Other Neighborhoods</span>
                </div>
                <div className="flex items-center mt-1">
                  <FaMapMarkerAlt className="text-green-600 mr-1" />
                  <span>Selected Destination</span>
                </div>
              </div>
            </div>

            {/* Transport selection */}
            {selectedNeighborhood && (
              <div className="mt-6">
                <h3 className="font-medium mb-3">Select Transportation:</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {transportMethods.map((transport) => (
                    <button
                      key={transport.id}
                      onClick={() => handleSelectTransport(transport)}
                      className={`p-4 rounded-lg border ${
                        selectedTransport?.id === transport.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        {transport.type === 'bicycle' ? (
                          <FaBicycle className="text-2xl mb-2" />
                        ) : transport.type === 'subway' ? (
                          <FaSubway className="text-2xl mb-2" />
                        ) : transport.type === 'taxi' ? (
                          <FaTaxi className="text-2xl mb-2" />
                        ) : (
                          <FaCarSide className="text-2xl mb-2" />
                        )}
                        <span className="font-medium">{transport.name}</span>
                        <span className="text-sm text-gray-600 mt-1">
                          {formatMoney(transport.base_cost)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Travel summary */}
            {selectedNeighborhood && selectedTransport && (
              <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h3 className="font-medium mb-2">Travel Summary:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>From:</span>
                    <span className="font-medium">
                      {currentNeighborhood?.name || player.location}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>To:</span>
                    <span className="font-medium">
                      {selectedNeighborhood.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transport:</span>
                    <span className="font-medium">
                      {selectedTransport.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost:</span>
                    <span className="font-medium">
                      {formatMoney(calculateTravelCost(selectedNeighborhood))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Day Cost:</span>
                    <span className="font-medium">1 day</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleTravel}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <FaSpinner className="animate-spin mr-2" />
                        Traveling...
                      </span>
                    ) : (
                      'Travel Now'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TravelScreen;
