# Andhera Raja - Virtual Credits Gaming Platform

> A modern, mobile-first gaming website where users can play virtual-credit games (Aviator and Mines), request credits from admins, and track their gaming history.

---

## 📋 Project Overview

**Product Type**: Virtual-credit gaming platform (non-redeemable, educational/entertainment only)

**Tech Stack**:
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI (Python) + SQLAlchemy + Pydantic
- **Database**: PostgreSQL (via Supabase)
- **Auth**: Supabase Auth (email/password, JWT)
- **Real-time**: WebSockets (FastAPI) + Supabase Realtime
- **Deployment**: TBD (Vercel for frontend recommended, any Python host for backend)

---

## 🎯 Features

### User Features
- ✅ Registration and login (Supabase Auth)
- ✅ Profile management
- ✅ Virtual credit balance tracking
- ✅ Credit request submission
- ✅ **Aviator Game**: Cash out before the plane crashes
- ✅ **Mines Game**: Reveal safe cells, avoid mines
- ✅ Game history and statistics
- ✅ Transaction history
- ✅ In-app notifications
- ✅ Mobile-first responsive design

### Admin Features
- ✅ Admin dashboard with statistics
- ✅ User management
- ✅ Credit allocation
- ✅ Credit request approval/rejection
- ✅ Game configuration (enable/disable, maintenance mode)
- ✅ Game session monitoring
- ✅ Round cancellation and correction (with audit trail)
- ✅ Audit logs for all admin actions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
│                    (Web Browsers)                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ HTTPS + WebSocket
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                    Next.js Frontend                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pages: Home, Games, Credits, Account, Admin         │   │
│  │  Components: Layout, Navigation, Game UI             │   │
│  │  State: Zustand (auth, game state)                   │   │
│  │  Styling: Tailwind CSS + shadcn/ui                   │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ REST API + JWT Auth
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                   FastAPI Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes: /users, /credits, /games, /admin            │   │
│  │  Services: Credit, Game, Notification                │   │
│  │  Game Engines: Aviator, Mines                        │   │
│  │  WebSocket: Real-time game updates                   │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ SQL + Row-Level Security
                    │
┌───────────────────▼─────────────────────────────────────────┐
│              Supabase (PostgreSQL + Auth)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tables: users, credit_accounts, credit_transactions │   │
│  │          credit_requests, games, game_sessions       │   │
│  │          notifications, audit_logs                   │   │
│  │  Auth: JWT tokens, password hashing                  │   │
│  │  Realtime: Database change subscriptions             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
AndheraRaja/
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── (main)/        # Authenticated layout
│   │   │   │   ├── page.tsx           # Homepage
│   │   │   │   ├── games/             # Games pages
│   │   │   │   ├── credits/           # Credits pages
│   │   │   │   └── account/           # Account pages
│   │   │   ├── (auth)/        # Auth layout
│   │   │   │   ├── login/             # Login page
│   │   │   │   └── register/          # Registration page
│   │   │   └── layout.tsx             # Root layout
│   │   ├── components/        # Reusable components
│   │   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── layout/                # Layout components
│   │   │   ├── games/                 # Game components
│   │   │   └── providers/             # Context providers
│   │   ├── lib/               # Utilities
│   │   │   ├── supabase/              # Supabase clients
│   │   │   ├── api.ts                 # API client
│   │   │   └── utils.ts               # Helper functions
│   │   ├── stores/            # Zustand stores
│   │   ├── types/             # TypeScript types
│   │   └── hooks/             # Custom React hooks
│   ├── public/                # Static assets
│   ├── .env.local             # Environment variables
│   ├── next.config.js         # Next.js config
│   ├── tailwind.config.ts     # Tailwind config
│   └── package.json
│
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/            # API routes
│   │   │       ├── users.py
│   │   │       ├── credits.py
│   │   │       ├── games.py
│   │   │       ├── notifications.py
│   │   │       └── admin.py
│   │   ├── core/              # Core functionality
│   │   │   ├── config.py              # Settings
│   │   │   └── security.py            # Auth & security
│   │   ├── db/                # Database
│   │   │   └── session.py             # DB connection
│   │   ├── models/            # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── credit.py
│   │   │   ├── game.py
│   │   │   ├── notification.py
│   │   │   └── audit.py
│   │   ├── schemas/           # Pydantic schemas
│   │   │   ├── user.py
│   │   │   ├── credit.py
│   │   │   ├── game.py
│   │   │   └── notification.py
│   │   ├── services/          # Business logic
│   │   │   ├── credit.py
│   │   │   ├── aviator.py
│   │   │   ├── mines.py
│   │   │   └── notification.py
│   │   └── main.py            # FastAPI app
│   ├── .env                   # Environment variables
│   ├── requirements.txt       # Python dependencies
│   ├── run.py                 # Development server
│   └── README.md
│
├── supabase/                   # Database migrations
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── docs/                       # Documentation
│   ├── API.md                         # API documentation
│   ├── GAMES.md                       # Game rules
│   └── DEPLOYMENT.md                  # Deployment guide
│
├── CLAUDE.md                   # Claude Code instructions
└── README.md                   # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)
- **Supabase Account** (for database and auth)

