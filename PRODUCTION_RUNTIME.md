# Aegis Lite — Production Runtime

## Architecture

Aegis Lite runs as two independent systemd services on the production host. systemd owns the process lifecycle: it starts them on boot, restarts them automatically on crash, and logs all output to the journal.

```
systemd
├── aegis-lite-api.service   FastAPI / uvicorn   :8107   Restart=always
└── aegis-lite-web.service   Next.js             :3007   Restart=always
```

Traffic path:

```
Client → Cloudflare Edge → cloudflared tunnel → localhost
  aegis-lite.jesseboudreau.com        → :3007 (Next.js)
  aegis-lite-api.jesseboudreau.com    → :8107 (FastAPI)
```

## Service files

Unit files are version-controlled in `deploy/systemd/` and installed at `/etc/systemd/system/`.

| File | Location |
|---|---|
| `deploy/systemd/aegis-lite-api.service` | `/etc/systemd/system/aegis-lite-api.service` |
| `deploy/systemd/aegis-lite-web.service` | `/etc/systemd/system/aegis-lite-web.service` |

## Management scripts

All scripts are in the repo root and delegate to systemctl.

```bash
./start.sh              # start both services
./stop.sh               # stop both services
./restart.sh            # restart both services
./restart.sh backend    # restart backend only
./restart.sh frontend   # restart frontend only
./status.sh             # health check: systemd state + HTTP checks + public endpoint
./logs.sh               # tail both logs (journalctl)
./logs.sh backend       # tail backend log only
./logs.sh frontend      # tail frontend log only
```

## Logs

systemd captures all stdout/stderr from both services and sends it to the system journal.

```bash
# Follow both services live
sudo journalctl -u aegis-lite-api -u aegis-lite-web -f

# Last 100 lines of backend
sudo journalctl -u aegis-lite-api -n 100 --no-pager

# Since last boot
sudo journalctl -u aegis-lite-web -b

# Errors only
sudo journalctl -u aegis-lite-api -p err -n 50 --no-pager
```

Log files are also written to `.logs/` (append mode, via systemd `StandardOutput`):
- `.logs/backend.log`
- `.logs/frontend.log`

## Health checks

```bash
# Backend
curl http://127.0.0.1:8107/health

# Frontend
curl -I http://127.0.0.1:3007/

# Full status including public endpoint
./status.sh
```

## Restart behavior

Both services use `Restart=always` with `RestartSec=10`. If a process crashes, systemd brings it back within 10 seconds without any manual intervention. There is no restart loop cap — use `journalctl` to diagnose repeated crashes.

```bash
# Check restart count
systemctl show -p NRestarts aegis-lite-api.service
systemctl show -p NRestarts aegis-lite-web.service
```

## Boot persistence

Both services are enabled (`WantedBy=multi-user.target`). After a reboot:

1. `aegis-lite-api.service` starts automatically (after `network-online.target`)
2. `aegis-lite-web.service` starts automatically (after `aegis-lite-api.service`)
3. Cloudflare tunnel (`cloudflared.service`) reconnects automatically

No manual intervention is needed after a reboot.

## Emergency recovery

If something is badly broken and you need to recover from scratch:

```bash
# Full restart
sudo systemctl restart aegis-lite-api.service
sudo systemctl restart aegis-lite-web.service

# Force kill and restart
sudo systemctl kill -s SIGKILL aegis-lite-api.service && sudo systemctl start aegis-lite-api.service
sudo systemctl kill -s SIGKILL aegis-lite-web.service && sudo systemctl start aegis-lite-web.service

# Verify port ownership (should show systemd-managed PIDs)
ss -tlnp | grep -E '3007|8107'

# Check for port conflicts
fuser 3007/tcp 8107/tcp
```

## Fresh host install

On a new Ubuntu host after cloning the repo:

```bash
# 1. Install system dependencies
sudo apt install python3.11 python3.11-venv nodejs npm

# 2. Set up backend
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# Edit .env: add SECRET_KEY and OPENROUTER_API_KEY

# 3. Build frontend
cd ../frontend
npm install
npm run build

# 4. Install systemd services
cd ..
./deploy/systemd/install.sh

# 5. Start
./start.sh
```

## Cloudflare tunnel

The tunnel (`cloudflared.service`) runs as a separate system service. It survives reboots independently of the application services.

```bash
# Check tunnel status
systemctl status cloudflared.service

# Restart tunnel
sudo systemctl restart cloudflared.service
```

The tunnel config is at `~/.cloudflared/config.yml`. Routing:
- `aegis-lite.jesseboudreau.com → http://127.0.0.1:3007`
- `aegis-lite-api.jesseboudreau.com → http://127.0.0.1:8107`
