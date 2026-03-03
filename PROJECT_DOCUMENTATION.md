# LivePulse - Complete Project Documentation

## 1) Project Overview
LivePulse is a full-stack real-time sports match tracker.

It has:
- A React + Vite frontend for listing matches, viewing match details, and posting admin updates.
- An Express + Drizzle + Neon Postgres backend for REST APIs, validation, persistence, and WebSocket broadcasting.
- Real-time updates over WebSocket for:
  - new match creation (`match_created`)
  - per-match commentary updates (`commentary`)

Core product behaviors:
- Public users can view matches and commentary.
- Admin users can create matches and commentary using an API key.
- Match status is computed from start/end times (`scheduled`, `live`, `finished`).

---

## 2) High-Level Architecture

### Frontend
- React Router based SPA with routes:
  - `/` -> Home
  - `/matches/:id` -> MatchDetail
  - `/admin` -> Admin key lock screen
  - `/admin/panel` -> AdminPanel (guarded by local key check)
- Axios client for REST requests.
- WebSocket client module for subscription-based real-time updates.
- Tailwind CSS v4 via `@tailwindcss/vite` and `@import "tailwindcss"`.

### Backend
- Express server.
- REST resources:
  - `GET /matches`
  - `POST /matches` (admin key required)
  - `GET /matches/:id/commentary`
  - `POST /matches/:id/commentary` (admin key required)
- Drizzle ORM with Neon serverless Postgres driver.
- Zod request validation.
- Arcjet middleware for HTTP and WebSocket protection (optional if key missing).
- Native `ws` WebSocket server attached to same HTTP(S) server.

### Database
- PostgreSQL with two tables:
  - `matches`
  - `commentary`
- FK: `commentary.match_id -> matches.id` with cascade delete.

---

## 3) Runtime Data Flow

### Match creation flow
1. Admin UI posts `POST /matches` with `X-ADMIN-KEY`.
2. Backend validates payload, computes status from current time, writes DB record.
3. Backend broadcasts WebSocket event `{ type: "match_created", data: <match> }` to all clients.
4. Home page prepends the new match in real time.

### Commentary flow
1. Match detail page subscribes to its match id over WebSocket.
2. Admin UI posts `POST /matches/:id/commentary` with `X-ADMIN-KEY`.
3. Backend validates params/body and ensures the match exists.
4. Backend writes commentary row and broadcasts to subscribers of that match id.
5. Match detail page prepends incoming commentary entry in real time.

---

## 4) Tech Stack

### Frontend
- React 19
- React Router DOM 7
- Vite 7
- Axios
- Tailwind CSS 4 + `@tailwindcss/vite`
- ESLint 9 + React hooks/refresh plugins

### Backend
- Node.js (ESM)
- Express 5
- Drizzle ORM
- Drizzle Kit (migrations)
- Neon serverless Postgres client
- Zod
- ws
- Arcjet security/rate limiting
- CORS

### Tooling
- npm package-lock files for deterministic installs
- Drizzle SQL migrations + snapshots

---

## 5) Environment Variables

## Backend (`backend/.env` and `backend/.env.example`)
Variables used by code:
- `DATABASE_URL` (required): Postgres connection string.
- `PORT` (optional, default `8000`): server port.
- `HOST` (optional, default `0.0.0.0`): bind host.
- `HTTPS` (optional): `true`/`1` enables HTTPS server mode.
- `HTTPS_KEY_PATH` (required when HTTPS enabled): cert key path.
- `HTTPS_CERT_PATH` (required when HTTPS enabled): cert path.
- `FRONTEND_ORIGIN` (optional): comma-separated allowed CORS origins.
- `ADMIN_KEY` (required for admin-protected POST endpoints).
- `ARCJET_KEY` (optional): if absent, Arcjet is disabled.
- `ARCJET_MODE` (optional): `DRY_RUN` or defaults to `LIVE`.

Security note:
- `backend/.env` currently contains real secrets/keys in local workspace.
- Keep `.env` uncommitted (already ignored by `.gitignore`).

## Frontend (`frontend/.env`)
- `VITE_API_URL`: backend base URL.
- `VITE_WS_URL`: websocket URL.