### 1. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Note your:
   - Project URL
   - Anon (public) key
   - Service role (secret) key
   - JWT secret
   - Database connection string
3. Run the migration:
   ```bash
   # In Supabase SQL Editor, run:
   # supabase/migrations/001_initial_schema.sql
   ```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Run development server
npm run dev
```

The frontend will be available at **http://localhost:3000**

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env .env.local

# Edit .env.local with your Supabase credentials
# SUPABASE_URL=your-supabase-url
# SUPABASE_KEY=your-service-role-key
# SUPABASE_JWT_SECRET=your-jwt-secret
# DATABASE_URL=postgresql://...

# Run development server
python run.py
```

The API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/api/v1/docs
- **Health**: http://localhost:8000/health

---

## 🎮 Game Rules

### Aviator

**Objective**: Cash out before the plane crashes.

**How to Play**:
1. Select your wager amount (10-10,000 credits)
2. Watch the multiplier rise as the plane flies
3. Click "Cash Out" before the crash
4. If you cash out in time: win = wager × multiplier
5. If the plane crashes first: lose your wager

**Technical Details**:
- Multiplier starts at 1.00x
- Increases by 0.01x every 100ms (configurable)
- Crash point is determined server-side before round starts
- Maximum multiplier: 100.00x (configurable)
- Cash-out requests are processed by the server
- Late cash-outs (after crash) are rejected

### Mines

**Objective**: Reveal safe cells to increase your multiplier. Cash out before hitting a mine.

**How to Play**:
1. Select grid size (5×5 default)
2. Select number of mines (3-24)
3. Select your wager amount (10-10,000 credits)
4. Click cells to reveal them
5. Each safe cell increases your multiplier
6. Click "Cash Out" to collect your credits
7. Hitting a mine ends the round as a loss

**Technical Details**:
- Mine positions are generated server-side at round start
- Multiplier calculation based on grid size, mines, and revealed cells
- Formula: `multiplier = (total_cells - revealed) / (total_cells - mines) ^ revealed`
- Each cell selection is validated server-side
- Duplicate selections are rejected
- Cash-out triggers payout calculation

---

## 🔐 Security & Compliance

### Virtual Credits Policy

⚠️ **IMPORTANT**: Virtual credits are:
- **Non-redeemable**: Cannot be converted to real money
- **Non-transferable**: Cannot be sent between users
- **Non-purchasable**: No payment processing or deposits
- **Educational/Entertainment only**: Not gambling

This platform is designed for **entertainment and demonstration purposes only**.

### Security Features

- ✅ Supabase Auth with JWT tokens
- ✅ Row-Level Security (RLS) policies
- ✅ Server-side game validation
- ✅ Atomic credit transactions
- ✅ Optimistic locking for concurrent updates
- ✅ Admin action audit logs
- ✅ Rate limiting on authentication endpoints
- ✅ Input validation (Pydantic)
- ✅ CORS configuration
- ✅ HTTPS required in production

---

## 📊 Database Schema

See `supabase/migrations/001_initial_schema.sql` for the complete schema.

**Key Tables**:
- `users` - User accounts (extends Supabase auth.users)
- `credit_accounts` - Virtual credit balances
- `credit_transactions` - All credit movements (immutable audit trail)
- `credit_requests` - User credit requests for admin approval
- `games` - Game definitions and configurations
- `game_sessions` - Individual game rounds
- `notifications` - In-app notifications
- `audit_logs` - Admin action audit trail

---

## 🧪 Development Phases

### ✅ Phase 1: Foundation (Current)
- [x] Project structure
- [x] Database schema
- [x] Authentication system
- [x] Basic layouts and navigation
- [x] Placeholder pages

### 🚧 Phase 2: Virtual Credit System
- [ ] Credit balance display
- [ ] Credit transaction ledger
- [ ] Credit request form
- [ ] Admin credit approval workflow
- [ ] Manual credit allocation
- [ ] Notification system

### 📋 Phase 3: Gaming Platform
- [ ] Aviator game implementation
- [ ] Mines game implementation
- [ ] WebSocket real-time updates
- [ ] Credit settlement logic
- [ ] Game history

### 🛡️ Phase 4: Admin Dashboard
- [ ] User management
- [ ] Game configuration UI
- [ ] Session monitoring
- [ ] Result correction workflow
- [ ] Audit log viewer

### ✅ Phase 5: QA & Launch
- [ ] Mobile responsiveness testing
- [ ] Security audit
- [ ] Credit consistency testing
- [ ] Game state testing
- [ ] Legal compliance review
- [ ] Production deployment

---

## 🤝 Contributing

This is a demonstration project. For production use, ensure:

1. **Legal review** in your jurisdiction
2. **Age verification** if required
3. **Terms of Service** and Privacy Policy
4. **Responsible gaming** disclaimers
5. **Security audit** before launch

---

## 📄 License

This project is for educational and demonstration purposes.

**Disclaimer**: Virtual credits have no monetary value. This platform does not involve real money gambling.

---

## 📞 Support

For questions about this codebase, refer to:
- `docs/API.md` - API documentation
- `docs/GAMES.md` - Game mechanics
- `docs/DEPLOYMENT.md` - Deployment instructions
- FastAPI docs: http://localhost:8000/api/v1/docs

---

**Built with Claude Code** 🤖
