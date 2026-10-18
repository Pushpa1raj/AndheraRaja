# Andhera Raja Backend

FastAPI backend for the Andhera Raja virtual credits gaming platform.

## Setup

### 1. Create virtual environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Copy `.env` and fill in your Supabase credentials:

```bash
cp .env .env.local
# Edit .env.local with your actual credentials
```

### 4. Run the server

```bash
python run.py
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/api/v1/docs
- Health: http://localhost:8000/health

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/          # API routes
│   ├── core/            # Config, security
│   ├── db/              # Database session
│   ├── models/          # SQLAlchemy models
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # Business logic
│   └── main.py          # FastAPI app
├── .env                 # Environment template
├── requirements.txt     # Python dependencies
└── run.py              # Development server
```

## API Endpoints

### Public
- `GET /` - Root
- `GET /health` - Health check

### Users
- `GET /api/v1/users/me` - Get current user
- `GET /api/v1/users/{user_id}` - Get user by ID

### Credits
- `GET /api/v1/credits/balance` - Get credit balance
- `GET /api/v1/credits/transactions` - List transactions
- `POST /api/v1/credits/requests` - Create credit request
- `GET /api/v1/credits/requests` - List credit requests

### Games
- `GET /api/v1/games/` - List games
- `GET /api/v1/games/{game_id}` - Get game details
- `POST /api/v1/games/{game_id}/sessions` - Create session
- `GET /api/v1/games/sessions/{session_id}` - Get session

### Notifications
- `GET /api/v1/notifications/` - List notifications
- `PATCH /api/v1/notifications/{id}/read` - Mark as read

### Admin
- `GET /api/v1/admin/dashboard` - Dashboard stats
- `GET /api/v1/admin/users` - List all users
- `POST /api/v1/admin/credits/allocate` - Allocate credits
- `GET /api/v1/admin/credit-requests` - List requests
- `PATCH /api/v1/admin/credit-requests/{id}` - Review request

## Development

The backend is built with:
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for PostgreSQL
- **Pydantic** - Data validation
- **Supabase** - PostgreSQL database + Auth
- **JWT** - Authentication tokens

## Next Steps

1. Set up Supabase project and database
2. Run migrations to create tables
3. Implement business logic in services
4. Add WebSocket support for live games
5. Write tests
