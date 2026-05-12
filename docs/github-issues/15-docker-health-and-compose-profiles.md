# Issue: Improve Docker Compose with profiles and production hardening

**Labels:** `good-first-issue` · `deployment` · `backend`

## Background

The current `docker-compose.yml` provides a basic two-service setup (backend + frontend). For production deployments, it's missing several important features: health-check-aware startup ordering, a profile system for different deployment scenarios (dev vs. prod), resource limits, and a reverse proxy for HTTPS.

## Acceptance criteria

- [ ] Docker Compose profiles added: `dev`, `prod`, `full` (with nginx)
- [ ] Backend health check improved: currently checks `/health` — verify it waits for DB initialization too
- [ ] Frontend depends on backend with `condition: service_healthy`
- [ ] Optional nginx service (profile `full`) with basic HTTPS-ready config template
- [ ] CPU/memory resource limits on backend and frontend services (reasonable defaults)
- [ ] Named volume for SQLite data with documented path
- [ ] `.env.example` updated with `COMPOSE_PROFILES=dev` default
- [ ] `docs/SETUP.md` updated with profile usage instructions

## Proposed profile structure

```yaml
# docker-compose.yml
services:
  backend:
    profiles: [dev, prod, full]
    ...

  frontend:
    profiles: [dev, prod, full]
    ...

  nginx:
    profiles: [full]
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - backend
```

Usage:
```bash
# Development (default)
docker compose --profile dev up

# Production (no nginx — put your own reverse proxy in front)
docker compose --profile prod up

# Full stack with nginx
docker compose --profile full up
```

## Nginx config template

Create `docker/nginx.conf.example`:

```nginx
upstream backend {
    server backend:8100;
}
upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
    }
}
```

## Resource limits

Reasonable defaults for a small production deployment:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

## Suggested files to modify

- `docker-compose.yml`
- `docker/nginx.conf.example` (create)
- `.env.example` (add `COMPOSE_PROFILES`)
- `docs/SETUP.md` (Docker profiles section)