---

## 6) API Contracts

### `GET /matches`
Query:
- `limit` optional, coerced to int, `1..100`, default 50.

Success:
- `200 { data: Match[] }`

Errors:
- `400` invalid query
- `500` internal error

### `POST /matches` (admin)
Headers:
- `X-ADMIN-KEY: <ADMIN_KEY>`

Body:
- `sport` string required
- `homeTeam` string required
- `awayTeam` string required
- `startTime` ISO datetime with timezone required
- `endTime` ISO datetime with timezone required and must be > `startTime`
- `homeScore` optional non-negative int (defaults to 0)
- `awayScore` optional non-negative int (defaults to 0)

Success:
- `201 { data: Match }`

Errors:
- `403` invalid admin key
- `400` invalid body
- `500` internal/server misconfigured

### `GET /matches/:id/commentary`
Params:
- `id` positive int

Query:
- `limit` optional, coerced to int, `1..100`, default 100

Success:
- `200 { data: Commentary[] }` (ordered newest first by `createdAt`)

Errors:
- `400` invalid params/query
- `500` internal error

### `POST /matches/:id/commentary` (admin)
Headers:
- `X-ADMIN-KEY: <ADMIN_KEY>`

Params:
- `id` positive int

Body:
- `minutes` non-negative int
- `sequence` non-negative int
- `period` string required
- `eventType` string required
- `actor` optional string
- `team` optional string
- `message` string required
- `metadata` optional object
- `tags` optional string[]

Success:
- `201 { data: Commentary }`

Errors:
- `403` invalid admin key
- `404` match not found
- `400` invalid payload
- `500` internal error

---

## 7) WebSocket Protocol

Server path:
- `/ws`

Client -> server messages:
- `{ "type": "subscribe", "matchId": <int> }`
- `{ "type": "unsubscribe", "matchId": <int> }`

Server -> client messages:
- `{ "type": "welcome" }`
- `{ "type": "subscribed", "matchId": <int> }`
- `{ "type": "unsubscribed", "matchId": <int> }`
- `{ "type": "match_created", "data": Match }` (to all clients)
- `{ "type": "commentary", "data": Commentary }` (to subscribers of a match)
- `{ "type": "error", "message": "Invalid JSON" }`

Operational details:
- 30s heartbeat with ping/pong; dead sockets are terminated.
- reconnect logic in frontend retries every 800ms after close.

---

## 8) Database Model

### Enum `match_status`
- `scheduled`
- `live`
- `finished`

### Table `matches`
- `id` serial PK
- `sport` text not null
- `home_team` text not null
- `away_team` text not null
- `status` enum not null default `scheduled`
- `start_time` timestamptz not null
- `end_time` timestamptz nullable
- `home_score` int not null default `0`
- `away_score` int not null default `0`
- `created_at` timestamptz not null default `now()`

### Table `commentary`
- `id` serial PK
- `match_id` int not null FK -> `matches.id` cascade delete
- `minutes` int not null
- `sequence` int not null
- `period` text not null
- `event_type` text not null
- `actor` text nullable
- `team` text nullable
- `message` text not null
- `metadata` jsonb nullable
- `tags` text[] nullable
- `created_at` timestamptz not null default `now()`

Migration note:
- Initial schema had `minute`; later migration renamed to `minutes`.
- Drizzle snapshot JSON still shows `minute` naming, while runtime schema code uses `minutes`.

---

## 9) Project Structure (excluding `node_modules`)

```text
LivePulse/
  PROJECT_DOCUMENTATION.md
  backend/
    .env
    .env.example
    .gitignore
    arcjet.js
    drizzle.config.js
    package.json
    package-lock.json
    drizzle/
      0000_blushing_synch.sql
      0001_rename_commentary_minute_to_minutes.sql
      0001_rename_commentary_minute_to_minutes.down.sql
      meta/
        _journal.json
        0000_snapshot.json
        0001_snapshot.json
    src/
      index.js
      db/
        db.js
        schema.js
      middleware/
        adminKey.js
      routes/
        matches.js
        commentary.js
      utils/
        match-status.js
      validation/
        matches.js
        commentary.js
      ws/
        server.js
  frontend/
    .env
    .gitignore
    README.md
    eslint.config.js
    index.html
    package.json
    package-lock.json
    vite.config.js
    public/
      vite.svg
    src/
      main.jsx
      App.jsx
      index.css
      assets/
        react.svg
      components/
        RequireAdmin.jsx
      lib/
        api.js
        ws.js
      pages/
        Home.jsx
        MatchDetail.jsx
        Admin.jsx
        AdminPanel.jsx
```

