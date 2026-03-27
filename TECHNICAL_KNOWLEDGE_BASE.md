# II-VMS Technical Knowledge Base
## Comprehensive Technical Documentation for Developers

> **Document Version**: 1.0  
> **Last Updated**: January 3, 2026  
> **Author**: Development Team  
> **Purpose**: Internal technical reference and knowledge preservation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Technology Stack](#technology-stack)
4. [Core Components](#core-components)
5. [Database Architecture](#database-architecture)
6. [Biometric System](#biometric-system)
7. [Analytics & ML](#analytics--ml)
8. [Notification System](#notification-system)
9. [Security Implementation](#security-implementation)
10. [API Design](#api-design)
11. [Deployment Architecture](#deployment-architecture)
12. [Development Patterns](#development-patterns)
13. [Testing Strategy](#testing-strategy)
14. [Performance Optimization](#performance-optimization)
15. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Overview

### What is II-VMS?

**II-VMS (Intelligent Integrated Visitor Management System)** is a comprehensive, enterprise-grade visitor management platform that combines:

- **Contactless Registration**: Web-based visitor self-registration
- **QR-Based Access**: Unique QR tokens for each visitor
- **Biometric Verification**: Face recognition using deep learning
- **Immutable Audit**: Blockchain-inspired ledger with SHA-256 hashing
- **Predictive Analytics**: ML-based visitor pattern analysis
- **Automated Alerts**: Multi-channel notifications (email/SMS)

### Key Differentiators

1. **Multi-Factor Verification**: QR + Face Recognition
2. **Tamper-Proof Logging**: Cryptographic hash chains
3. **Intelligent Insights**: ML-powered anomaly detection
4. **Real-Time Alerts**: Instant notifications for security events
5. **Scalable Architecture**: Microservices-based design

---

## Architecture Deep Dive

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser    │  │   Mobile     │  │   Kiosk      │      │
│  │   (React)    │  │   (PWA)      │  │   (Touch)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS / WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Express.js Backend (Node.js 20+)            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │  Visitor   │  │   Admin    │  │   Auth     │     │   │
│  │  │  Service   │  │  Service   │  │  Service   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ Notification│  │  Ledger   │  │  Analytics │     │   │
│  │  │  Service   │  │  Service   │  │   Proxy    │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
┌───────────▼─────┐  ┌──────▼───────┐  ┌───▼──────────┐
│  PostgreSQL 16  │  │  Biometric   │  │  Analytics   │
│   (Primary DB)  │  │  Service     │  │  Service     │
│                 │  │  (Python)    │  │  (Python)    │
│  • visitors     │  │              │  │              │
│  • audit_ledger │  │  FastAPI     │  │  FastAPI     │
│  • analytics    │  │  face_recog  │  │  scikit-learn│
└─────────────────┘  └──────────────┘  └──────────────┘
```

### Microservices Architecture

**1. Core Backend (Node.js/Express)**
- **Purpose**: Main API gateway, business logic orchestration
- **Port**: 4000
- **Technologies**: Express, TypeScript, Zod, JWT
- **Responsibilities**:
  - Visitor CRUD operations
  - Authentication/Authorization
  - Request routing
  - Notification triggering
  - Audit logging

**2. Biometric Service (Python/FastAPI)**
- **Purpose**: Face recognition and biometric processing
- **Port**: 8000
- **Technologies**: FastAPI, face_recognition, dlib, OpenCV
- **Responsibilities**:
  - Face encoding generation
  - Face comparison/verification
  - Image preprocessing
  - Biometric data storage

**3. Analytics Service (Python/FastAPI)**
- **Purpose**: Data analysis and ML predictions
- **Port**: 8001
- **Technologies**: FastAPI, pandas, scikit-learn, numpy
- **Responsibilities**:
  - Visitor trend analysis
  - Peak hour prediction (Linear Regression)
  - Anomaly detection (Isolation Forest)
  - Frequent visitor analysis
  - Summary statistics generation

### Communication Patterns

**Synchronous REST APIs**
```
Frontend → Backend → Database (PostgreSQL)
Frontend → Backend → Biometric Service → Database
Frontend → Backend → Analytics Service → Database
```

**Asynchronous Event-Driven**
```
Visitor Created → Notification Service → Email/SMS
Face Verification Failed → Notification Service → Alert
Analytics Detected Anomaly → Notification Service → Critical Alert
```

---

## Technology Stack

### Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.x | UI framework |
| **Vite** | Latest | Build tool & dev server |
| **Tailwind CSS** | 3.x | Utility-first styling |
| **Framer Motion** | Latest | Animations |
| **Recharts** | 2.x | Data visualization |
| **Zustand** | Latest | State management |
| **Axios** | 1.x | HTTP client |
| **Zod** | 3.x | Schema validation |
| **QRCode.react** | Latest | QR code generation |

**Why These Choices?**
- React 19: Latest features, concurrent rendering
- Vite: Lightning-fast HMR, optimal production builds
- Tailwind: Rapid prototyping, consistent design system
- Recharts: Declarative charts, responsive out-of-box

### Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ LTS | JavaScript runtime |
| **Express.js** | 4.x | Web framework |
| **TypeScript** | 5.x | Type safety |
| **PostgreSQL** | 16 | Primary database |
| **node-postgres** | 8.x | Database driver |
| **Zod** | 3.x | Runtime validation |
| **JWT** | 9.x | Authentication |
| **Helmet** | 7.x | Security headers |
| **CORS** | 2.x | Cross-origin resource sharing |
| **Multer** | 2.x | File upload handling |
| **Nodemailer** | 7.x | Email notifications |
| **Twilio** | 5.x | SMS notifications |

**Why These Choices?**
- Node.js 20: Performance improvements, native fetch
- TypeScript: Catch errors at compile time
- PostgreSQL 16: ACID compliance, JSON support, performance
- Zod: Runtime type checking, schema validation

### Biometric Service Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11 | Programming language |
| **FastAPI** | Latest | Web framework |
| **face_recognition** | 1.3.0 | Face detection & encoding |
| **dlib** | 19.24.2 | Machine learning toolkit |
| **OpenCV** | 4.x | Image processing |
| **numpy** | 1.26.4 | Numerical operations |
| **Pillow** | Latest | Image manipulation |

**Why These Choices?**
- face_recognition: High-accuracy, simple API
- dlib: Battle-tested, HOG + CNN models
- FastAPI: Modern, async, auto-docs

### Analytics Service Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11 | Programming language |
| **FastAPI** | Latest | Web framework |
| **pandas** | 2.2.0 | Data manipulation |
| **scikit-learn** | 1.4.2 | Machine learning |
| **numpy** | 1.26.4 | Numerical computing |
| **psycopg2** | 2.9.9 | PostgreSQL adapter |

**Why These Choices?**
- pandas: Industry standard for data analysis
- scikit-learn: Comprehensive ML library
- Isolation Forest: Unsupervised anomaly detection

### DevOps Stack

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **Git** | Version control |
| **npm** | Package management |
| **tsx** | TypeScript execution |

---

## Core Components

### 1. Visitor Service (`visitorService.ts`)

**Responsibilities**:
- Create, read, update, delete (CRUD) visitor records
- Generate unique QR tokens (UUID v4)
- Manage visitor status lifecycle (registered → checked_in → checked_out)
- Trigger audit ledger entries
- Fire notification events

**Key Functions**:

```typescript
createVisitor(payload: CreateVisitorPayload): Promise<Visitor>
// Creates visitor, generates QR token, records ledger entry, sends notifications

listVisitors(options: ListVisitorsOptions): Promise<PaginatedVisitors>
// Supports pagination, filtering, search

checkInVisitor(qrToken: string): Promise<Visitor>
// Updates status to checked_in, records ledger

checkOutVisitor(qrToken: string): Promise<Visitor>
// Updates status to checked_out, records ledger

recordLedgerEntry(visitor: Visitor, event: LedgerEvent)
// Creates immutable audit trail with SHA-256 hash chaining
```

**Database Queries**:
- Uses parameterized queries (SQL injection prevention)
- Transaction support for atomic operations
- Indexed queries for performance (qr_token, status, created_at)

### 2. Notification Service (`notificationService.ts`)

**Architecture**:
- Service initializes on startup (checks env variables)
- Non-blocking async operations (fire-and-forget pattern)
- Graceful degradation (logs errors, continues operation)

**Email Component**:
```typescript
// Uses nodemailer SMTP transport
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
```

**SMS Component**:
```typescript
// Uses Twilio REST API
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
```

**Notification Triggers**:
1. **Visitor Arrival**: New registration
2. **Failed Verification**: Biometric mismatch
3. **Repeated Visits**: 5+ visits detected
4. **Suspicious Activity**: ML anomaly detection

**Email Templates**:
- Professional HTML with II-VMS branding
- Purple gradient header
- Responsive design
- Plain text fallback

### 3. Biometric Routes (`biometricRoutes.ts`)

**Integration Pattern**:
```typescript
// Proxy pattern to Python microservice
async function callBiometricService(endpoint, method, body) {
  const url = `${BIOMETRIC_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}
```

**Endpoints**:
- `POST /api/biometric/capture` - Store face encoding
- `POST /api/biometric/verify` - Match face against stored
- `GET /api/biometric/info/:visitor_id` - Check if encoding exists
- `DELETE /api/biometric/encoding/:visitor_id` - Remove biometric data

**Verification Flow**:
```
1. Frontend captures photo (base64)
2. Backend receives verify request
3. Backend proxies to Python service
4. Python service:
   - Decodes base64 image
   - Extracts face encoding
   - Compares with stored encoding
   - Returns match confidence
5. Backend receives result
6. If failed → trigger notification
7. Return result to frontend
```

### 4. Analytics Routes (`analyticsRoutes.ts`)

**Proxy Pattern**:
```typescript
// All analytics requests proxied to Python service
const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || "http://localhost:8001";

router.get("/report", async (req, res) => {
  const { days } = req.query;
  const response = await axios.get(`${analyticsServiceUrl}/analytics`, {
    params: { days },
    timeout: 30000,
  });
  res.json(response.data);
});
```

**Intelligence Features**:
1. **Peak Hour Prediction**: Linear Regression on historical data
2. **Frequent Visitor Detection**: Grouping and aggregation
3. **Anomaly Detection**: Isolation Forest algorithm
4. **Trend Analysis**: Time-series aggregation

---

## Database Architecture

### Schema Design

#### `visitors` Table
```sql
CREATE TABLE visitors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  purpose TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'registered',
  qr_token VARCHAR(255) UNIQUE NOT NULL,
  photo_url TEXT,
  checked_in_at TIMESTAMP,
  checked_out_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_visitors_qr_token ON visitors(qr_token);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_created_at ON visitors(created_at DESC);
CREATE INDEX idx_visitors_email ON visitors(email);
```

**Design Decisions**:
- `qr_token`: UUID for uniqueness, indexed for fast lookup
- `status`: Enum-like varchar for lifecycle tracking
- `timestamps`: Separate for registration vs. check-in/check-out
- `photo_url`: Optional, for future S3/CDN integration

#### `audit_ledger` Table
```sql
CREATE TABLE audit_ledger (
  id SERIAL PRIMARY KEY,
  visitor_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  hash VARCHAR(64) NOT NULL,
  prev_hash VARCHAR(64),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

-- Index for hash chain verification
CREATE INDEX idx_audit_ledger_visitor_id ON audit_ledger(visitor_id);
CREATE INDEX idx_audit_ledger_created_at ON audit_ledger(created_at DESC);
```

**Immutability Design**:
- Each entry contains SHA-256 hash of: `prev_hash + visitor_id + event_type + timestamp + data`
- Creates cryptographic chain (blockchain-inspired)
- Tamper detection: Recompute hashes, verify chain integrity
- JSONB data: Flexible storage for event metadata

#### `analytics_events` Table
```sql
CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_name ON analytics_events(name);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
```

**Purpose**: Event logging for analytics, audit trail

#### `biometric_encodings` Table (in Python service)
```sql
CREATE TABLE biometric_encodings (
  id SERIAL PRIMARY KEY,
  visitor_id INTEGER NOT NULL UNIQUE,
  encoding BYTEA NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Storage**: Binary encoding (128-dimensional face vector)

### Database Optimization

**Connection Pooling**:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Query Optimization**:
- Prepared statements (parameterized queries)
- Index usage for common filters (status, date ranges)
- Pagination with LIMIT/OFFSET
- Selective column retrieval (avoid SELECT *)

**Backup Strategy**:
```bash
# Automated daily backups
pg_dump -U postgres ii_vms > backup_$(date +%Y%m%d).sql

# Point-in-time recovery enabled
# WAL archiving configured
```

---

## Biometric System

### Face Recognition Pipeline

**1. Image Preprocessing**
```python
# Decode base64 image
image_data = base64.b64decode(photo_base64)
image = Image.open(BytesIO(image_data))

# Convert to RGB (face_recognition requirement)
image_rgb = np.array(image.convert('RGB'))

# Detect faces
face_locations = face_recognition.face_locations(image_rgb)
```

**2. Face Encoding**
```python
# Extract 128-dimensional face encoding
face_encodings = face_recognition.face_encodings(
    image_rgb,
    face_locations,
    num_jitters=1,
    model='large'  # or 'small' for speed
)

# Returns numpy array (128 floats)
encoding = face_encodings[0]
```

**3. Face Comparison**
```python
# Load stored encoding from database
stored_encoding = np.frombuffer(stored_bytes)

# Calculate face distance (Euclidean distance)
distance = face_recognition.face_distance(
    [stored_encoding],
    captured_encoding
)[0]

# Lower distance = better match
# Typical threshold: 0.6
match = distance < threshold
confidence = 1.0 - distance
```

### Model Details

**face_recognition Library**:
- Based on dlib's ResNet-based face recognition model
- Trained on ~3 million faces
- 99.38% accuracy on Labeled Faces in the Wild (LFW) benchmark
- 68-point facial landmark detection
- Works with various angles, lighting conditions

**HOG vs CNN**:
- HOG (Histogram of Oriented Gradients): Fast, CPU-friendly
- CNN (Convolutional Neural Network): More accurate, GPU-recommended
- Default: HOG for detection, CNN for encoding

### Biometric Data Security

**Storage**:
- Encodings stored as BYTEA (binary) in PostgreSQL
- Never store raw images in database
- Uploaded images can be deleted after encoding

**Privacy**:
- Encodings are one-way (cannot recreate face from encoding)
- Comply with GDPR/CCPA (right to deletion)
- Optional: Encrypt encodings at rest

**Access Control**:
- Admin-only endpoints for biometric management
- JWT authentication required
- Rate limiting on verification attempts

---

## Analytics & ML

### Machine Learning Models

#### 1. Peak Hour Prediction (Linear Regression)

**Algorithm**: scikit-learn LinearRegression

**Training Data**:
```python
# Features: Hour of day (0-23)
# Target: Visitor count
X = hourly_data[['hour']].values
y = hourly_data['count'].values

model = LinearRegression()
model.fit(X, y)

# Predict next 24 hours
predictions = model.predict(np.arange(24).reshape(-1, 1))
```

**Use Case**: Staff scheduling, resource allocation

**Accuracy**: RMSE typically < 2 visitors/hour for stable patterns

#### 2. Anomaly Detection (Isolation Forest)

**Algorithm**: scikit-learn IsolationForest

**Features**:
- `visit_count`: Total visits by visitor
- `visit_frequency`: Visits per day
- `pending_ratio`: Ratio of registered vs checked-in
- `pending_registrations`: Count of uncompleted check-ins

```python
features = df[['visit_count', 'visit_frequency', 'pending_ratio', 'pending_registrations']]

model = IsolationForest(
    contamination=0.05,  # Expect 5% anomalies
    random_state=42
)
predictions = model.fit_predict(features)
# -1 = anomaly, 1 = normal
```

**Use Case**: Security threat detection, unusual behavior patterns

**Tuning**:
- `contamination`: Adjust based on false positive rate
- `max_samples`: For large datasets
- `n_estimators`: More trees = better accuracy

#### 3. Frequent Visitor Analysis

**Algorithm**: SQL GROUP BY + pandas aggregation

```python
query = """
SELECT 
    name,
    email,
    COUNT(*) as visit_count,
    COUNT(*) / GREATEST(EXTRACT(DAY FROM (MAX(created_at) - MIN(created_at))), 1) as visit_frequency,
    MAX(created_at) as last_visit
FROM visitors
GROUP BY name, email
HAVING COUNT(*) >= %s
ORDER BY visit_count DESC
LIMIT %s
"""
```

**Metrics**:
- Visit count
- Visit frequency (visits/day)
- Last visit timestamp
- Time since first visit

### Analytics Data Pipeline

```
PostgreSQL → Python pandas → Feature Engineering → ML Models → Predictions → API Response
```

**Caching Strategy**:
- Cache analytics results for 5-10 minutes
- Invalidate on new visitor creation
- Use Redis for distributed caching (future)

---

## Notification System

### Email Notification Architecture

**SMTP Configuration**:
```javascript
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App password for Gmail
  },
  tls: {
    rejectUnauthorized: false, // For development
  },
};
```

**Template System**:
- HTML emails with embedded CSS
- Responsive design (mobile-friendly)
- Purple gradient II-VMS branding
- Plain text fallback

**Email Types**:

1. **Visitor Arrival**
   - To: Admin + Visitor
   - Content: Registration details, QR instructions
   - Priority: Normal

2. **Failed Verification**
   - To: Admin
   - Content: Visitor info, security alert
   - Priority: High

3. **Repeated Visits**
   - To: Admin
   - Content: Visit statistics, recommendation
   - Priority: Low

4. **Suspicious Activity**
   - To: Admin
   - Content: Anomaly score, detected patterns
   - Priority: Critical

### SMS Notification Architecture

**Twilio Integration**:
```javascript
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

await smsClient.messages.create({
  body: 'ALERT: Failed face verification for John Doe',
  from: process.env.TWILIO_PHONE_NUMBER,
  to: process.env.ADMIN_PHONE,
});
```

**SMS Best Practices**:
- Limit to 160 characters
- Critical alerts only (cost consideration)
- E.164 phone format (+1234567890)
- Rate limiting (prevent spam)

### Notification Reliability

**Error Handling**:
```typescript
try {
  await sendEmailNotification(...);
} catch (error) {
  console.error('Email failed:', error);
  // Log to error tracking service (Sentry)
  // Attempt fallback notification
  // Do NOT block main operation
}
```

**Retry Strategy**:
- Exponential backoff for transient failures
- Maximum 3 retry attempts
- Dead letter queue for persistent failures

**Monitoring**:
- Track notification success rate
- Alert on high failure rate
- Monitor email/SMS quota

---

## Security Implementation

### Authentication & Authorization

**JWT-Based Authentication**:
```typescript
// Generate token
const token = jwt.sign(
  { id: admin.id, email: admin.email },
  process.env.ADMIN_JWT_SECRET,
  { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '2h' }
);

// Verify token (middleware)
const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
req.admin = decoded;
```

**HTTP-Only Cookies**:
- Prevents XSS attacks
- Secure flag for HTTPS
- SameSite=Strict (CSRF protection)

**API Key Authentication**:
```typescript
// Alternative for machine-to-machine
const apiKey = req.headers['x-admin-key'];
if (apiKey !== process.env.ADMIN_API_KEY) {
  throw new HttpError(401, 'Invalid API key');
}
```

### Input Validation

**Zod Schemas**:
```typescript
const createVisitorSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  purpose: z.string().min(3).max(500),
});

// Validation
const parsed = createVisitorSchema.parse(req.body);
// Throws ZodError if invalid
```

**SQL Injection Prevention**:
```typescript
// ✅ CORRECT: Parameterized query
await pool.query(
  'SELECT * FROM visitors WHERE email = $1',
  [email]
);

// ❌ WRONG: String concatenation
await pool.query(
  `SELECT * FROM visitors WHERE email = '${email}'`
);
```

### Security Headers (Helmet)

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### CORS Configuration

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));
```

### Rate Limiting

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);

// Stricter for sensitive endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});
app.use('/api/admin/login', authLimiter);
```

### Data Encryption

**At Rest**:
- PostgreSQL: Transparent Data Encryption (TDE)
- Biometric encodings: Optionally encrypt BYTEA

**In Transit**:
- HTTPS/TLS 1.3
- Certificate from Let's Encrypt
- HSTS headers

**Secrets Management**:
- Environment variables (never commit)
- AWS Secrets Manager / HashiCorp Vault (production)
- Rotate secrets regularly (90 days)

---

## API Design

### RESTful Principles

**Resource Naming**:
- Plural nouns: `/api/visitors`, `/api/analytics`
- Hierarchical: `/api/visitors/:id/check-in`
- No verbs in URLs (use HTTP methods)

**HTTP Methods**:
- `GET`: Retrieve resource(s)
- `POST`: Create new resource
- `PUT`: Update entire resource
- `PATCH`: Partial update
- `DELETE`: Remove resource

**Status Codes**:
```
200 OK - Successful GET/PUT/PATCH
201 Created - Successful POST
204 No Content - Successful DELETE
400 Bad Request - Validation error
401 Unauthorized - Missing/invalid auth
403 Forbidden - Insufficient permissions
404 Not Found - Resource doesn't exist
409 Conflict - Business logic error
500 Internal Server Error - Server fault
503 Service Unavailable - Dependency down
```

### API Versioning

**URL Versioning** (current):
```
/api/v1/visitors
/api/v2/visitors
```

**Header Versioning** (future):
```
Accept: application/vnd.iivms.v1+json
```

### Pagination

```typescript
interface PaginationParams {
  page: number;  // 1-indexed
  limit: number; // 10-100
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

**Implementation**:
```typescript
const offset = (page - 1) * limit;
const query = `
  SELECT * FROM visitors
  ORDER BY created_at DESC
  LIMIT $1 OFFSET $2
`;
const items = await pool.query(query, [limit, offset]);
const { count } = await pool.query('SELECT COUNT(*) FROM visitors');
```

### Error Handling

**Standard Error Format**:
```json
{
  "ok": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

**Custom Error Class**:
```typescript
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
```

---

## Deployment Architecture

### Docker Compose Setup

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: ii_vms
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5434:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/db:/docker-entrypoint-initdb.d

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/ii_vms
    depends_on:
      - postgres

  biometrics:
    build:
      context: ./biometrics
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
    depends_on:
      - postgres

  analytics:
    build:
      context: ./biometrics
      dockerfile: Dockerfile.analytics
    ports:
      - "8001:8001"
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Production Deployment

**Infrastructure**:
- **Cloud Provider**: AWS / Azure / GCP
- **Compute**: ECS/EKS (AWS) or equivalent
- **Database**: RDS PostgreSQL with Multi-AZ
- **Storage**: S3 for file uploads
- **CDN**: CloudFront for static assets
- **Load Balancer**: ALB with SSL termination

**CI/CD Pipeline**:
```yaml
# GitHub Actions example
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: docker build -t backend:latest ./backend
      - run: docker push registry/backend:latest
      - run: kubectl apply -f k8s/
```

**Monitoring**:
- **APM**: Datadog / New Relic
- **Logs**: CloudWatch / ELK Stack
- **Errors**: Sentry
- **Uptime**: Pingdom / UptimeRobot

---

## Development Patterns

### Project Structure

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── routes/          # Route definitions
│   ├── middleware/      # Express middleware
│   ├── types/           # TypeScript types
│   ├── utils/           # Helper functions
│   ├── db/              # Database config
│   └── index.ts         # Application entry
├── db/                  # SQL migrations
├── tests/               # Test files
└── package.json

frontend/
├── src/
│   ├── pages/           # Route components
│   ├── components/      # Reusable components
│   ├── lib/             # Utilities
│   ├── store/           # State management
│   ├── assets/          # Images, fonts
│   └── main.jsx         # Entry point
└── package.json

biometrics/
├── main.py              # Biometric service
├── analytics.py         # Analytics engine
├── analytics_api.py     # Analytics API
├── requirements.txt
└── Dockerfile
```

### Code Style Guidelines

**TypeScript**:
- Use strict mode
- Explicit return types for functions
- Prefer `const` over `let`
- Use async/await over promises
- Destructure objects/arrays

**React**:
- Functional components only
- Hooks for state management
- PropTypes or TypeScript interfaces
- Component composition over inheritance

**Naming Conventions**:
- Files: `camelCase.ts`, `PascalCase.tsx`
- Functions: `camelCase`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Database: `snake_case`

---

## Testing Strategy

### Unit Tests

```typescript
// Example: Visitor service test
describe('VisitorService', () => {
  it('should create visitor with QR token', async () => {
    const payload = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      purpose: 'Meeting',
    };
    
    const visitor = await createVisitor(payload);
    
    expect(visitor.qrToken).toBeDefined();
    expect(visitor.status).toBe('registered');
  });
});
```

**Tools**: Jest, Vitest

### Integration Tests

```typescript
// Example: API endpoint test
describe('POST /api/visitors', () => {
  it('should return 201 and visitor object', async () => {
    const response = await request(app)
      .post('/api/visitors')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        purpose: 'Interview',
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('qrToken');
  });
});
```

**Tools**: Supertest, MSW

### E2E Tests

```typescript
// Example: Playwright test
test('visitor registration flow', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name="name"]', 'John Doe');
  await page.fill('[name="email"]', 'john@example.com');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.qr-code')).toBeVisible();
});
```

**Tools**: Playwright, Cypress

---

## Performance Optimization

### Database Optimization
- Index frequently queried columns
- Use connection pooling
- Implement query caching
- Optimize JOIN operations
- Partition large tables

### API Optimization
- Response compression (gzip)
- ETag headers for caching
- Pagination for large datasets
- Field filtering (sparse fieldsets)
- Batch operations

### Frontend Optimization
- Code splitting (React.lazy)
- Image optimization (WebP, lazy loading)
- Bundle size analysis
- Service Worker for offline support
- Debounce search inputs

---

## Troubleshooting Guide

### Common Issues

**1. Database Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Solution: Check Docker container running, correct DATABASE_URL

**2. Face Recognition Not Working**
```
Error: No faces detected in image
```
Solution: Ensure good lighting, face clearly visible, image quality

**3. Email Not Sending**
```
Error: Invalid login: 535 Authentication failed
```
Solution: Use Gmail App Password, not account password

**4. High Memory Usage (Python)**
```
Warning: Memory usage > 2GB
```
Solution: Limit concurrent face encodings, add pagination

**5. CORS Errors**
```
Access-Control-Allow-Origin missing
```
Solution: Check CORS_ORIGIN in .env matches frontend URL

---

## Appendix

### Environment Variables Reference

**Backend (.env)**:
```bash
# Server
PORT=4000
CORS_ORIGIN=http://localhost:5173
PUBLIC_BASE_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5434/ii_vms

# Authentication
ADMIN_API_KEY=your-secret-key
ADMIN_JWT_SECRET=jwt-secret
ADMIN_JWT_EXPIRES_IN=2h

# Services
BIOMETRIC_SERVICE_URL=http://localhost:8000
ANALYTICS_SERVICE_URL=http://localhost:8001

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=+1234567890
ENABLE_SMS_ALERTS=false

# Optional
UPLOAD_DIR=./uploads
GEMINI_ENABLED=false
GEMINI_API_KEY=xxx
```

### Performance Benchmarks

**API Response Times** (p95):
- GET /api/visitors: < 100ms
- POST /api/visitors: < 150ms
- POST /api/biometric/verify: < 2s
- GET /api/analytics/report: < 3s

**Throughput**:
- Visitors/hour: 500+
- Concurrent users: 100+
- Face verifications/min: 30+

### Useful Commands

```bash
# Database
docker exec -it postgres psql -U postgres -d ii_vms
\dt  # List tables
\d visitors  # Describe table

# Logs
docker-compose logs -f backend
docker-compose logs -f biometrics

# Health Checks
curl http://localhost:4000/health
curl http://localhost:8000/health
curl http://localhost:8001/health

# Database Backup
pg_dump -U postgres ii_vms > backup.sql

# Restart Services
docker-compose restart backend
docker-compose down && docker-compose up -d
```

---

**Document End**

*This knowledge base should be updated as the system evolves. For questions or clarifications, contact the development team.*
