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

1. Go to Render Dashboard → **"+ New"** → **"PostgreSQL"**
2. Configure:
   - **Name**: `ii-vms-db`
   - **Database**: `ii_vms`
   - **User**: `postgres`
   - **Plan**: Free (or Starter)
3. Click **"Create Database"**
4. Copy the internal connection string (`DATABASE_URL`) for later use

---

## Step 2: Deploy Backend to Render

### Option A: Using render.yaml (Blueprint)

1. The file `backend/render.yaml` is provided in this project
2. Push to GitHub
3. In Render Dashboard: **"+ New"** → **"Blueprint"** → Select repo

### Option B: Manual Deployment

1. Render Dashboard → **"+ New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `ii-vms-backend`
   - **Root Directory**: `backend`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `./Dockerfile`
   - **Plan**: Free
4. Add environment variables:

```
NODE_ENV=production
DATABASE_URL=<from Step 1>
PORT=4000
CORS_ORIGIN=https://your-frontend.vercel.app
ADMIN_API_KEY=<generate-32-char-random-key>
ADMIN_JWT_SECRET=<generate-32-char-random-key>
ADMIN_JWT_EXPIRES_IN=2h
SERVICE_API_KEY=<generate-32-char-random-key>
BIOMETRIC_SERVICE_URL=https://ii-vms-biometrics.onrender.com
ANALYTICS_SERVICE_URL=https://ii-vms-analytics.onrender.com
UPLOAD_DIR=/tmp/uploads
LOG_LEVEL=info
ENABLE_RATE_LIMITING=true
SECURE_COOKIES=true
```

5. Click **"Create Web Service"**

---

## Step 3: Run Database Migrations

After backend deploys, run migrations:

1. Go to backend service in Render Dashboard
2. Click **"Shell"** tab
3. Run:
```bash
npm run migrate
```

---

## Step 4: Deploy Biometric Service

1. Render Dashboard → **"+ New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `ii-vms-biometrics`
   - **Root Directory**: `biometrics`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `Dockerfile`
   - **Plan**: Free
4. Add environment variables:

```
PORT=8000
STORAGE_DIR=/var/data
FACE_MATCH_TOLERANCE=0.6
CONFIDENCE_THRESHOLD=0.70
BIOMETRIC_VERIFY_MAX_CONCURRENCY=4
BACKEND_URL=https://ii-vms-backend.onrender.com
SERVICE_API_KEY=<same-as-backend-SERVICE_API_KEY>
```

5. Click **"Create Web Service"**

---

## Step 5: Deploy Analytics Service

1. Render Dashboard → **"+ New"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `ii-vms-analytics`
   - **Root Directory**: `biometrics`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `Dockerfile.analytics`
   - **Plan**: Free
4. Add environment variables:

```
PORT=8001
POSTGRES_HOST=<from Step 1>
POSTGRES_PORT=5432
POSTGRES_DB=ii_vms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<from Step 1>
SERVICE_API_KEY=<same-as-backend-SERVICE_API_KEY>
ANALYTICS_PORT=8001
```

5. Click **"Create Web Service"**

---

## Step 6: Update Backend CORS

After all services deploy, update backend environment:
- `CORS_ORIGIN`: Add `https://ii-vms-backend.onrender.com`
- `BIOMETRIC_SERVICE_URL`: Set to deployed biometrics URL
- `ANALYTICS_SERVICE_URL`: Set to deployed analytics URL

---

## Step 7: Deploy Frontend to Vercel

1. The `frontend/vercel.json` is pre-configured to point to Render backend
2. Push to GitHub
3. In Vercel Dashboard:
   - Import repository
   - Root Directory: `frontend`
   - Add env: `VITE_API_BASE_URL=https://ii-vms-backend.onrender.com`
   - Deploy

---

## Step 8: Verify

1. **Backend Health**: `curl https://ii-vms-backend.onrender.com/health`
2. **Frontend**: Visit `https://your-frontend.vercel.app`
3. **Register a visitor**: Frontend registration form
4. **Admin login**: `/admin/login` with ADMIN_API_KEY

---

## Environment Variables Summary

### Render Backend
| Variable | Source |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | From Render PostgreSQL |
| `PORT` | Auto-provided by Render |
| `CORS_ORIGIN` | Vercel frontend URL |
| `ADMIN_API_KEY` | Generate (min 32 chars) |
| `ADMIN_JWT_SECRET` | Generate (min 32 chars) |
| `SERVICE_API_KEY` | Generate (min 32 chars) |
| `BIOMETRIC_SERVICE_URL` | `https://ii-vms-biometrics.onrender.com` |
| `ANALYTICS_SERVICE_URL` | `https://ii-vms-analytics.onrender.com` |

### Render Biometrics
| Variable | Value |
|----------|-------|
| `PORT` | Auto-provided |
| `BACKEND_URL` | `https://ii-vms-backend.onrender.com` |
| `SERVICE_API_KEY` | Same as backend |

### Render Analytics
| Variable | Value |
|----------|-------|
| `PORT` | Auto-provided |
| PostgreSQL vars | From Render PostgreSQL |
| `SERVICE_API_KEY` | Same as backend |

### Vercel Frontend
| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://ii-vms-backend.onrender.com` |

---

## Costs (Render Free Tier)
- **PostgreSQL**: Free for 90 days
- **Backend**: 750 hours/month
- **Biometrics**: 750 hours/month
- **Analytics**: 750 hours/month
- **Total**: Free (with trial)

## Troubleshooting

### Backend won't start
- Check logs for `DATABASE_URL` errors
- Ensure PostgreSQL is created first
- Verify `DATABASE_URL` format

### CORS errors in browser
- Update `CORS_ORIGIN` in backend Render env
- Must match exact frontend URL (no trailing slash)
- Redeploy backend

### Frontend API calls fail
- Check Vercel rewrites in `vercel.json`
- Verify `VITE_API_BASE_URL` in Vercel environment
- Ensure Render backend is publicly accessible