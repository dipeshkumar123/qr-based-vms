# II-VMS: Intelligent Integrated Visitor Management System

A modern, production-ready visitor management system that combines QR code technology, facial recognition, and AI-powered analytics to provide secure, contactless visitor management for offices, educational institutions, and secure facilities.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, Tailwind CSS, Framer Motion, Recharts, Zustand |
| **Backend** | Node.js 20, Express.js, TypeScript, PostgreSQL 16 |
| **Biometrics** | Python 3.11, FastAPI, face_recognition, dlib |
| **Analytics** | Python 3.11, FastAPI, scikit-learn, pandas |
| **Infrastructure** | Docker, Docker Compose, Nginx, Render, Vercel |

## Key Features

- **Contactless Registration** — Web-based self-service visitor registration with automatic QR code generation
- **QR-Based Access** — Unique UUID-based QR codes for quick check-in/check-out
- **Facial Recognition** — AI-powered face verification using the `face_recognition` library (99.38% accuracy)
- **Immutable Audit Trail** — Blockchain-inspired SHA-256 hash chain for tamper-proof logging
- **Intelligent Analytics** — ML-driven peak hour prediction, repeat visitor detection, and anomaly detection (Isolation Forest)
- **Multi-Channel Notifications** — Email (Nodemailer) and SMS (Twilio) alerts for arrivals, failed verifications, and suspicious activity
- **Admin Dashboard** — Real-time visitor monitoring, check-in/check-out management, CSV export

## Architecture Overview

The system is composed of four services that communicate over HTTP:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │
│  (React 19)  │     │ (Express.js) │     │   (DB 16)    │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
            ┌───────▼────┐  ┌──────▼────────┐
            │  Biometric  │  │   Analytics   │
            │  (Python)   │  │   (Python)    │
            │  :8000      │  │   :8001       │
            └────────────┘  └───────────────┘
```

- **Frontend** serves the UI and proxies API calls to the backend
- **Backend** handles business logic, authentication, and database operations
- **Biometric Service** processes face images and performs verification
- **Analytics Service** runs ML models and generates insights

## Challenges Overcome

- **Face recognition in Docker**: The `face_recognition` library requires dlib with compilation. The biometric Dockerfile installs build tools (cmake, openblas) to compile it inside the container.
- **ESM compatibility**: The backend uses Node.js ESM (`"type": "module"`) with TypeScript. The health check uses dynamic `import()` instead of `require()`.
- **Non-root security**: All Docker containers run as non-root users. File permissions for upload directories are explicitly set with `chown`.
- **Database migrations on Render free tier**: Render's free tier has no shell access, so a `/migrate` HTTP endpoint was added to run schema migrations via the API.
- **Service-to-service auth**: The biometric and analytics services authenticate to the backend using a shared `SERVICE_API_KEY` sent as the `x-admin-key` header.

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/downloads)

### Quick Start (Docker Compose)

This is the fastest way to get everything running:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/QR_Based_VMS.git
cd QR_Based_VMS

# 2. Start all services (PostgreSQL, Backend, Biometrics, Analytics)
docker-compose up -d

# 3. Verify everything is running
docker-compose ps
```

Expected output:
```
NAME                 STATUS          PORTS
postgres             Up (healthy)    0.0.0.0:5434->5432/tcp
backend              Up (healthy)    0.0.0.0:4000->4000/tcp
biometric            Up (healthy)    0.0.0.0:8000->8000/tcp
analytics            Up (healthy)    0.0.0.0:8001->8001/tcp
```

### Manual Setup (for development)

If you prefer to run services individually for faster development iteration:

```bash
# 1. Start infrastructure (PostgreSQL + microservices)
docker-compose up -d postgres biometric analytics

# 2. Install backend dependencies
cd backend
cp .env.example .env
npm install

# 3. Start backend in dev mode (with hot reload)
npm run dev

# 4. In a new terminal, install and start frontend
cd frontend
npm install
npm run dev
```

### Access the Application

