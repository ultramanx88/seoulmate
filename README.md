<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# SEOULMATE

React application with a production migration stack for moving from Firebase to
PostgreSQL and Redis without requiring a big-bang cutover.

View your app in AI Studio: https://ai.studio/apps/554b0bce-d0ca-41ea-a58d-589a73ebfb99

## Current migration phase

Firebase remains active in the frontend while PostgreSQL and Redis are brought
online in parallel. Do not remove Firebase until data has been backfilled,
dual-write has been verified, and reads have been switched to the new API.

The PostgreSQL schema currently covers:

- users and Firebase identity mapping
- topics, likes, and comments
- chats, participants, and messages
- precomputed feeds
- idempotent Firebase migration tracking
- safety reports, user blocks, moderation actions, and admin sessions

## Run the frontend locally

Prerequisites: Node.js 22+

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Run the infrastructure locally

Copy `.env.example` to `.env` and replace both `change-me` passwords.

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Run the database migrations:

```bash
npm run db:migrate
```

Run the API with reload:

```bash
npm run dev:api
```

Readiness endpoints:

- `GET http://localhost:8080/health/live`
- `GET http://localhost:8080/health/ready`
- `GET http://localhost:8080/api/v1`

## Run the production-shaped stack

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:8080/health/ready
```

The application container:

- builds the Vite frontend and TypeScript API
- runs SQL migrations before accepting traffic
- serves the frontend and API on port 8080
- waits for healthy PostgreSQL and Redis services
- handles SIGTERM with graceful connection shutdown

PostgreSQL and Redis use persistent named volumes. Back these volumes up before
upgrading or destroying the stack.

## Database migrations

Migration files live in `server/migrations` and run in filename order. Applied
migrations are recorded in `schema_migrations` with a SHA-256 checksum. Never
edit an applied migration; add a new numbered migration instead.

Useful commands:

```bash
npm run lint
npm run build:all
npm run db:migrate
```

## Safety and Admin

The admin console is served at `/admin`. Bootstrap the first superadmin by
setting `ADMIN_SUPER_EMAIL` and `ADMIN_SUPER_PASSWORD` in the runtime
environment. The server hashes the password with Node crypto before storing it;
do not commit real admin credentials.

The safety layer includes:

- admin login/session cookies separate from user sessions
- report queues for users, topics, comments, and messages
- user block/unblock APIs that remove blocked users from discovery and chats
- user safety states: active, suspended, banned, deleted
- content moderation states: visible, hidden, removed
- moderation action audit records

## Recommended Firebase cutover order

1. Export and backfill Firebase users and Firestore documents.
2. Verify record counts and migration hashes.
3. Add authenticated API endpoints and dual-write mutations.
4. Move profile and feed reads to PostgreSQL.
5. Move chat realtime delivery to Redis pub/sub plus WebSocket.
6. Run reconciliation and disable Firebase writes.
7. Remove Firebase client, Cloud Functions, rules, and configuration.

The `firebase_migration_records` table exists so import jobs can be rerun
idempotently and reconciled before cutover.

## Firebase backfill

The importer uses Google Application Default Credentials. Set
`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PROJECT_ID`,
`FIRESTORE_DATABASE_ID`, and `DATABASE_URL`.

Always begin with the default dry-run:

```bash
MIGRATION_DRY_RUN=true npm run firebase:backfill
```

After reviewing the counts, enable writes:

```bash
MIGRATION_DRY_RUN=false npm run firebase:backfill
```

The command imports Firebase Auth users first, then profiles, topics, comments,
chats, messages, and precomputed feeds. It upserts existing rows and records a
source hash for reconciliation.
