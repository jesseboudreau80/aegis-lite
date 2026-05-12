# Deploying Aegis Lite on Railway

This guide deploys Aegis Lite to Railway as two services:

- **Backend**: FastAPI app from `backend/`
- **Frontend**: Next.js app from `frontend/`
- **Database**: Railway PostgreSQL plugin

It assumes you can run the project locally with Docker Compose, but are new to Railway.

## Prerequisites

- A Railway account
- A GitHub fork or repository containing Aegis Lite
- At least one AI provider API key for live responses:
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `OPENROUTER_API_KEY`
- Optional: `PERPLEXITY_API_KEY` for the Research page

Generate a production secret before you start:

```bash
openssl rand -hex 32
```

Use that value for `SECRET_KEY`. Do not use the example secrets in production.

## Step 1: Create a Railway project

1. In Railway, create a **New Project**.
2. Choose **Deploy from GitHub repo** and select your Aegis Lite repository.
3. Railway may create one service automatically. Rename it to `aegis-lite-backend` if you plan to use it for the backend.

You will add a second service for the frontend after the backend has a public URL.

## Step 2: Add PostgreSQL

1. In the Railway project, select **New** → **Database** → **Add PostgreSQL**.
2. Open the PostgreSQL service and confirm Railway created connection variables such as `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`.
3. The backend expects a SQLAlchemy async PostgreSQL URL, so set the backend service's `DATABASE_URL` to:

```text
postgresql+asyncpg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
```

If your PostgreSQL service has a different name than `Postgres`, update the variable references to match it.

> Railway also provides a `DATABASE_URL`, but it is usually a standard `postgres://...` URL. Aegis Lite uses SQLAlchemy with `asyncpg`, so the `postgresql+asyncpg://` form is the safest choice.

## Step 3: Deploy the backend service

Create or edit the backend service with these settings:

| Setting | Value |
|---|---|
| Source | Your Aegis Lite GitHub repository |
| Root directory | `backend` |
| Builder | Railway default/Nixpacks |
| Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

Set these backend environment variables:

| Variable | Required | Value / notes |
|---|---:|---|
| `SECRET_KEY` | Yes | The 32+ character random value generated above |
| `DATABASE_URL` | Yes | The `postgresql+asyncpg://...` Railway PostgreSQL URL from Step 2 |
| `LOCAL_DEV` | Yes | `false` |
| `AEGIS_EDITION` | Yes | `lite` |
| `CORS_ORIGINS` | Yes | Start with your frontend Railway URL; update after custom domains are added |
| `ANTHROPIC_API_KEY` | One provider key required for live AI | Your Anthropic key, or leave blank if using another provider |
| `OPENAI_API_KEY` | One provider key required for live AI | Your OpenAI key, or leave blank if using another provider |
| `OPENROUTER_API_KEY` | One provider key required for live AI | Your OpenRouter key, or leave blank if using another provider |
| `PERPLEXITY_API_KEY` | Optional | Enables the Research page |
| `DEFAULT_MONTHLY_BUDGET` | Optional | Defaults to `20.0` |

Deploy the service, then open **Settings** → **Networking** and generate a public Railway domain. You should get a URL similar to:

```text
https://aegis-lite-backend-production.up.railway.app
```

Check the backend directly:

```bash
curl https://YOUR-BACKEND-DOMAIN.up.railway.app/health
```

A healthy backend returns JSON with `"status":"ok"`.

## Step 4: Deploy the frontend service

Add another Railway service from the same GitHub repository.

| Setting | Value |
|---|---|
| Source | Your Aegis Lite GitHub repository |
| Root directory | `frontend` |
| Builder | Railway default/Nixpacks |
| Build command | `npm run build` |
| Start command | `npm run start` |

Set these frontend environment variables:

| Variable | Required | Value / notes |
|---|---:|---|
| `API_URL` | Yes | Your backend Railway URL, for example `https://aegis-lite-backend-production.up.railway.app` |
| `NEXT_PUBLIC_APP_NAME` | Optional | `Aegis Lite` |

The frontend sends browser requests to its own `/api/*` routes. Next.js rewrites those requests to `API_URL`, so users only need to visit the frontend URL.

After the frontend deploys, generate a public Railway domain for it. Then return to the backend service and set:

```text
CORS_ORIGINS=https://YOUR-FRONTEND-DOMAIN.up.railway.app
```

Redeploy the backend after changing `CORS_ORIGINS`.

## Step 5: Custom domain and HTTPS

Railway provides HTTPS automatically for both Railway-generated domains and custom domains.

To add custom domains:

1. Open the frontend service.
2. Go to **Settings** → **Networking** → **Custom Domain**.
3. Add your domain, then create the DNS record Railway shows.
4. Repeat for the backend if you also want a stable API domain.
5. Update environment variables after DNS is active:
   - Frontend `API_URL=https://api.example.com` if you gave the backend a custom domain.
   - Backend `CORS_ORIGINS=https://app.example.com` for the frontend custom domain.
6. Redeploy both services.

## Step 6: Verify deployment

1. **Backend health check**

   ```bash
   curl https://YOUR-BACKEND-URL/health
   ```

   Expected result: JSON containing `"status":"ok"` and `"edition":"lite"`.

2. **Frontend loads**

   Visit the frontend URL in your browser. The login page should load over HTTPS.

3. **Log in with a demo account**

   Use:

   ```text
   Email: admin@example.com
   Password: demo
   ```

4. **Send a test chat message**

   Open the chat page and send a short prompt. If no provider API key is configured, Aegis Lite can still run in demo mode, but live model responses require at least one provider key.

5. **Confirm data persists**

   Restart or redeploy the backend service, then log in again. The app should continue using the Railway PostgreSQL database.

## Troubleshooting

### Backend fails to start with `SECRET_KEY is weak or default`

`LOCAL_DEV=false` blocks weak production secrets. Set `SECRET_KEY` to a 32+ character random value:

```bash
openssl rand -hex 32
```

### Backend cannot connect to PostgreSQL

Confirm `DATABASE_URL` starts with `postgresql+asyncpg://`, not just `postgres://`, and that the variable references point to your Railway PostgreSQL service.

### Frontend loads, but API calls fail

Check the frontend service's `API_URL`. It must be the full backend URL, including `https://` and no trailing `/api` path.

Then check the backend service's `CORS_ORIGINS`. It must include the frontend's public URL exactly, including `https://`.

### Login works locally but not on Railway

Make sure both services were redeployed after environment variable changes. Also verify the browser is visiting the frontend service URL, not the backend service URL.

### The app sleeps on inactivity

Railway plan behavior can vary. If your service sleeps or cold-starts after inactivity, the first request may be slower. Upgrade the Railway project if you need always-on production behavior.

## Production hardening checklist

- Use a strong `SECRET_KEY` and rotate it if it was ever exposed.
- Keep `LOCAL_DEV=false`.
- Use Railway PostgreSQL instead of SQLite for production.
- Set `CORS_ORIGINS` to the exact frontend domain, not `*`.
- Configure at least one real AI provider key.
- Use custom domains for stable frontend and backend URLs.
- Review Railway logs after each deploy.
- Limit who can access the Railway project and provider API keys.
