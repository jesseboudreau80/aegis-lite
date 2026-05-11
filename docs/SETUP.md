# Setup Guide

## Prerequisites

- Python 3.11+
- Node.js 20+
- At least one API key (Anthropic, OpenAI, or OpenRouter)

## Option 1: Docker (recommended)

```bash
git clone https://github.com/jesseboudreau80/aegis-lite.git
cd aegis-lite

cp .env.example .env
# Edit .env — add SECRET_KEY and at least one AI provider key

docker compose up
```

Open [http://localhost:3000](http://localhost:3000).

Default credentials:
- `admin@example.com` (admin role)
- `demo@example.com` (user role)

Set a demo password in `.env`: `DEMO_PASSWORD=your-password`

---

## Option 2: Local development

### Backend

```bash
cd backend

# Create and activate virtualenv
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure
cp ../.env.example .env
# Edit .env — minimum required:
#   SECRET_KEY=<openssl rand -hex 32>
#   ANTHROPIC_API_KEY=sk-ant-...  (or OPENAI_API_KEY / OPENROUTER_API_KEY)
#   LOCAL_DEV=true  (for development — allows weak secrets)

# Start
uvicorn main:app --reload --port 8100
```

The backend seeds demo users, built-in agents, and the support routing matrix on first start.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Configuration reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | — | JWT signing secret (required in production) |
| `DATABASE_URL` | `sqlite+aiosqlite:///./aegis_lite.db` | Database URL |
| `ANTHROPIC_API_KEY` | — | Claude models |
| `OPENAI_API_KEY` | — | GPT-4o models |
| `OPENROUTER_API_KEY` | — | Mistral, Llama, Gemini |
| `PERPLEXITY_API_KEY` | — | Research page |
| `DEFAULT_MONTHLY_BUDGET` | `20.0` | Default per-user monthly spend limit (USD) |
| `CORS_ORIGINS` | `http://localhost:3000,...` | Allowed frontend origins |
| `LOCAL_DEV` | `false` | Enable weak secrets and X-User-Email bypass |
| `AEGIS_EDITION` | `lite` | Edition identifier |

---

## Production checklist

- [ ] Set `SECRET_KEY` to a strong random value: `openssl rand -hex 32`
- [ ] Set `LOCAL_DEV=false` (default)
- [ ] Use PostgreSQL: `DATABASE_URL=postgresql+asyncpg://user:pass@host/aegis_lite`
- [ ] Put backend behind nginx or Caddy with HTTPS
- [ ] Restrict `CORS_ORIGINS` to your actual frontend domain
- [ ] Rotate all API keys regularly
- [ ] Never commit `.env` to version control

---

## Database

Aegis Lite defaults to SQLite (zero-ops). For production, use PostgreSQL:

```env
DATABASE_URL=postgresql+asyncpg://aegis:password@localhost:5432/aegis_lite
```

Install the asyncpg driver: `pip install asyncpg`

The schema is created automatically on first startup via SQLAlchemy `create_all`.
