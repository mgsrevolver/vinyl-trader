import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaStar,
  FaWallet,
  FaMoneyBillWave,
  FaCompactDisc,
} from 'react-icons/fa';
import { useGame } from '../contexts/GameContext';
import { sellRecord } from '../lib/gameActions';
import toast from 'react-hot-toast';
import GameHeader from '../components/ui/GameHeader';
import SlimProductCard from '../components/ui/SlimProductCard';

const Inventory = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const {
    playerInventory,
    player,
    refreshPlayerInventory,
    refreshPlayerData,
    getNetWorth,
    getInventoryValue,
  } = useGame();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('artist');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Refresh data when component mounts
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await refreshPlayerData();
        await refreshPlayerInventory();
      } catch (error) {
        console.error('Error refreshing data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [refreshPlayerData, refreshPlayerInventory]);

  // Initialize with the player's inventory
  useEffect(() => {
    if (playerInventory) {
      setFilteredInventory(
        sortInventory(playerInventory, sortField, sortDirection)
      );
    }
  }, [playerInventory, sortField, sortDirection]);

  // Filter inventory when search term changes
  useEffect(() => {
    if (playerInventory) {
      // Explode inventory to treat each item as unique
      let expandedInventory = [];

      playerInventory.forEach((item) => {
        // Create individual cards for each copy of the record
        for (let i = 0; i < item.quantity; i++) {
          expandedInventory.push({
            ...item,
            // Give each copy a unique ID by appending index
            uniqueId: `${item.id}-${i}`,
            // Set quantity to 1 since we're treating each as a separate item
            quantity: 1,
          });
        }
      });

      const filtered = expandedInventory.filter((item) => {
        const record = item.products || {};
        const searchable =
          `${record.name} ${record.artist} ${record.genre}`.toLowerCase();
        return searchable.includes(searchTerm.toLowerCase());
      });
      setFilteredInventory(sortInventory(filtered, sortField, sortDirection));
    }
  }, [searchTerm, playerInventory, sortField, sortDirection]);

  // Sort function
  const sortInventory = (inventory, field, direction) => {
    return [...inventory].sort((a, b) => {
      let aValue, bValue;

      // Handle different field types
      switch (field) {
        case 'price':
          aValue = a.estimated_current_price || a.purchase_price || 0;
          bValue = b.estimated_current_price || b.purchase_price || 0;
          break;
        case 'profit':
          aValue =
            (a.estimated_current_price || a.purchase_price) - a.purchase_price;
          bValue =
            (b.estimated_current_price || b.purchase_price) - b.purchase_price;
          break;
        case 'quantity':
          aValue = a.quantity || 0;
          bValue = b.quantity || 0;
          break;
        case 'rarity':
          aValue = a.products?.rarity || 0;
          bValue = b.products?.rarity || 0;
          break;
        case 'artist':
          aValue = a.products?.artist || '';
          bValue = b.products?.artist || '';
          break;
        case 'name':
          aValue = a.products?.name || '';
          bValue = b.products?.name || '';
          break;
        case 'year':
          aValue = a.products?.year || 0;
          bValue = b.products?.year || 0;
          break;
        default:
          aValue = a.products?.artist || '';
          bValue = b.products?.artist || '';
      }

      // Compare based on direction
      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  // Toggle sort direction or change sort field
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle selling a record
  const handleSell = async (productId, quantity = 1, inventoryId) => {
    if (!player) return;

    try {
      // Check if we have a valid inventory ID
      if (!inventoryId) {
        toast.error('Cannot sell: Missing inventory ID for this record');
        return;
      }

      // We're not in a store, so we'll just use the user's current borough
      // In a real implementation, you might want to show a modal to select a store
      const result = await sellRecord(
        player.id,
        gameId,
        null, // No specific store
        productId,
        quantity,
        inventoryId // Pass the inventory ID to properly identify the record
      );

      if (result && result.success) {
        toast.success('Record sold successfully!');

        // Refresh inventory first to remove the sold item
        if (refreshPlayerInventory) {
          await refreshPlayerInventory();
        }

        // Also refresh player data to update cash balance
        if (refreshPlayerData) {
          await refreshPlayerData();
        }
      } else {
        toast.error(result?.error?.message || 'Failed to sell record');
      }
    } catch (error) {
      console.error('Error selling record:', error);
      toast.error('Failed to complete sale');
    }
  };

  // Calculate values using context methods
  const netWorth = player
    ? player.cash -
      player.loan_amount +
      (playerInventory
        ? playerInventory.reduce((sum, item) => {
            // Use purchase price as fallback for value
            const itemValue =
              item.estimated_current_price || item.purchase_price || 0;
            return sum + itemValue * (item.quantity || 1);
          }, 0)
        : 0)
    : 0;

  const totalInventoryValue = playerInventory
    ? playerInventory.reduce((sum, item) => {
        const itemValue =
          item.estimated_current_price || item.purchase_price || 0;
        return sum + itemValue * (item.quantity || 1);
      }, 0)
    : 0;

  const cashAmount = player?.cash || 0;
  const loanAmount = player?.loan_amount || 0;

  // Get sort icon based on field and direction
  const getSortIcon = (field) => {
    if (field !== sortField) return <FaSort />;
    return sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  // Calculate rarity stars (1-5 based on rarity value)
  const getRarityStars = (rarity) => {
    const rarityStars =
      Math.max(1, Math.min(5, Math.round((rarity || 0.5) * 5))) || 3;
    return [...Array(5)].map((_, i) => (
      <FaStar
        key={i}
        size={12}
        className={i < rarityStars ? 'text-yellow-500' : 'text-gray-300'}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Add GameHeader component */}
      <GameHeader />

      <div className="max-w-xl mx-auto p-4 pt-16">
        {/* Header with back button and title */}
        <div className="header-row">
          <div className="flex items-center">
            <button
              onClick={() => navigate(`/game/${gameId}`)}
              className="vinyl-back-button"
            >
              <FaArrowLeft />
            </button>
          </div>
          <h1 className="text-2xl font-bold font-records">INVENTORY</h1>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p>Loading inventory data...</p>
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div className="relative mb-4">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search your records..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Financial Summary */}
            <div
              style={{
                margin: '16px 0',
                backgroundColor: '#f9fafb',
                padding: '16px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {/* Net Worth (main number) */}
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 'bold',
                  marginBottom: '4px',
                }}
              >
                Net Worth (Score)
              </h2>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: '#1e40af',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FaWallet style={{ marginRight: '8px' }} />$
                {Math.round(netWorth)}
              </div>

              {/* Cash + Records + Loan breakdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, paddingRight: '8px' }}>
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#4b5563',
                    }}
                  >
                    Cash
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '18px',
                      color: '#047857',
                    }}
                  >
                    <FaMoneyBillWave
                      style={{ marginRight: '6px', fontSize: '14px' }}
                    />
                    ${Math.round(cashAmount)}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    paddingLeft: '8px',
                    paddingRight: '8px',
                    borderLeft: '1px solid #e5e7eb',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#4b5563',
                    }}
                  >
                    Records
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '18px',
                      color: '#7c3aed',
                    }}
                  >
                    <FaCompactDisc
                      style={{ marginRight: '6px', fontSize: '14px' }}
                    />
                    ${Math.round(totalInventoryValue)}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    paddingLeft: '8px',
                    borderLeft: '1px solid #e5e7eb',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#4b5563',
                    }}
                  >
                    Loan
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '18px',
                      color: '#dc2626',
                    }}
                  >
                    <FaMoneyBillWave
                      style={{ marginRight: '6px', fontSize: '14px' }}
                    />
                    -${Math.round(loanAmount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Sort options - horizontal scrollable buttons */}
            <div
              style={{
                display: 'flex',
                overflowX: 'auto',
                paddingBottom: '8px',
                marginBottom: '16px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {[
                'Artist',
                'Name',
                'Year',
                'Price',
                'Profit',
                'Qty',
                'Rarity',
              ].map((field) => (
                <button
                  key={field.toLowerCase()}
                  onClick={() => handleSort(field.toLowerCase())}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '8px 16px',
                    marginRight: '8px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor:
                      sortField === field.toLowerCase() ? '#dbeafe' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  {field}{' '}
                  {sortField === field.toLowerCase() ? (
                    sortDirection === 'asc' ? (
                      <FaSortUp style={{ marginLeft: '4px' }} />
                    ) : (
                      <FaSortDown style={{ marginLeft: '4px' }} />
                    )
                  ) : (
                    <FaSort style={{ marginLeft: '4px', opacity: 0.5 }} />
                  )}
                </button>
              ))}
            </div>

            {/* Inventory list - using SlimProductCard */}
            <div className="mt-4">
              {filteredInventory.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <p className="text-gray-500 italic">
                    {searchTerm
                      ? 'No records match your search'
                      : 'Your inventory is empty'}
                  </p>
                </div>
              ) : (
                filteredInventory.map((item) => (
                  <SlimProductCard
                    key={item.uniqueId}
                    item={item}
                    actionType="none"
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Inventory;
