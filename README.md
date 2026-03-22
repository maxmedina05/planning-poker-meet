# Planning Poker — Google Meet Add-on

A lightweight Planning Poker add-on for Google Meet. Participants vote on story
points directly from the side panel during standups, without leaving the call.

## Cards

`0` `1` `2` `3` `5` `8` `13` `21` `?` `☕`

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Scaffold — manifest, SDK wiring, empty entry points | ✅ Done |
| 2 | Voting UI — card grid, select, confirm | 🔜 Next |
| 3 | Real-time sync + reveal | ⬜ Pending |
| 4 | Host controls + polish | ⬜ Pending |

## Project Structure

```
planning-poker/
├── deployment.json          # Add-on manifest — submit to Google Cloud Console
├── sidepanel/
│   ├── index.html           # Side panel entry point (sidePanelUrl)
│   ├── app.js               # SDK init + voting logic
│   └── style.css            # Panel styles
├── mainstage/
│   ├── index.html           # Main stage (opened on startActivity)
│   ├── app.js               # SDK init + results display
│   └── style.css            # Results / reveal styles
├── assets/
│   └── logo.png             # Add-on logo (48×48px minimum, must be public)
└── docs/
    ├── architecture.md      # Technical decisions + SDK reference
    ├── phase1-checklist.md  # Deploy steps for Phase 1
    └── ux-sketches.md       # UX layouts and interaction notes
```

## Quick Start

See [`docs/phase1-checklist.md`](docs/phase1-checklist.md) for step-by-step
deployment instructions.

## Hosting

Served via **GitHub Pages** from the `main` branch root.
- Repo: https://github.com/maxmedina05/planning-poker-meet
- Public URL: `https://maxmedina05.github.io/planning-poker-meet`

Still needs updating in:
- `sidepanel/app.js` — `CLOUD_PROJECT_NUMBER`
- `mainstage/app.js` — `CLOUD_PROJECT_NUMBER`
