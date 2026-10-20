# SmartPosture Backend Server

Backend for **SmartPosture**, a wearable posture monitor built on an **ESP32 + MPU6050**.
The wearable classifies posture locally and vibrates when the posture is incorrect; the
Flutter app shows live data, alerts, statistics and history. This server ingests the
telemetry, stores it in MongoDB, and exposes the REST APIs the mobile app consumes.

> **Prototype, no authentication.** There is intentionally **no login, no registration,
> no JWT and no user accounts**. The server is meant to run on a trusted local Wi-Fi
> network and is **not safe to expose to the public Internet**. See
> [Security and prototype limitations](#security-and-prototype-limitations).

---

## Table of contents

- [What this server does](#what-this-server-does)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [MongoDB setup](#mongodb-setup)
- [Network configuration and addressing](#network-configuration-and-addressing)
- [npm scripts](#npm-scripts)
- [API overview](#api-overview)
- [Telemetry retry strategy](#telemetry-retry-strategy)
- [Real-time updates (Socket.IO, optional)](#real-time-updates-socketio-optional)
- [AI recommendations (Gemini, optional)](#ai-recommendations-gemini-optional)
- [Testing](#testing)
- [Security and prototype limitations](#security-and-prototype-limitations)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## What this server does

| Capability | Description |
| --- | --- |
| Telemetry ingestion | `POST /api/v1/telemetry` stores validated ESP32 samples (idempotent). |
| Device management | Online/offline status, last seen, latest posture, battery, heartbeat. |
| Dashboard | Current posture + day/week/month statistics derived from real stored data. |
| History | Paginated, sortable, filterable telemetry records. |
| Sessions | Monitoring sessions with correctly computed durations and statistics. |
| Events | Incorrect posture, vibration, disconnect/reconnect, low battery, sensor error. |
| Live updates | Optional Socket.IO broadcasts (`posture:update`, `device:status`, `posture:alert`). |
| AI recommendations | Optional Gemini-generated ergonomics tips from aggregated statistics. |

The backend **never** drives the vibration motor. Motor control and posture
classification stay on the ESP32, so the wearable keeps working when the server or
phone is offline.

## Architecture

```
ESP32 + MPU6050  --(Wi-Fi / HTTP)-->  Node.js REST API  -->  MongoDB
Flutter app      --(Wi-Fi / HTTP)-->  Node.js REST API  -->  MongoDB

optional:  ESP32 --> REST API --> Socket.IO --> Flutter
```

Layered (`routes -> controller -> service -> model`) with shared Zod validation
middleware, so validation, persistence and socket payloads never drift apart.

## Requirements

- **Node.js 20+** (see `engines` in `package.json`)
- **MongoDB 6+** (local instance, Docker, or a remote URI)
- npm 10+
- Optional: an ESP32 + MPU6050 and/or a Flutter device on the same Wi-Fi network

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
#    (Windows)  copy .env.example .env
#    (Linux/macOS)  cp .env.example .env

# 3. Make sure MongoDB is running (see the next section)

# 4. Start in development mode (auto-reload)
npm run dev

# 5. Verify
#    http://localhost:3000/health
#    http://localhost:3000/docs      (Swagger UI)
#    http://localhost:3000/openapi.json
```

Production:

```bash
npm run build     # compile TypeScript to dist/
npm start         # run the compiled server
```

The server listens on `HOST=0.0.0.0` and `PORT=3000` by default, so it is reachable
from the ESP32, the Android emulator and phones on the same Wi-Fi network.

## MongoDB setup

The server connects to `MONGODB_URI` (default `mongodb://127.0.0.1:27017/smartposture`).
Collections and indexes are created automatically on first use.

**Option A - local install**

- macOS (Homebrew): `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
- Ubuntu/Debian: follow the official MongoDB install guide, then `sudo systemctl enable --now mongod`
- Windows: install MongoDB Community Server as a Windows Service (the installer does this by default)

**Option B - Docker (no local install)**

```bash
docker run -d --name smartposture-mongo -p 27017:27017 -v smartposture-data:/data/db mongo:7
```

**Option C - remote / Atlas**

Set `MONGODB_URI` to the connection string, for example
`MONGODB_URI=mongodb+srv://user:pass@cluster/smartposture`.

Verify the connection:

```bash
curl http://localhost:3000/health
# {"status":"ok","database":"connected","timestamp":"..."}
```

If MongoDB is down the server still starts and `/health` answers
`{"status":"degraded","database":"disconnected", ...}` instead of crashing.

## Network configuration and addressing

`HOST=0.0.0.0` binds the server to **every** network interface, which is what allows
the ESP32, the emulator and phones to reach it. Choosing the right address on the
client side is the most common source of confusion:

| Client | Address to use | Why |
| --- | --- | --- |
| Browser / tooling on the **same computer** as the server | `http://localhost:3000` | Loopback, never leaves the machine. |
| **Android Emulator** (standard AVD) | `http://10.0.2.2:3000` | `10.0.2.2` is the emulator's alias for the host computer's `127.0.0.1`. |
| **Physical phone / tablet** on the same Wi-Fi | `http://<computer-LAN-IP>:3000` (e.g. `http://192.168.1.24:3000`) | The device must reach the host over the LAN. |
| **ESP32** | `http://<computer-LAN-IP>:3000` | Same as above. |
| The ESP32's **own** IP (e.g. `192.168.1.57`) | **not** a backend address | That is the device's address; the server never connects to it. |

> `localhost` on the phone/ESP32 would point to the phone/ESP32 itself, which is why
> it must be replaced with `10.0.2.2` (emulator) or the computer's LAN IPv4 (physical
> device).

**Find the computer's LAN IPv4 address**

Windows (PowerShell / cmd):

```powershell
ipconfig
# Look for "IPv4 Address" under the active Wi-Fi / Ethernet adapter,
# e.g. 192.168.1.24
```

Linux:

```bash
ip -4 addr show          # look for the inet line on wlan0 / eth0
hostname -I              # prints all non-loopback IPv4 addresses
```

macOS:

```bash
ipconfig getifaddr en0
```

Also make sure:
- The OS firewall allows inbound TCP on `PORT` (3000) from the local network.
- The computer and the devices are on the **same** Wi-Fi network / subnet.

**CORS** is configured with `CORS_ORIGINS`:

- `*` (default) reflects any origin - convenient for local development only.
- An explicit allowlist, e.g. `CORS_ORIGINS=http://localhost:3000,http://10.0.2.2:3000`.

CORS controls browser behaviour only. It does **not** authenticate or protect the API.

## npm scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `tsx watch src/server.ts` | Development server with auto-reload. |
| `npm run build` | `tsc -p tsconfig.build.json` | Compile to `dist/` (excludes tests). |
| `npm start` | `node dist/server.js` | Run the compiled server. |
| `npm run lint` | `eslint .` | Lint the source. |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` | Type-check without emitting. |
| `npm test` | `vitest run` | Run the automated test suite. |
| `npm run test:watch` | `vitest` | Run tests in watch mode. |

## API overview

Interactive docs: **`GET /docs`** (Swagger UI) and **`GET /openapi.json`** (raw spec).
Set `SWAGGER_ENABLED=false` to disable both.

Every JSON response uses one of two envelopes:

```json
{ "success": true,  "message": "OK", "data": { } }
{ "success": false, "message": "...", "error": { "code": "VALIDATION_ERROR", "details": { } } }
```

### Health

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Always `200`; `status: "ok" \| "degraded"` with the **real** database state. |

### Telemetry

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/telemetry` | `201` on store, `200` on an idempotent retry, `400` on invalid data. |

### Devices

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/devices` | All known devices with computed online/offline status. |
| GET | `/api/v1/devices/:deviceId` | One device snapshot. |
| GET | `/api/v1/devices/:deviceId/status` | Status + `offlineTimeoutSeconds` / `heartbeatIntervalSeconds`. |
| POST | `/api/v1/devices/:deviceId/heartbeat` | Records contact; detects reconnect. |

### Dashboard

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/dashboard` | Current posture + day summary in one call. |
| GET | `/api/v1/dashboard/current` | Latest posture, angle, confidence, battery, device status. |
| GET | `/api/v1/dashboard/summary?period=day \| week \| month` | Aggregated statistics and trends. |

### History and sessions

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/history` | `page`, `limit`, `sort`, `deviceId`, `posture`, `alert`, `from`, `to`. |
| GET | `/api/v1/history/:id` | One telemetry record. |
| GET | `/api/v1/sessions` | `page`, `limit`, `sort`, `deviceId`, `status`, `from`, `to`. |
| POST | `/api/v1/sessions` | Starts a session (`201`); returns the active one (`200`) if it exists. |
| GET | `/api/v1/sessions/:id` | Session with live statistics while active. |
| PATCH | `/api/v1/sessions/:id/end` | Ends the session and freezes the statistics. |

### Events

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/events` | `page`, `limit`, `sort`, `deviceId`, `type`, `severity`, `sessionId`, `from`, `to`. |
| GET | `/api/v1/events/:id` | One event. |
| POST | `/api/v1/events` | Stores an event; duplicate `dedupeKey` returns `200` with the original id. |

### AI

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/ai/recommendations` | `{ period, deviceId?, refresh? }`; cached per statistics snapshot. |
| GET | `/api/v1/ai/recommendations/latest?period=&deviceId=` | Most recent successful recommendation. |

### How durations are computed

Statistics are **derived from real timestamps**, never by assuming one sample equals
one second:

- The time between two consecutive samples is attributed to the posture active during
  that delta.
- A gap larger than `SESSION_MAX_GAP_SECONDS` (default 5s) is discarded, so the device
  being offline does not inflate "good posture" time.
- `GOOD_POSTURE` counts as good; `UNKNOWN` is excluded from both buckets; every other
  label counts as incorrect.
- One incorrect-posture **event** is recorded per continuous bad run, not per sample.

If a period has no data, the dashboard returns zeroed values, an empty distribution
and an explanatory `message` - it never fabricates numbers to look full.

## Telemetry retry strategy

`POST /api/v1/telemetry` is **idempotent**. The server derives a `dedupeKey` of
`deviceId + timestamp + posture label + alert flag` and enforces it with a unique
MongoDB index:

- **First delivery** -> `201 Created` with `{ id, duplicate: false, sessionId, events }`.
- **Retry of the same occurrence** -> `200 OK` with `{ id: <same id>, duplicate: true }`.
  Nothing is stored twice.

Recommended ESP32 behaviour:

1. Send each sample with its own `timestamp`.
2. On HTTP `2xx`, consider it delivered and continue.
3. On timeout / connection error / `5xx`, keep a small buffer and retry later with the
   **same** timestamp and payload - the dedupe key makes the retry safe. A `5xx` must
   not be treated as success.
4. A `4xx` means the payload is invalid; do not retry it unchanged.

If the device omits `timestamp`, the server fills in the receive time. Retries of a
timestamp-less payload therefore cannot be deduplicated, which is why the ESP32 is
expected to send its own timestamp.

## Real-time updates (Socket.IO, optional)

Socket.IO provides live updates for Flutter. It is entirely optional: REST keeps
working with no client connected, and ingestion never fails because a broadcast did.

Events broadcast to every connected client:

| Event | When |
| --- | --- |
| `posture:update` | Every stored telemetry sample. |
| `device:status` | Device comes back online. |
| `posture:alert` | An alert flag rose or the posture became incorrect. |

> Authentication is disabled by design for this prototype. Socket.IO rooms and
> `deviceId` values are **not** a security boundary - do not rely on them for access
> control.

## AI recommendations (Gemini, optional)

Set `GEMINI_API_KEY` to enable AI recommendations; leave it empty to run fully offline.

- The key is read **only** on the backend and is never returned to Flutter or the ESP32.
- Only **aggregated statistics** are sent to Gemini - never the raw telemetry stream.
- The response is validated against a strict schema before being stored or returned.
- Identical statistics reuse a cached recommendation (SHA-256 cache key + TTL index).
- Failures degrade gracefully with explicit error codes:
  - `503 GEMINI_NOT_CONFIGURED` - no API key configured.
  - `503 GEMINI_RATE_LIMITED` - provider quota/rate limit.
  - `503 GEMINI_UNAUTHORIZED` - provider rejected the key.
  - `504 GATEWAY_TIMEOUT` - provider did not answer within `GEMINI_TIMEOUT_MS`.
  - `502 BAD_GATEWAY` - empty/malformed/unexpected model response.
  - `400 NO_POSTURE_DATA` - nothing to analyse for the requested period.

Recommendations are general ergonomics tips. They are **not** a medical diagnosis or
treatment, and every response carries a disclaimer.

## Testing

```bash
npm test          # run once
npm run test:watch
```

- Vitest + Supertest.
- Each test file runs against an **isolated in-memory MongoDB**
  (`mongodb-memory-server`); the real `MONGODB_URI` is never used, so **production data
  is never read, modified or deleted**.
- Covered: health (ok + degraded + 404), telemetry validation and ingestion, invalid
  posture labels, missing fields, device status online/offline, dashboard empty state
  and real aggregation, history pagination/sorting/filtering, session creation and
  closure with correct durations, duplicate-event prevention, and AI failure handling.

The first `npm test` run may download the MongoDB binary used by the in-memory server.

## Security and prototype limitations

This prototype intentionally has **no authentication**. In place of auth it applies:

- Strict Zod validation on every request body, query, and path parameter.
- Request body size limits (`REQUEST_BODY_LIMIT`, default `256kb`).
- Global and per-route rate limiting.
- Configurable CORS allowlist.
- No secrets in source; the Gemini key stays on the backend.
- Schema-based, parameterized database access (no string-built queries).
- Safe logging: authorization/cookie headers are redacted, stack traces are hidden in
  production responses.

> An unauthenticated HTTP server is appropriate **only** for controlled prototype
> testing on a trusted network. Do **not** expose it to the public Internet or to
> untrusted Wi-Fi. CORS and a random `deviceId` do **not** authenticate a client.

## Project structure

```
src/
  app.ts                     # Express app factory (no side effects)
  server.ts                  # bootstrap, listen, graceful shutdown
  config/                    # env validation, database, CORS, Swagger
  middleware/                # error, validate, rate-limit
  modules/
    devices/                 # model, routes, controller, service, sweeper
    telemetry/               # model, routes, service, validation
    dashboard/  history/  sessions/  events/  ai/  health/
  sockets/socket.server.ts   # optional Socket.IO emitter layer
  shared/domain.ts           # posture labels, event types, severities
  utils/                     # logger, errors, pagination, stats, validation
  tests/                     # Vitest suites + in-memory DB helpers
examples/
  esp32/smartposture_esp32.ino   # ESP32 HTTP client example
  flutter/lib/smartposture_api.dart  # Flutter Dio client example
```

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `/health` shows `degraded` / `disconnected` | MongoDB is not running or `MONGODB_URI` is wrong. |
| Phone can't reach the API | Use the computer's LAN IPv4, not `localhost`; check firewall and that both are on the same Wi-Fi. |
| Emulator can't reach the API | Use `http://10.0.2.2:3000`, not `localhost`. |
| `400 VALIDATION_ERROR` | Read `error.details.issues[]` - each entry names the offending field. |
| `503 GEMINI_NOT_CONFIGURED` | Set `GEMINI_API_KEY` in `.env` to enable AI recommendations. |
| Telemetry stored twice | The device changed `timestamp`/label/alert between retries; retries must replay the exact same payload. |
