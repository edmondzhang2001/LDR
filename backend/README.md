# Duva Backend

Node.js/Express API for the Duva long-distance relationship app.

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, and optionally AWS credentials for S3.
2. Ensure MongoDB is running.
3. `npm install` (already done if you ran workspace setup).
4. `npm run dev` — server runs with file watching. Or `npm start` for production.

## API

- **Auth:** `POST /api/auth/oauth` (body: `identityToken`, `provider` — `"apple"` or `"google"`). Verifies the token with the provider, finds or creates the user, returns `{ token, user }`.
- **Pairing:** `POST /api/couple/pair/generate` (auth) → returns 6-digit code; `POST /api/couple/pair/join` (auth, body: `code`) → link accounts.
- **Upload:** `POST /api/upload/presigned-url` (auth, body: `filename`, `contentType`) → returns presigned PUT URL and `key`.

Protected routes use header: `Authorization: Bearer <token>`.

## Rate limiting

All `/api/*` routes are rate-limited by IP (webhooks are excluded). Optional env vars:

- `RATE_LIMIT_MAX` — general API limit per 15 min (default: 200)
- `RATE_LIMIT_AUTH_MAX` — sign-in (OAuth/Apple) attempts per 15 min (default: 15)
- `RATE_LIMIT_PAIRING_MAX` — pair generate/join attempts per 15 min (default: 20)

When exceeded, the API responds with `429 Too Many Requests`.
