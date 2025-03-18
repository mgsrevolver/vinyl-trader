// components/game/TravelScreen.jsx
import React, { useState, useEffect } from 'react';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { travelToNeighborhood } from '../../utils/gameLogic';

const TravelScreen = () => {
  const { user } = useAuth();
  const { gameState, refreshGameState } = useGame();
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [transportation, setTransportation] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [selectedTransport, setSelectedTransport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [travelInfo, setTravelInfo] = useState(null);

  useEffect(() => {
    // Fetch available neighborhoods
    const fetchNeighborhoods = async () => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('*')
        .neq('id', gameState.player.location);
      
      if (error) {
        console.error('Error fetching neighborhoods:', error);
      } else {
        setNeighborhoods(data);
      }
    };

    // Fetch player's unlocked transportation methods
    const fetchTransportation = async () => {
      const { data, error } = await supabase
        .from('player_transportation')
        .select('transportation:transportation_methods(*)')
        .eq('player_id', gameState.player.id);
      
      if (error) {
        console.error('Error fetching transportation:', error);
      } else {
        setTransportation(data.map(t => t.transportation));
      }
    };

    fetchNeighborhoods();
    fetchTransportation();
  }, [gameState.player]);

  // Calculate travel information when selections change
  useEffect(() => {
    if (selectedNeighborhood && selectedTransport) {
      const currentLocation = gameState.neighborhoods.find(n => n.id === gameState.player.location);
      
      // Get destination neighborhood
      const destination = neighborhoods.find(n => n.id === selectedNeighborhood);
      
      if (currentLocation && destination) {
        // Calculate distance
        const dx = currentLocation.x_coordinate - destination.x_coordinate;
        const dy = currentLocation.y_coordinate - destination.y_coordinate;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate cost and time
        const transport = transportation.find(t => t.id === selectedTransport);
        let cost = transport.base_cost;
        if (transport.is_distance_based) {
          cost += distance * 0.5;
        }
        
        const days = Math.max(1, Math.ceil(distance / transport.speed_factor));
        
        setTravelInfo({
          distance: distance.toFixed(2),
          cost: cost.toFixed(2),
          days,
          canTravel: distance <= (transport.max_range || Infinity) && gameState.player.cash >= cost
        });
      }
    } else {
      setTravelInfo(null);
    }
  }, [selectedNeighborhood, selectedTransport, gameState, neighborhoods, transportation]);

  const handleTravel = async () => {
    if (!selectedNeighborhood || !selectedTransport) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await travelToNeighborhood(
        gameState.player.id, 
        selectedNeighborhood, 
        selectedTransport
      );
      
      await refreshGameState();
      // Show success notification
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Travel</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Destination:</label>
        <select 
          className="w-full p-2 border rounded"
          value={selectedNeighborhood || ''}
          onChange={(e) => setSelectedNeighborhood(e.target.value)}
        >
          <option value="">Select a neighborhood</option>
          {neighborhoods.map(hood => (
            <option key={hood.id} value={hood.id}>
              {hood.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Transportation:</label>
        <select 
          className="w-full p-2 border rounded"
          value={selectedTransport || ''}
          onChange={(e) => setSelectedTransport(e.target.value)}
        >
          <option value="">Select transportation</option>
          {transportation.map(transport => (
            <option key={transport.id} value={transport.id}>
              {transport.name} - Base Cost: ${transport.base_cost.toFixed(2)}
            </option>
          ))}
        </select>
      </div>
      
      {travelInfo && (
        <div className="bg-blue-50 p-4 rounded mb-4">
          <h3 className="font-bold mb-2">Trip Details:</h3>
          <p>Distance: {travelInfo.distance} units</p>
          <p>Cost: ${travelInfo.cost}</p>
          <p>Travel Time: {travelInfo.days} day{travelInfo.days > 1 ? 's' : ''}</p>
          {!travelInfo.canTravel && (
            <p className="text-red-600 font-bold mt-2">
              {selectedNeighborhood && selectedTransport && (
                transportation.find(t => t.id === selectedTransport).max_range && 
                parseFloat(travelInfo.distance) > transportation.find(t => t.id === selectedTransport).max_range
                  ? `This destination is out of range for ${transportation.find(t => t.id === selectedTransport).name}!`
                  : `You don't have enough money for this trip!`
              )}
            </p>
          )}
        </div>
      )}
      
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
        disabled={loading || !travelInfo?.canTravel}
        onClick={handleTravel}
      >
        {loading ? 'Traveling...' : 'Travel'}
      </button>
    </div>
  );
};

export default TravelScreen;