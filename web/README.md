# RescueReady web

Responsive React + TypeScript demo for a calm, voice-first household preparedness coach.

## Run

```bash
npm install
npm run dev
```

The Vite development server runs at `http://localhost:5173`. It proxies `/api` and `/health` to `VITE_API_TARGET`, defaulting to `http://localhost:8787`.

```bash
npm run test
npm run build
```

## Backend integration

The UI progressively enhances itself when the RescueReady API is available:

- `GET /health`
- `GET /api/v1/household`
- `GET /api/v1/readiness`
- `POST /api/v1/coach/chat` with `{ householdId, message }`
- `POST /api/v1/drills` with `{ householdId, scenario }`

If the API is unavailable or a request times out, the app switches to an in-browser demo coach and keeps all interactions usable. Supply state is saved in local storage.
