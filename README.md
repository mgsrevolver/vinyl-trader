# Deli Wars

A turn-based trading game where players take on the role of deli proprietors buying and selling artisanal food products.

## Project Setup

### Prerequisites

- Node.js v14+ and npm
- Supabase account (for database and authentication)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/deli-wars.git
cd deli-wars
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up the Supabase database:

   - Create a new Supabase project
   - Go to the SQL Editor in the Supabase dashboard
   - Run the SQL queries provided in `database-schema.sql` to create the necessary tables and initial data

5. Start the development server:

```bash
npm run dev
```

## Game Concept

Deli Wars is a turn-based trading game where players:

- Buy and sell artisanal food products across different neighborhoods
- Manage inventory and finances
- Navigate market price fluctuations
- Compete to accumulate the most wealth in 30 days
- Must repay their initial loan to win

### Core Mechanics

- **Trading System**: Buy low, sell high across different neighborhoods
- **Shared Markets**: When a player buys items, they're removed from shared inventory until restock
- **Limited Inventory**: 100 slots in your "inventory bag" for carrying products
- **Loans**: Start with a $2,000 loan that must be repaid to win
- **Player Interactions**: Direct trading and loans between players with negotiable terms
- **Travel**: Moving between neighborhoods costs 1 day
- **Random Events**: Price fluctuations, special deals, and other surprises

## Tech Stack

- **Frontend**: React & Tailwind CSS
- **Backend**: Supabase (Authentication, Database, Storage)
- **Realtime**: Supabase Realtime for multiplayer synchronization

## Project Structure

```
deli-wars/
├── src/
│   ├── assets/         # Static assets
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (Auth, Game)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries (e.g., Supabase client)
│   ├── pages/          # Main application pages
│   ├── utils/          # Helper functions
│   ├── App.jsx         # Main application component
│   └── main.jsx        # Application entry point
├── .env.local          # Environment variables (not in repo)
└── tailwind.config.js  # Tailwind CSS configuration
```

## Development Roadmap

1. **Core Game Logic**: Market system, player actions, day progression
2. **Basic UI**: Market view, inventory, travel screen
3. **Multiplayer**: Turn system, notifications
4. **Player Interactions**: Trading, loans, chat
5. **Polish**: Onboarding, help system, visual improvements

## License

This project is licensed under the MIT License.
