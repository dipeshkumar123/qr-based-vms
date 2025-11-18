# II-VMS MVP

This repository bootstraps the minimum viable product for the Intelligent, Integrated Visitor Management System (II-VMS). It focuses on the week 1–3 deliverables in the project roadmap: visitor registration, QR issuance, and an admin view backed by PostgreSQL.

## Architecture

```
frontend (React + Vite) ──HTTP──► backend (Express + TypeScript) ──SQL──► PostgreSQL
                                            │
                                            └── in-memory audit ledger hashes
```

* **Frontend** (`frontend/`): visitor registration form, QR preview, visitor table with admin actions, and ledger viewer.
* **Backend** (`backend/`): REST API for visitor CRUD, QR token generation, status updates, and ledger hashing placeholder.
* **Database**: PostgreSQL schema for `visitors` and `audit_ledger` tables (later phases can plug in verification logs, etc.).

## Prerequisites

* Node.js 20+
* pnpm, npm, or yarn (examples below use npm)
* Docker Desktop (for the bundled PostgreSQL service)

## Getting Started

1. **Clone dependencies and install packages**
   ```powershell
   cd d:\Projects\QR_Based_VMS
   npm install --prefix backend
   npm install --prefix frontend
   ```

2. **Launch PostgreSQL**
   ```powershell
   docker compose up -d
   ```
   *The compose file seeds the `visitors` and `audit_ledger` tables automatically.*

3. **Configure environment variables**
   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```
   Adjust `DATABASE_URL` if you are not using the bundled Docker service.

4. **Run the backend**
   ```powershell
   npm run dev --prefix backend
   ```
   The API listens on `http://localhost:4000`.

5. **Run the frontend**
   ```powershell
   npm run dev --prefix frontend
   ```
   Vite serves the UI on `http://localhost:5173`. API calls are proxied to the backend.

## Available API routes

| Method | Path                           | Description                          |
|-------|--------------------------------|--------------------------------------|
| POST  | `/api/visitors`                | Register a visitor & mint QR token   |
| GET   | `/api/visitors`                | List visitors (newest first)         |
| GET   | `/api/visitors/:token`         | Fetch visitor by QR token            |
| POST  | `/api/visitors/:token/check-in`| Mark visitor as checked-in           |
| DELETE| `/api/visitors/:id`            | Remove a visitor record (admin)      |
| GET   | `/api/ledger`                  | Inspect in-memory hash ledger        |

## Admin console capabilities

* **Check-in**: mark a visitor as arrived directly from the table.
* **Delete**: remove erroneous or cancelled visits.
* **Export CSV**: download the current visitor snapshot for compliance or reporting.
* **Ledger viewer**: browse the SHA-256 ledger hashes to validate tamper resistance (updates every 30 seconds or on demand).

## Next steps from the roadmap

1. **Phase 2 biometrics**: create a Python FastAPI microservice for face matching and wire routing from Express.
2. **Immutable storage**: persist ledger hashes into `audit_ledger` and add tamper detection jobs.
3. **Dashboards & analytics**: add secured admin authentication, charts, and CSV export.
4. **Alerts**: integrate email/SMS notifications for important events (failed verification, repeated visits, etc.).

## Testing checklist

- [ ] Submit a visitor via the form. Confirm QR appears and record shows in the table.
- [ ] Copy the QR token and call `POST /api/visitors/{token}/check-in` (via UI or REST client). Status updates to `checked_in`.
- [ ] Verify ledger endpoint returns SHA-256 hashes for create/check-in events.
- [ ] Restart backend to confirm ledger resets (expected for MVP; upgrade in later phase).

This scaffold keeps the MVP focused, while leaving clear extension points for the biometric, ledger hardening, and analytics phases described in `project-detail.md`.
