# LDR Backend

Node.js/Express API for the LDR long-distance relationship app.

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
