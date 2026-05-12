# Issue: Write Railway deployment guide

**Labels:** `good-first-issue` · `documentation` · `deployment`

## Description

Aegis Lite has a Docker Compose setup for local deployment, but no documentation for deploying to managed platforms. Railway is a popular platform for self-hosting FastAPI + Next.js applications with minimal configuration.

## Why this matters

Most potential users won't run Docker locally — they want a public URL with HTTPS. A Railway guide lowers the barrier to a production-grade deployment from "hours" to "30 minutes."

## Acceptance criteria

- [ ] New file created: `docs/deploy/RAILWAY.md`
- [ ] Covers deploying backend and frontend as separate Railway services
- [ ] Covers adding a PostgreSQL plugin and setting `DATABASE_URL`
- [ ] Covers setting all required environment variables (`SECRET_KEY`, `ANTHROPIC_API_KEY`, etc.)
- [ ] Covers connecting the frontend `API_URL` to the backend's Railway URL
- [ ] Covers the custom domain + HTTPS setup (Railway provides this automatically)
- [ ] Includes a "Verify deployment" section with health check instructions
- [ ] Written for an audience that knows Docker Compose but is new to Railway

## Structure suggestion

```markdown
# Deploying Aegis Lite on Railway

## Prerequisites
## Step 1: Create a new Railway project
## Step 2: Deploy the backend service
   - Connect the repo, set root directory to /backend
   - Add PostgreSQL plugin
   - Set environment variables
## Step 3: Deploy the frontend service
   - Connect the repo, set root directory to /frontend
   - Set API_URL to the backend Railway URL
## Step 4: Verify the deployment
   - Check /health endpoint
   - Log in with demo credentials
   - Send a test chat message
## Troubleshooting
## Production hardening checklist
```

## Notes

Railway free tier should be sufficient to demonstrate Aegis Lite. Note any limitations (sleep on inactivity, etc.) in the guide.

The Railway `railway.json` config file format may be useful — research and include if it simplifies setup.

## Suggested files to modify

- `docs/deploy/RAILWAY.md` (create — also create `docs/deploy/` directory)
- `README.md` — add a "Deploy" section linking to deploy guides
