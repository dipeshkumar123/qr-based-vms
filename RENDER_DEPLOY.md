# Render Production Deployment Guide

## Architecture
- **Frontend**: Vercel
- **Backend**: Render Web Service (Node.js/Express)
- **Database**: Render PostgreSQL
- **Biometrics**: Render Web Service (Python FastAPI)
- **Analytics**: Render Web Service (Python FastAPI)

## Prerequisites
- Render account (https://render.com)
- GitHub repository connected to Render
- Vercel account for frontend deployment

---

## Step 1: Create PostgreSQL Database

1. Render Dashboard → **"+ New"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `ii-vms-db`
   - **Database**: `ii_vms`
   - **User**: `postgres`
   - **Plan**: Free
3. Click **"Create Database"**
4. Copy **Internal Database URL** (starts with `postgresql://`) — you'll need this for Step 2

---

## Step 2: Deploy Backend Service

Render Blueprint mode is recommended (automated):

1. Render Dashboard → **"+ New"** → **"Blueprint"**
2. Connect your GitHub repository
3. Select the repo: `dipeshkumar123/qr-based-vms`
4. Render will read `backend/render.yaml` and show:
   - Web Service: `ii-vms-backend`
   - Database: `ii-vms-db`
5. Click **"Apply"**
6. Wait for build to complete (~5 minutes)

### Important: Render detects the root `Dockerfile` by default
The root `Dockerfile` is a **monolithic build** (Postgres + backend + frontend + biometrics in one container). For Render we deploy each service separately. The root Dockerfile has been renamed to `Dockerfile.monolith.old` so Render doesn't pick it up. The correct Dockerfile is at `backend/Dockerfile`.

### Manual Alternative (if Blueprint doesn't work)
1. Render Dashboard → **"+ New"** → **"Web Service"**
2. Connect GitHub → Select repo
3. **Name**: `ii-vms-backend`
4. **Root Directory**: **Leave blank** (not `backend/`)
5. **Runtime**: **Docker**
6. **Dockerfile Path**: `backend/Dockerfile`
7. **Plan**: Free
8. Add environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=<from Step 1>`
   - `PORT=4000`
   - `CORS_ORIGIN=https://your-frontend.vercel.app`
   - `ADMIN_API_KEY=<32-char-random-key>`
   - `ADMIN_JWT_SECRET=<32-char-random-key>`
   - `ADMIN_JWT_EXPIRES_IN=2h`
   - `SERVICE_API_KEY=<32-char-random-key>`
   - `BIOMETRIC_SERVICE_URL=https://ii-vms-biometrics.onrender.com`
   - `ANALYTICS_SERVICE_URL=https://ii-vms-analytics.onrender.com`
   - `UPLOAD_DIR=/tmp/uploads`
   - `LOG_LEVEL=info`
9. Click **"Create Web Service"**

---

## Step 3: Run Database Migrations

1. In Render Dashboard, go to `ii-vms-backend` service
2. Click **"Shell"** tab (or use Render's Exec)
3. Run:
   ```bash
   npm run migrate
   ```

---

## Step 4: Deploy Biometric Service

1. Render Dashboard → **"+ New"** → **"Web Service"**
2. Connect GitHub → Select repo
3. **Name**: `ii-vms-biometrics`
4. **Root Directory**: **Leave blank**
5. **Runtime**: Docker
6. **Dockerfile Path**: `biometrics/Dockerfile`
7. **Plan**: Free
8. Environment variables:
   - `PORT=8000`
   - `STORAGE_DIR=/var/data`
   - `FACE_MATCH_TOLERANCE=0.6`
   - `CONFIDENCE_THRESHOLD=0.70`
   - `BACKEND_URL=https://ii-vms-backend.onrender.com`
   - `SERVICE_API_KEY=<same-as-backend>`
9. Click **"Create Web Service"**

---

## Step 5: Deploy Analytics Service

1. Render Dashboard → **"+ New"** → **"Web Service"**
2. Connect GitHub → Select repo
3. **Name**: `ii-vms-analytics`
4. **Root Directory**: **Leave blank**
5. **Runtime**: Docker
6. **Dockerfile Path**: `biometrics/Dockerfile.analytics`
7. **Plan**: Free
8. Environment variables:
   - `PORT=8001`
   - PostgreSQL connection vars from Step 1
   - `SERVICE_API_KEY=<same-as-backend>`
9. Click **"Create Web Service"**

---

## Step 6: Deploy Frontend to Vercel

1. Go to https://vercel.com → Import GitHub repo
2. **Root Directory**: `frontend`
3. **Environment Variable**: `VITE_API_BASE_URL=https://ii-vms-backend.onrender.com`
4. **Deploy**
5. The `vercel.json` in `frontend/` already proxies `/api/*` and `/uploads/*` to Render backend

---

## Step 7: Verify Everything

| Endpoint | Expected |
|----------|----------|
| `https://ii-vms-backend.onrender.com/health` | `{"status":"ok"}` |
| `https://ii-vms-backend.onrender.com/api/visitors` (POST) | 201 Created with QR token |
| `https://ii-vms-biometrics.onrender.com/health` | 200 OK |
| `https://ii-vms-analytics.onrender.com/health` | 200 OK |
| `https://your-frontend.vercel.app` | II-VMS landing page loads |

---

## Troubleshooting Render Build Failures

### Error: `"/biometric-service" not found` or `"/docker" not found`
**Cause**: The root `Dockerfile` is a monolithic build file that references directories (`biometric-service/`, `docker/`) that don't exist in the repository. Render may pick it up as the default Dockerfile.

**Fix** (already done):
- Root `Dockerfile` has been renamed to `Dockerfile.monolith.old`
- Ensure Render is using `backend/Dockerfile` (not root `Dockerfile`)

If using **Blueprint** (`backend/render.yaml`), Render should use the correct Dockerfile. If using **Manual Web Service**, set:
- **Dockerfile Path**: `backend/Dockerfile`
- Leave **Root Directory** blank

## Files Created for Render

| File | Purpose |
|------|---------|
| `backend/render.yaml` | Blueprint config for automated backend + PostgreSQL |
| `RENDER_DEPLOY.md` | This guide |
| `frontend/vercel.json` | Pre-configured to proxy API to Render |
| `Dockerfile.monolith.old` | Original monolith Dockerfile (disabled) |

## Environment Variables Summary

| Service | Key Variables |
|---------|--------------|
| Backend | `DATABASE_URL`, `ADMIN_API_KEY`, `ADMIN_JWT_SECRET`, `CORS_ORIGIN` |
| Biometrics | `BACKEND_URL`, `SERVICE_API_KEY` |
| Analytics | PostgreSQL connection vars, `SERVICE_API_KEY` |
| Frontend (Vercel) | `VITE_API_BASE_URL` → Render backend |