---

## 10) File-by-File Documentation

## Root

### `PROJECT_DOCUMENTATION.md`
- This file.
- Intended as a complete AI/human project context map.

## Backend

### `backend/package.json`
- Backend package manifest (`name: livepulse`, `type: module`).
- Scripts:
  - `predev`: kill port 8000 before dev run.
  - `dev`: `node --watch src/index.js`.
  - `dev:https`: same with `HTTPS=true` via `cross-env`.
  - `start`: run production-like server.
  - Drizzle scripts: `db:generate`, `db:migrate`, `db:studio`.
- Dependencies include Express, Drizzle, Neon, Arcjet, ws, Zod, CORS.

### `backend/package-lock.json`
- npm lockfile v3.
- Auto-generated dependency resolution graph (~2536 lines).
- Should not be manually edited.

### `backend/.gitignore`
- Standard Node ignore rules.
- Explicitly ignores `.env` and `.env.*`, while allowing `.env.example`.

### `backend/.env.example`
- Template for required backend environment configuration.
- Includes `DATABASE_URL` example and optional HTTPS cert fields.

### `backend/.env`
- Local runtime environment values for backend.
- Contains DB URL, server host/port, Arcjet config, CORS origin, and `ADMIN_KEY`.
- Sensitive; local-only.

### `backend/drizzle.config.js`
- Drizzle Kit config.
- Requires `DATABASE_URL` at load time.
- Points schema to `./src/db/schema.js` and migration output to `./drizzle`.

### `backend/arcjet.js`
- Arcjet setup for HTTP and WebSocket protection.
- Defines shared rules:
  - shield
  - bot detection (allows search engine/preview categories)
  - sliding-window rate limiting (HTTP less strict, WS stricter)
- Exports:
  - `httpArcjet`
  - `wsArcjet`
  - `securityMiddleware()` for Express.
- If `ARCJET_KEY` missing, protection is disabled and requests pass through.

### `backend/src/index.js`
- Main server bootstrap.
- Loads dotenv, Express, CORS, routes, Arcjet middleware.
- Supports HTTP or HTTPS server based on env.
- Mounts routes:
  - `/matches`
  - `/matches/:id/commentary`
- Attaches WebSocket server and stores broadcast functions in `app.locals`.
- Logs base HTTP and WS URLs on startup.

### `backend/src/db/db.js`
- Creates Neon `Pool` from `DATABASE_URL`.
- Exports Drizzle instance `db` and `pool`.
- Throws at startup if URL is missing.

### `backend/src/db/schema.js`
- Drizzle schema declarations.
- Defines `matchStatus` enum and `matches`/`commentary` tables.
- Uses `minutes` column in `commentary` table.

### `backend/src/middleware/adminKey.js`
- Express middleware `requireAdminKey`.
- Reads expected key from env `ADMIN_KEY` and request header `X-ADMIN-KEY`.
- Returns:
  - `500` if `ADMIN_KEY` missing on server.
  - `403` if missing/invalid provided key.
- Calls `next()` when valid.

### `backend/src/routes/matches.js`
- Match router for `/matches`.
- `GET /`:
  - validates `limit` query
  - returns latest matches sorted by `createdAt` descending
- `POST /` (admin protected):
  - validates body
  - computes status via `getMatchStatus`
  - inserts row with defaults
  - broadcasts `match_created` event via app local function

### `backend/src/routes/commentary.js`
- Commentary router with `mergeParams: true` for `:id` access.
- `GET /`:
  - validates match id and limit query
  - returns commentary for match sorted newest first
