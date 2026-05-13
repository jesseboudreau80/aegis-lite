# Media Assets

Screenshots and visual assets for README, social sharing, and documentation.

## Screenshot targets

| File | Page | When to capture |
|---|---|---|
| `landing.png` | `/` | After login → shows policy trace animation |
| `governed-chat.png` | `/chat` | Mid-stream response with governance trace visible |
| `governance-block.png` | `/chat` | After sending SSN pattern — shows red enforcement banner |
| `dashboard.png` | `/dashboard` | With activity feed populated (send a few chat requests first) |
| `agents.png` | `/agents` | HR Analyst agent selected, response visible |
| `audit.png` | `/governance/audit` | With 10+ rows and a detail panel open |
| `onboarding.png` | `/dashboard` | Onboarding guide visible (clear localStorage first) |

## How to capture screenshots for README

1. Start the local server: `./start.sh`
2. Login as `admin@example.com` / `demo`
3. Send 5–10 chat requests to populate the dashboard and audit log
4. Use browser devtools device emulation for consistent sizing:
   - Desktop: **1440 × 900** viewport
   - Use a dark OS theme
5. Capture at 2× for retina-quality exports
6. Save as PNG (max 2MB per image)
7. Commit to this directory

## Recommended capture tool

- macOS: `Cmd+Shift+5` → window capture
- Or use browser DevTools → "Capture screenshot" in the device toolbar
- For full-page: DevTools → More tools → Rendering → Capture full size screenshot

## Naming convention

```
.github/assets/
├── landing.png           # Public landing page hero
├── governed-chat.png     # Active streaming inference
├── governance-block.png  # Policy enforcement (wow moment)
├── dashboard.png         # Live governance control plane
├── agents.png            # Agent execution panel
├── audit.png             # Audit log explorer
└── onboarding.png        # First-use orientation guide
```

## OG image

The social sharing image is a static SVG at `frontend/public/og.svg`.
To generate a PNG version (required for some platforms):

```bash
# Using Inkscape (if installed)
inkscape --export-png=.github/assets/og.png --export-width=1200 frontend/public/og.svg

# Or use a browser: open og.svg, screenshot at 1200×630
```