| Service | URL |
|---------|-----|
| Visitor Portal | http://localhost:5173 |
| Admin Login | http://localhost:5173/admin/login |
| Backend Health | http://localhost:4000/health |
| Biometric API Docs | http://localhost:8000/docs |
| Analytics API Docs | http://localhost:8001/docs |

### Default Admin Access

After starting the backend, set an admin key in `backend/.env`:

```env
ADMIN_API_KEY=your-secure-key-here
ADMIN_JWT_SECRET=your-jwt-secret-here
```

Then log in at http://localhost:5173/admin/login using the key.

## Project Structure

```
QR_Based_VMS/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/       # Auth, error handling
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Business logic (analytics, notifications)
│   │   ├── utils/           # Logger, crypto, HTTP errors
│   │   ├── db/              # Database pool configuration
│   │   ├── config.ts        # Environment variable configuration
│   │   └── index.ts         # Application entry point
│   ├── db/                  # SQL schema files
│   ├── scripts/             # Migration scripts
│   └── Dockerfile           # Multi-stage production build
├── frontend/                # React SPA
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── lib/             # API client, utilities
│   │   ├── store/           # Zustand state management
│   │   └── App.jsx          # Root component with routing
│   ├── nginx.conf           # Nginx config for production
│   ├── vercel.json          # Vercel deployment config
│   └── Dockerfile           # Multi-stage production build
├── biometrics/              # Python FastAPI face recognition service
│   ├── server.py            # API endpoints for capture/verify
│   ├── Dockerfile           # Production build
│   └── requirements.txt     # Python dependencies
├── docs/                    # Documentation
├── docker-compose.yml       # Local development orchestration
├── render.yaml              # Render Blueprint deployment
└── Dockerfile               # Root Dockerfile for Render deployment
```

## Deployment

### Backend → Render

The `render.yaml` file at the project root is a Render Blueprint that automatically creates:

1. A PostgreSQL database
2. A web service running the backend Docker image

To deploy:

1. Push the repository to GitHub
2. In Render Dashboard, click **"New +"** → **"Blueprint"**
3. Select your repository
4. Render reads `render.yaml` and provisions the infrastructure
5. After deployment, set `CORS_ORIGIN` in the Render environment to your frontend URL

### Frontend → Vercel

1. In Vercel Dashboard, click **"Add New Project"**
2. Import your GitHub repository
3. Set **Root Directory** to `frontend`
4. Add environment variable: `VITE_API_BASE_URL=https://your-backend.onrender.com`
5. Deploy

The `frontend/vercel.json` file configures rewrites so that `/api/*` and `/uploads/*` requests are proxied to the Render backend.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ADMIN_API_KEY` | Yes | API key for admin authentication |
| `ADMIN_JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `PORT` | No | Server port (default: 4000) |
| `CORS_ORIGIN` | No | Comma-separated allowed origins |
| `BIOMETRIC_SERVICE_URL` | No | Biometric service URL (default: http://localhost:8000) |
| `ANALYTICS_SERVICE_URL` | No | Analytics service URL (default: http://localhost:8001) |
| `SMTP_HOST` | No | SMTP server for email notifications |
| `TWILIO_ACCOUNT_SID` | No | Twilio account for SMS notifications |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | No | Backend API URL (default: empty, uses relative proxy) |

## API Overview

All API endpoints are prefixed with `/api`. Admin endpoints require either:
- `x-admin-key` header with the `ADMIN_API_KEY` value, or
- A valid JWT cookie obtained via `POST /api/admin/login`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/visitors` | POST | No | Register a new visitor |
| `/api/visitors` | GET | Yes | List all visitors |
| `/api/visitors/:token/check-in` | POST | Yes | Check in a visitor |
| `/api/visitors/:token/check-out` | POST | Yes | Check out a visitor |
| `/api/biometric/capture` | POST | No | Capture face encoding |
| `/api/biometric/verify` | POST | No | Verify face against stored encoding |
| `/api/analytics/dashboard` | GET | Yes | Get analytics dashboard data |
| `/api/admin/login` | POST | No | Admin login |
| `/api/ledger` | GET | Yes | View audit ledger |
| `/health` | GET | No | Health check |
| `/migrate` | GET | No | Run database migrations |

## License

MIT