- `POST /` (admin protected):
  - validates match id + body
  - checks parent match existence
  - inserts commentary row
  - sends `201`
  - then attempts WS broadcast to match subscribers

### `backend/src/validation/matches.js`
- Zod contracts for match APIs.
- Defines `MATCH_STATUS` constants and ISO datetime checker with required timezone offset.
- Exports:
  - `listMatchesQuerySchema`
  - `matchIdParamSchema`
  - `createMatchSchema` (includes end > start rule)
  - `updateScoreSchema` (currently not used by route handlers)

### `backend/src/validation/commentary.js`
- Zod contracts for commentary APIs.
- Exports:
  - `listCommentaryQuerySchema`
  - `createCommentarySchema`

### `backend/src/utils/match-status.js`
- Utility functions for status calculation.
- `getMatchStatus(startTime, endTime, now?)`:
  - returns `scheduled`, `live`, `finished`, or `null` if dates invalid.
- `syncMatchStatus(match, updateStatus)`:
  - recomputes status and mutates `match.status` if changed.
  - helper exists but not wired into routes yet.

### `backend/src/ws/server.js`
- WebSocket server attachment and broadcasting logic.
- Maintains in-memory `Map<matchId, Set<socket>>` subscribers.
- Handles subscribe/unsubscribe commands.
- Implements ping/pong heartbeat cleanup.
- Integrates Arcjet protection on HTTP upgrade path.
- Exports `attachWebSocketServer(server)` returning:
  - `broadcastMatchCreated(match)` -> sends to all
  - `broadcastCommentary(matchId, comment)` -> sends to match subscribers

### `backend/drizzle/0000_blushing_synch.sql`
- Initial schema migration.
- Creates enum `match_status`, tables `matches` and `commentary`.
- Initial commentary column name is `minute`.

### `backend/drizzle/0001_rename_commentary_minute_to_minutes.sql`
- Forward-safe migration.
- Renames `commentary.minute` -> `commentary.minutes` if needed.

### `backend/drizzle/0001_rename_commentary_minute_to_minutes.down.sql`
- Down migration.
- Renames `commentary.minutes` -> `commentary.minute` if needed.

### `backend/drizzle/meta/_journal.json`
- Drizzle migration journal.
- Records applied migration tags and sequence metadata.

### `backend/drizzle/meta/0000_snapshot.json`
- Auto-generated schema snapshot for migration state 0000.
- Contains table/enum metadata for the original schema (`minute` column).

### `backend/drizzle/meta/0001_snapshot.json`
- Auto-generated schema snapshot for migration state 0001.
- Still reflects `minute` key in snapshot metadata, while migration renames to `minutes` in SQL.

## Frontend

### `frontend/package.json`
- Frontend package manifest (`type: module`, private app).
- Scripts:
  - `dev`, `build`, `lint`, `preview`
- Dependencies include React 19, Router, Axios, Tailwind v4 plugin.

### `frontend/package-lock.json`
- npm lockfile v3 for frontend dependencies (~3763 lines).
- Auto-generated; not manually edited.

### `frontend/.gitignore`
- Ignores build artifacts (`dist`), local files, and IDE/system files.
- Does not explicitly list `.env`, but `.env` exists locally.

### `frontend/.env`
- Frontend runtime env values exposed via Vite (`import.meta.env`).
- Defines API and WebSocket backend endpoints.

### `frontend/README.md`
- Default Vite React template readme.
- Not specific to LivePulse behavior.

### `frontend/eslint.config.js`
- Flat ESLint config for JS/JSX.
- Uses recommended JS + React hooks + React refresh configs.
- Rule override: unused vars error with ignore pattern for uppercase names.

### `frontend/vite.config.js`
- Vite config enabling plugins:
  - React plugin
  - Tailwind CSS Vite plugin

### `frontend/index.html`
- SPA host HTML.
- Mount point `#root` and script entry `/src/main.jsx`.

### `frontend/public/vite.svg`
- Static Vite logo asset from template.

### `frontend/src/assets/react.svg`
- Static React logo asset from template.

