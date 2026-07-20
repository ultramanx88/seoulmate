<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# SEOULMATE

React application with Clerk user authentication, PostgreSQL, Redis, Stripe-ready
entitlements, and a Safety/Admin layer for a trustworthy Thai-Korean dating
product.

View your app in AI Studio: https://ai.studio/apps/554b0bce-d0ca-41ea-a58d-589a73ebfb99

## Current architecture

The PostgreSQL schema currently covers:

- users and Clerk identity mapping
- topics, likes, and comments
- chats, participants, and messages
- precomputed feeds
- safety reports, user blocks, moderation actions, and admin sessions

User authentication is handled by Clerk. Configure Google, LINE, Kakao, and
Naver in the Clerk dashboard instead of storing provider secrets in this
service. The Express API verifies Clerk session tokens and upserts local users
with `auth_provider = clerk`.

## Run the frontend locally

Prerequisites: Node.js 22+

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill `VITE_CLERK_PUBLISHABLE_KEY`,
   `CLERK_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, and `GEMINI_API_KEY`
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

- admin login/session cookies separate from Clerk user sessions
- report queues for users, topics, comments, and messages
- user block/unblock APIs that remove blocked users from discovery and chats
- user safety states: active, suspended, banned, deleted
- content moderation states: visible, hidden, removed
- moderation action audit records

## Plans and Entitlements

SEOULMATE is Stripe-ready without requiring Stripe at launch. Users have a
simple `free` or `pro` plan, and backend usage counters enforce limits before
paid checkout is connected.

Current gated features:

- daily posts
- daily discovery views
- daily new chats
- AI translation usage

The data model is ready for a later Stripe integration:

- `subscriptions`
- `subscription_events`
- `usage_counters`

Stripe webhooks should update `subscriptions` and `users.plan`; product code
should continue checking entitlements rather than reading payment-provider
state directly.
