# Data Access Policy

SEOULMATE uses three data lanes. Pick the lane by risk, not by habit.

## 1. App DB / query-builder lane

Use `server/data/app-db.ts` and repositories for normal product and back-office data:

- users
- tenants
- settings
- billing metadata
- permissions
- OAuth sessions and non-critical account state

This lane favors maintainability, clear TypeScript row types, and centralized schema mapping.
Repository functions should return typed rows or DTOs from `server/data/schema.ts`.

## 2. Raw SQL / native driver lane

Use `server/data/raw-sql.ts` for anything where correctness and query control matter more than convenience:

- transaction ledgers
- inventory movement
- financial reports
- reconciliation
- explicit row locking
- custom isolation levels
- complex report plans where index strategy must be obvious

Keep SQL explicit in this lane. Do not hide locking, isolation, or multi-statement transaction behavior behind generic CRUD helpers.

## 3. Read model / cache / analytics lane

Use `server/data/read-model.ts` for read-heavy, eventually consistent projections:

- dashboard cache
- search results
- report snapshots
- event analytics projections
- Redis cache and future materialized views / OpenSearch / ClickHouse / BigQuery adapters

The write model remains PostgreSQL. Read models can be rebuilt and invalidated.

## Rule of Thumb

If losing a transaction or locking detail can cost money, stock, or auditability, use raw SQL.
If the code is normal account/product state, use the app DB/repository lane.