### `frontend/src/index.css`
- Global stylesheet entry.
- Imports Tailwind: `@import "tailwindcss";`.

### `frontend/src/main.jsx`
- Frontend entrypoint.
- Initializes global WS connection once with `ensureWSConnected()`.
- Wraps app with `BrowserRouter` and renders to `#root`.

### `frontend/src/App.jsx`
- Route composition for the entire SPA.
- Route map:
  - `/` -> `Home`
  - `/matches/:id` -> `MatchDetail`
  - `/admin` -> `Admin`
  - `/admin/panel` -> `RequireAdmin(AdminPanel)`
  - fallback `*` redirects to `/`

### `frontend/src/lib/api.js`
- Shared Axios instance using `VITE_API_URL` as `baseURL`.
- Exports `api` and `getErrorMessage(err)` helper for UI messages.

### `frontend/src/lib/ws.js`
- Shared singleton WebSocket client.
- Features:
  - connect and reconnect management
  - listener pub-sub (`onWSMessage`)
  - subscribe/unsubscribe helpers per match
  - generic send helper

### `frontend/src/components/RequireAdmin.jsx`
- Route guard component.
- Checks localStorage for `livepulse_admin_key`.
- Redirects to `/admin` when key missing.

### `frontend/src/pages/Home.jsx`
- Landing page listing matches.
- Fetches initial matches (`GET /matches?limit=50`).
- Subscribes to WS messages and prepends new matches on `match_created`.
- Cards link to `/matches/:id`.

### `frontend/src/pages/MatchDetail.jsx`
- Match details + live commentary page.
- Reads match id from URL.
- Fetches match by loading `/matches` then finding id client-side.
- Fetches commentary via `/matches/:id/commentary`.
- WS logic:
  - retries subscription until socket open
  - prepends incoming `commentary` events for current match
  - unsubscribes on cleanup

### `frontend/src/pages/Admin.jsx`
- Admin lock screen.
- Stores admin key in localStorage under `livepulse_admin_key`.
- Redirects to prior route (if guarded redirect origin exists) or `/admin/panel`.
- Supports clearing key.

### `frontend/src/pages/AdminPanel.jsx`
- Admin operations page.
- Features:
  - create match form -> `POST /matches`
  - commentary form -> `POST /matches/:id/commentary`
  - includes `X-ADMIN-KEY` from localStorage in headers
  - refreshes available matches for commentary target selection
  - lock button removes stored admin key and redirects to `/admin`

---

## 11) Commands and Local Development

From `backend/`:
- `npm install`
- `npm run dev` (HTTP)
- `npm run dev:https` (HTTPS; requires cert env vars)
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:studio`

From `frontend/`:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

Local default endpoints:
- Backend: `http://localhost:8000`
- Frontend (Vite): typically `http://localhost:5173`
- WebSocket: `ws://localhost:8000/ws`

---

## 12) Current Project Notes for AI Tools

1. Admin auth model is header key based, with key stored in browser localStorage.
2. No test suite exists yet (`backend` test script is placeholder).
3. Match detail fetch currently loads all matches and filters client-side (no `GET /matches/:id` endpoint yet).
4. WebSocket subscriptions are in-memory only; no cross-instance pub/sub (single-process assumption).
5. Arcjet is optional and bypassed if `ARCJET_KEY` is absent.
6. Tailwind is configured globally in `frontend/src/index.css`, not per-page CSS files.
7. `frontend/src/App.css` is not present in current file tree.

---

## 13) Recommended Reading Order (for Humans/AI)
1. `backend/src/index.js`
2. `backend/src/routes/matches.js`
3. `backend/src/routes/commentary.js`
4. `backend/src/ws/server.js`
5. `backend/src/db/schema.js`
6. `frontend/src/main.jsx`
7. `frontend/src/App.jsx`
8. `frontend/src/pages/Home.jsx`
9. `frontend/src/pages/MatchDetail.jsx`
10. `frontend/src/pages/AdminPanel.jsx`
11. `frontend/src/lib/ws.js`
12. `frontend/src/lib/api.js`

This order gives the fastest understanding of app flow, API contracts, and real-time behavior.
