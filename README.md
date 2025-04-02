# Vinyl-Trader

A turn-based record trading game where players buy and sell vinyl records across different boroughs, aiming to build the most valuable collection.

## Game Concept

Vinyl-Trader is a game about record flipping where players:

- Buy and sell vinyl records across different stores and boroughs
- Manage inventory space and cash flow
- Navigate price fluctuations based on store specialty, record condition, and time of day
- Build wealth through strategic buying and selling
- Start with a loan that must be repaid

### Core Mechanics

- **Dynamic Pricing System**: Record prices vary based on:
  - Condition (Mint, Good, Fair, Poor)
  - Store specialty genres (80% bonus for matching genres)
  - Borough location (different areas have price modifiers)
  - Time of day (12PM-6PM offers best prices)
- **Limited Resources**:
  - Limited inventory capacity
  - Limited actions per day
  - Time advances with actions
- **Market Simulation**:
  - Stores maintain their own inventories
  - When you sell records to stores, they add them to their inventory
  - When you buy records, they're removed from store inventory

## Technical Implementation

- **Frontend**: React with Vite, Tailwind CSS for styling
- **Backend**: Supabase for database, authentication, and real-time updates
- **Custom SQL Functions**: PostgreSQL functions handle sophisticated pricing mechanics

## Setup Instructions

### Prerequisites

- Node.js v14+ and npm
- Supabase account for database and authentication

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/vinyl-trader.git
cd vinyl-trader
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the Supabase database:

   - Import the SQL schema files into your Supabase project
   - This includes tables for players, inventory, stores, products, boroughs, and market_inventory
   - Includes custom PostgreSQL functions for price calculations

5. Start the development server:

```bash
npm run dev
```

## Database Functions

The game relies on several PostgreSQL functions that handle key mechanics:

- `get_sell_price`: Calculates the price a player receives when selling a record
- `sell_record`: Handles the complete record selling process
- `buy_record`: Handles the record buying process

## Project Structure

```
vinyl-trader/
├── src/
│   ├── components/     # UI components
│   │   └── ui/         # Reusable UI elements
│   │       ├── SlimProductCard.jsx  # Card for displaying records
│   │       ├── ProductCard.jsx      # Full-sized record card
│   │       ├── GameHeader.jsx       # Game status header
│   │       └── ActionButton.jsx     # Standard action buttons
│   ├── contexts/
│   │   └── GameContext.jsx  # Game state management
│   ├── lib/
│   │   ├── supabase.js      # Supabase client configuration
│   │   └── gameActions.js   # Game action functions (buy/sell/etc)
│   ├── pages/
│   │   ├── Store.jsx        # Store view for buying/selling
│   │   ├── Inventory.jsx    # Player inventory management
│   │   └── Game.jsx         # Main game view/hub
│   └── services/
│       └── gameAPI.js       # API interaction service
├── public/                  # Static assets
└── sql/                     # SQL functions and schema
    └── fix_pricing.sql      # Database function definitions
```

## Features In Progress

- Improving pricing mechanics
- Market fluctuations
- Player-to-player trading
- Multiple game sessions
- Leaderboards

## License

This project is licensed under the MIT License.
