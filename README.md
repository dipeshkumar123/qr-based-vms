# II-VMS: Intelligent Integrated Visitor Management System

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)
![React](https://img.shields.io/badge/react-19.x-61dafb.svg)

**A modern, intelligent visitor management system combining QR technology, facial recognition, and AI-powered analytics.**

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Demo](#demo) • [Contributing](#contributing)

</div>

---

## 🌟 Overview

**II-VMS** is an enterprise-grade visitor management platform that transforms traditional visitor logging into an intelligent, automated, and secure experience. Built for modern workplaces, educational institutions, and secure facilities, II-VMS provides:

- **🎯 Contactless Registration**: Web-based self-service visitor registration
- **📱 QR-Based Access**: Unique QR codes for quick, touchless check-in
- **🔐 Biometric Security**: AI-powered facial recognition for identity verification
- **🛡️ Immutable Audit Trail**: Blockchain-inspired logging with cryptographic hash chains
- **📊 Intelligent Analytics**: ML-driven insights and anomaly detection
- **🔔 Real-Time Alerts**: Multi-channel notifications (email/SMS) for security events
- **⚡ Lightning Fast**: Sub-second response times with optimized performance

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VISITOR LAYER                            │
│  Web Browser • Mobile Device • Self-Service Kiosk            │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS / REST API
┌─────────────────────▼───────────────────────────────────────┐
│                  APPLICATION LAYER                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React 19 Frontend (Vite + Tailwind CSS)            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Node.js Backend (Express + TypeScript)             │   │
│  │  • Visitor Management  • Admin Portal               │   │
│  │  • Authentication     • Notification Engine         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼───────┐ ┌───▼─────────┐ ┌─▼──────────────┐
│  PostgreSQL   │ │  Biometric  │ │   Analytics    │
│   Database    │ │   Service   │ │    Service     │
│               │ │  (Python)   │ │   (Python)     │
│ • Visitors    │ │             │ │                │
│ • Audit Log   │ │  FastAPI    │ │   FastAPI      │
│ • Analytics   │ │  face_recog │ │  scikit-learn  │
└───────────────┘ └─────────────┘ └────────────────┘
```

**Modern Microservices Design**:
- **Frontend**: React 19 with Vite for blazing-fast development
- **Backend**: Express.js with TypeScript for type-safe API
- **Biometric Service**: Python FastAPI with face_recognition library
- **Analytics Service**: Python FastAPI with pandas & scikit-learn
- **Database**: PostgreSQL 16 for ACID-compliant data storage

---

## ✨ Features

### Core Features

#### 📝 Visitor Registration
- Self-service web form with real-time validation
- Automatic QR code generation (UUID-based)
- Optional photo capture for biometric enrollment
- Mobile-responsive design for any device
- Instant email confirmation with QR code

#### 🔍 Facial Recognition
- AI-powered face detection and verification
- 99.38% accuracy on industry benchmarks
- Secure biometric data storage
- Real-time verification (< 2 seconds)
- Privacy-compliant (GDPR/CCPA ready)

#### 🛡️ Security & Audit
- Immutable audit trail with SHA-256 hash chains
- Tamper-proof logging (blockchain-inspired)
- Role-based access control (RBAC)
- JWT authentication with HTTP-only cookies
- Encrypted data transmission (TLS 1.3)

#### 📊 Analytics & Insights
- **Peak Hour Prediction**: ML-based forecasting for resource planning
- **Frequent Visitor Analysis**: Identify regular guests for VIP treatment
- **Anomaly Detection**: Isolation Forest algorithm for suspicious patterns
- **Trend Visualization**: Interactive charts with Recharts
- **Real-Time Dashboard**: Live visitor statistics and metrics

#### 🔔 Automated Notifications
- **Email Alerts**: Professional HTML templates with SMTP support
- **SMS Alerts**: Twilio-powered instant notifications
- **Event Triggers**:
  - New visitor arrival
  - Failed biometric verification
  - Repeated visit patterns (5+ visits)
  - Suspicious activity detection
- **Multi-Channel**: Email + SMS for critical alerts

### Admin Features

#### 👨‍💼 Admin Dashboard
- Real-time visitor monitoring
- Check-in/check-out management
- Visitor search and filtering
- Pagination for large datasets
- Export to CSV for reporting

#### 🔐 Access Control
- Secure admin authentication
- Session management with JWT
- API key support for integrations
- Rate limiting for security
- Activity logging

#### 📈 Reporting
- Custom date range reports
- Visitor trends and patterns
- Biometric verification logs
- Audit ledger inspection
- CSV export capabilities

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/downloads))
- **npm** or **pnpm** (comes with Node.js)

### Installation

**1. Clone the Repository**
```bash
git clone https://github.com/yourusername/QR_Based_VMS.git
cd QR_Based_VMS
```

**2. Install Dependencies**
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to project root
cd ..
```

**3. Start Database & Services**
```bash
# Start PostgreSQL, Biometric Service, and Analytics Service
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                 STATUS          PORTS
postgres             Up 10 seconds   0.0.0.0:5434->5432/tcp
biometrics           Up 10 seconds   0.0.0.0:8000->8000/tcp
analytics            Up 10 seconds   0.0.0.0:8001->8001/tcp
```

**4. Configure Environment Variables**
```bash
# Copy example environment file
cp backend/.env.example backend/.env

# Edit backend/.env with your settings
# Minimum required configuration:
# - ADMIN_API_KEY (set a strong password)
# - DATABASE_URL (default works with Docker)
# - ADMIN_JWT_SECRET (random string)
```

Production secret guidance:
- Use randomly generated values for `ADMIN_API_KEY`, `ADMIN_JWT_SECRET`, and `SERVICE_API_KEY`.
- Prefer file-backed secrets in production via `*_FILE` variables (for Docker/Kubernetes secret mounts), for example `ADMIN_JWT_SECRET_FILE=/run/secrets/admin_jwt_secret`.
- The backend now performs secret hygiene checks and will refuse startup in production when placeholder or weak secrets are detected.

**5. Start Backend Server**
```bash
cd backend
npm run dev
```

Backend will start on `http://localhost:4000`

**6. Start Frontend Development Server**
```bash
# In a new terminal
cd frontend
npm run dev
```

Frontend will start on `http://localhost:5173`

**7. Access the Application**
- **Visitor Portal**: http://localhost:5173/
- **Admin Login**: http://localhost:5173/admin/login
- **API Documentation**: http://localhost:4000/api/
- **Biometric Service**: http://localhost:8000/docs
- **Analytics Service**: http://localhost:8001/docs

### Default Admin Credentials

First-time setup will prompt you to create an admin account. For testing:
- **Email**: admin@example.com
- **Password**: Set via `ADMIN_API_KEY` in `.env`

---

## 📖 Documentation

### For Users
- **[User Guide](docs/USER_GUIDE.md)** - How to use II-VMS as a visitor or admin
- **[Quick Start](SETUP_PHASE_2.8.md)** - Get up and running in 5 minutes
- **[FAQ](docs/FAQ.md)** - Common questions and answers

### For Developers
- **[Technical Knowledge Base](TECHNICAL_KNOWLEDGE_BASE.md)** - Complete technical documentation
- **[API Reference](docs/API_NOTIFICATIONS.md)** - REST API endpoints
- **[Architecture Guide](docs/PHASE_2.8_AUTOMATED_ALERTS.md)** - System design and components
- **[Development Guide](docs/DEVELOPMENT.md)** - Contributing and coding standards

### Feature Documentation
- **[Biometric System](BIOMETRIC_GUIDE.md)** - Face recognition implementation
- **[Analytics & ML](docs/PHASE_2.7_INTELLIGENT_ANALYTICS.md)** - Machine learning features
- **[Notification System](docs/PHASE_2.8_AUTOMATED_ALERTS.md)** - Email/SMS alerts
- **[Audit Logging](PHASE_2_6_AUDIT_LOGGING.md)** - Immutable ledger system

---

## 🎯 Use Cases

### Corporate Offices
- Streamline visitor check-in process
- Automate badge printing
- Track visitor movements
- Compliance and security audits

### Educational Institutions
- Parent-teacher meeting management
- Guest lecture registration
- Campus security monitoring
- Event attendance tracking

### Healthcare Facilities
- Patient visitor management
- HIPAA-compliant logging
- Contact tracing support
- Infection control protocols

### Government Buildings
- High-security access control
- Multi-factor authentication
- Comprehensive audit trails
- Regulatory compliance

---

## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with concurrent features |
| **Vite** | Build tool & dev server (HMR) |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Smooth animations |
| **Recharts** | Data visualization |
| **Zustand** | State management |
| **Axios** | HTTP client |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 20** | JavaScript runtime |
| **Express.js** | Web framework |
| **TypeScript** | Type-safe development |
| **PostgreSQL 16** | Relational database |
| **JWT** | Authentication |
| **Zod** | Schema validation |
| **Nodemailer** | Email notifications |
| **Twilio** | SMS notifications |

### AI & Analytics
| Technology | Purpose |
|------------|---------|
| **Python 3.11** | ML runtime |
| **FastAPI** | Modern API framework |
| **face_recognition** | Facial recognition |
| **scikit-learn** | Machine learning |
| **pandas** | Data analysis |
| **NumPy** | Numerical computing |

### DevOps
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **GitHub Actions** | CI/CD pipeline |
| **Nginx** | Reverse proxy |

---

## 📊 Demo

### Screenshots

**Visitor Registration**
![Visitor Registration](https://via.placeholder.com/800x400?text=Visitor+Registration+Form)

**Admin Dashboard**
![Admin Dashboard](https://via.placeholder.com/800x400?text=Admin+Dashboard+with+Analytics)

**Face Verification**
![Face Verification](https://via.placeholder.com/800x400?text=Biometric+Verification+Modal)

**Analytics Dashboard**
![Analytics](https://via.placeholder.com/800x400?text=Analytics+Dashboard+with+Charts)

### Live Demo

**Coming Soon**: A live demo will be available at [demo.iivms.com](https://demo.iivms.com)

---

## ⚙️ Configuration

### Environment Variables

Create `.env` files in the backend directory with the following configuration:

#### Required Variables

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/visitor_management

# Admin Authentication
ADMIN_API_KEY=your_secure_admin_key_here
ADMIN_JWT_SECRET=your_jwt_secret_min_32_chars_long
ADMIN_JWT_EXPIRES_IN=24h

# Server Configuration
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:5173
PUBLIC_BASE_URL=http://localhost:4000

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

#### Optional: Email Notifications (Nodemailer)

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
EMAIL_FROM="II-VMS <noreply@iivms.com>"

# Notification Settings
NOTIFICATION_ARRIVAL_ENABLED=true
NOTIFICATION_FAILURE_ENABLED=true
NOTIFICATION_REPEAT_ENABLED=true
NOTIFICATION_SUSPICIOUS_ENABLED=true
```

#### Optional: SMS Notifications (Twilio)

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SMS Settings
SMS_ARRIVAL_ENABLED=false
SMS_FAILURE_ENABLED=false
SMS_REPEAT_ENABLED=false
SMS_SUSPICIOUS_ENABLED=false
```

#### Optional: Analytics & Thresholds

```env
# Analytics Configuration
ANALYTICS_REPEAT_THRESHOLD=3
ANALYTICS_SUSPICIOUS_THRESHOLD=0.7
ANALYTICS_TIMEFRAME_DAYS=30
FACE_RECOGNITION_THRESHOLD=0.6
```

### Configuration Tips

**Gmail SMTP Setup:**
1. Enable 2FA on your Google account
2. Generate App Password: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Use the generated password in `SMTP_PASS`

**Twilio Setup:**
1. Sign up at [twilio.com](https://www.twilio.com)
2. Get Account SID and Auth Token from console
3. Purchase a phone number
4. Set variables in `.env`

**Database Connection:**
- Default Docker setup uses port `5434` to avoid conflicts
- Production: Use managed PostgreSQL (AWS RDS, Azure Database, etc.)
- Connection pooling: Adjust `pool.ts` for high-traffic scenarios

---

## 🎓 Usage Examples

### Visitor Registration

**Scenario**: A guest arrives at your office

1. Visitor opens registration portal at `http://localhost:5173/`
2. Fills out form:
   - Full Name: John Doe
   - Email: john@example.com
   - Phone: +1234567890
   - Purpose: Business Meeting
   - Host: Jane Smith
3. (Optional) Uploads profile photo for biometric verification
4. Submits form
5. System generates unique QR code
6. Visitor receives email with QR code and check-in instructions

**API Request:**
```bash
curl -X POST http://localhost:4000/api/visitors \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "purpose": "Business Meeting",
    "host": "Jane Smith",
    "photoUrl": "http://localhost:4000/uploads/photo_123.jpg"
  }'
```

**Response:**
```json
{
  "id": 42,
  "fullName": "John Doe",
  "email": "john@example.com",
  "token": "abc123def456",
  "qrCode": "data:image/png;base64,...",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Admin Check-In

**Scenario**: Security desk checks in a visitor

1. Admin logs into dashboard at `http://localhost:5173/admin/login`
2. Enters credentials (email + password from `ADMIN_API_KEY`)
3. Views visitor list in dashboard
4. Scans visitor's QR code or searches by name
5. Clicks "Check In" button
6. System records timestamp and triggers notifications

**API Request:**
```bash
curl -X POST http://localhost:4000/api/visitors/abc123def456/check-in \
  -H "x-admin-key: your_admin_key_here"
```

**Response:**
```json
{
  "id": 42,
  "token": "abc123def456",
  "status": "checked_in",
  "checkedInAt": "2024-01-15T10:45:00Z"
}
```

### Face Verification

**Scenario**: Verify visitor identity at entry

1. Admin clicks "Verify Face" in dashboard
2. Activates webcam or uploads photo
3. System captures image and sends to biometric service
4. Face recognition compares against stored reference photos
5. Returns match confidence score
6. Logs verification result in audit ledger

**API Request:**
```bash
curl -X POST http://localhost:4000/api/biometrics/verify/abc123def456 \
  -H "Content-Type: application/json" \
  -d '{
    "photoUrl": "http://localhost:4000/uploads/verification_photo.jpg"
  }'
```

**Response:**
```json
{
  "verified": true,
  "confidence": 0.95,
  "matchedPhoto": {
    "id": 7,
    "url": "http://localhost:4000/uploads/photo_123.jpg"
  }
}
```

### Analytics Query

**Scenario**: Generate weekly report

1. Admin navigates to Analytics page
2. Selects date range (last 7 days)
3. Views peak hour predictions, repeat visitor patterns, anomalies
4. Exports report as CSV

**API Request:**
```bash
curl -X GET "http://localhost:4000/api/analytics/dashboard?days=7" \
  -H "x-admin-key: your_admin_key_here"
```

**Response:**
```json
{
  "summary": {
    "totalVisitors": 156,
    "repeatVisitors": 23,
    "suspiciousPatterns": 2,
    "avgDailyVisitors": 22.3
  },
  "peakHourPrediction": {
    "predictedHour": 14,
    "confidence": 0.87,
    "historicalAverage": 18.5
  },
  "repeatVisitors": [
    {
      "visitorId": 42,
      "fullName": "John Doe",
      "visitCount": 5,
      "lastVisit": "2024-01-15T10:45:00Z"
    }
  ]
}
```

---

## 📡 API Reference

### Base URL
```
http://localhost:4000/api
```

### Authentication

Most endpoints require admin authentication via:
- **Header**: `x-admin-key: your_admin_key`
- **Cookie**: `admin-token` (after login)

### Core Endpoints

#### Visitors

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/visitors` | No | Register new visitor |
| `GET` | `/visitors` | Yes | List all visitors |
| `GET` | `/visitors/:token` | Yes | Get visitor by QR token |
| `POST` | `/visitors/:token/check-in` | Yes | Check in visitor |
| `DELETE` | `/visitors/:id` | Yes | Delete visitor |
| `GET` | `/visitors/export` | Yes | Export visitors as CSV |

#### Biometrics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/biometrics/verify/:token` | Yes | Verify face against references |
| `GET` | `/biometrics/photos/:token` | Yes | List reference photos |
| `POST` | `/biometrics/photos/:token` | Yes | Add reference photo |
| `DELETE` | `/biometrics/photos/:photoId` | Yes | Remove photo |

#### Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/analytics/dashboard` | Yes | Get analytics dashboard data |
| `GET` | `/analytics/peak-hours` | Yes | Predict peak visiting hours |
| `GET` | `/analytics/repeat-visitors` | Yes | Identify frequent visitors |
| `GET` | `/analytics/anomalies` | Yes | Detect suspicious patterns |

#### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/admin/login` | No | Admin login (returns JWT) |
| `POST` | `/admin/verify` | Yes | Verify admin key |
| `GET` | `/admin/notifications/settings` | Yes | Get notification settings |
| `PUT` | `/admin/notifications/settings` | Yes | Update notification settings |
| `POST` | `/admin/notifications/test` | Yes | Send test notification |

#### Audit

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/ledger` | Yes | Get audit ledger entries |
| `GET` | `/ledger/verify` | Yes | Verify ledger integrity |

#### Uploads

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/uploads` | No | Upload image file |
| `GET` | `/uploads/:filename` | No | Retrieve uploaded file |

### Rate Limiting

- **Public endpoints**: 100 requests/15 minutes per IP
- **Admin endpoints**: 200 requests/15 minutes per API key

### Error Responses

All errors follow this format:
```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

Common status codes:
- `400` Bad Request - Invalid input data
- `401` Unauthorized - Missing or invalid credentials
- `403` Forbidden - Insufficient permissions
- `404` Not Found - Resource doesn't exist
- `429` Too Many Requests - Rate limit exceeded
- `500` Internal Server Error - Server-side issue

---

## 🚢 Deployment

### Docker Production Deployment

**1. Build Production Images**
```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Or build individually
docker build -t iivms-backend ./backend
docker build -t iivms-frontend ./frontend
```

**2. Configure Production Environment**
```bash
# Create production .env file
cp backend/.env.example backend/.env.production

# Update with production values:
# - Strong passwords for DATABASE_URL
# - Secure ADMIN_JWT_SECRET (min 32 chars)
# - Production CORS_ORIGIN
# - Real SMTP/Twilio credentials
```

**3. Start Production Stack**
```bash
docker-compose -f docker-compose.prod.yml up -d

# Verify all containers are healthy
docker-compose ps
```

**4. Initialize Database**
```bash
# Run migrations
docker-compose exec backend npm run migrate

# (Optional) Seed sample data
docker-compose exec backend npm run seed
```

**5. Configure Reverse Proxy (Nginx)**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Cloud Deployment Options

#### AWS

**Architecture:**
- **Frontend**: S3 + CloudFront
- **Backend**: ECS Fargate or EC2
- **Database**: RDS PostgreSQL
- **Biometric/Analytics**: Lambda or ECS
- **Storage**: S3 for uploads

**Estimated Cost**: $50-200/month (depending on traffic)

#### Azure

**Architecture:**
- **Frontend**: Static Web Apps
- **Backend**: App Service or Container Instances
- **Database**: Azure Database for PostgreSQL
- **Biometric/Analytics**: Container Instances
- **Storage**: Blob Storage

**Estimated Cost**: $60-180/month

#### DigitalOcean

**Architecture:**
- **All Services**: Droplet (4GB RAM minimum)
- **Database**: Managed PostgreSQL
- **Storage**: Spaces Object Storage

**Estimated Cost**: $40-120/month

### Environment-Specific Configuration

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug

# Staging
NODE_ENV=staging
LOG_LEVEL=info

# Production
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_RATE_LIMITING=true
ENABLE_CORS_CREDENTIALS=true
SECURE_COOKIES=true
```

### SSL/TLS Configuration

**Using Let's Encrypt (Free):**
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (runs twice daily)
sudo systemctl enable certbot.timer
```

### Monitoring & Health Checks

**Health Check Endpoints:**
- Backend: `GET /health`
- Biometric: `GET /health`
- Analytics: `GET /health`
- Database: `SELECT 1`

**Recommended Monitoring Tools:**
- **Application**: PM2, New Relic, DataDog
- **Infrastructure**: Prometheus + Grafana
- **Logs**: ELK Stack, Loki
- **Uptime**: UptimeRobot, Pingdom

### Backup Strategy

**Database Backups:**
```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -h localhost -U postgres visitor_management > "$BACKUP_DIR/backup_$DATE.sql"

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete
```

**File Upload Backups:**
```bash
# Sync uploads to S3 daily
aws s3 sync ./uploads s3://your-bucket/uploads --delete
```

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Test thoroughly**
   ```bash
   npm test
   npm run lint
   ```
5. **Commit with descriptive messages**
   ```bash
   git commit -m "feat: add email notification retry logic"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request**

### Code Style

- **TypeScript**: Follow [TypeScript ESLint](https://typescript-eslint.io/) rules
- **React**: Use functional components and hooks
- **Formatting**: Prettier with 2-space indentation
- **Naming**: camelCase for variables, PascalCase for components

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Build process or tooling changes

### Testing Requirements

- **Unit tests**: Minimum 80% coverage
- **Integration tests**: All API endpoints
- **E2E tests**: Critical user flows

### Pull Request Checklist

- [ ] Code follows project style guide
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No console errors/warnings
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Reviewed by at least one maintainer

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### MIT License Summary

✅ **Permissions:**
- Commercial use
- Modification
- Distribution
- Private use

⚠️ **Conditions:**
- Include original license and copyright notice

❌ **Limitations:**
- No liability
- No warranty

---

## 🙏 Acknowledgments

### Technologies
- [React](https://react.dev) - UI framework
- [Node.js](https://nodejs.org) - JavaScript runtime
- [PostgreSQL](https://www.postgresql.org) - Database
- [FastAPI](https://fastapi.tiangolo.com) - Python web framework
- [face_recognition](https://github.com/ageitgey/face_recognition) - Facial recognition library

### Inspiration
- Modern visitor management needs
- GDPR and privacy compliance
- Zero-trust security principles
- AI-powered automation

### Contributors
Special thanks to all contributors who have helped shape II-VMS!

---

## 📞 Support & Contact

### Documentation
- **Full Documentation**: [TECHNICAL_KNOWLEDGE_BASE.md](TECHNICAL_KNOWLEDGE_BASE.md)
- **API Docs**: [docs/API_NOTIFICATIONS.md](docs/API_NOTIFICATIONS.md)
- **Setup Guide**: [SETUP_PHASE_2.8.md](SETUP_PHASE_2.8.md)

### Issues & Bugs
Report issues on [GitHub Issues](https://github.com/yourusername/QR_Based_VMS/issues)

### Community
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/QR_Based_VMS/discussions)
- **Email**: support@iivms.com
- **Twitter**: [@IIVMS](https://twitter.com/IIVMS)

### Commercial Support
For enterprise support, custom development, or consulting:
- **Email**: enterprise@iivms.com
- **Website**: [iivms.com](https://iivms.com)

---

<div align="center">

**Made with ❤️ by the II-VMS Team**

[⬆ Back to Top](#ii-vms-intelligent-integrated-visitor-management-system)

</div>
