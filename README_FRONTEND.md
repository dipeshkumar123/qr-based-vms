# II-VMS - Intelligent, Integrated Visitor Management System

A modern, secure visitor management system with QR-based check-ins, identity verification, and real-time analytics.

## Project Overview

II-VMS transforms traditional visitor management by providing a seamless, contactless, and intelligent experience. It's designed for offices, institutions, research facilities, and gated premises that require enhanced security and efficient visitor tracking.

## Key Features

- 🔐 **Enhanced Security** - Identity verification and tamper-proof blockchain-based audit trails
- 📱 **Contactless Check-in** - QR code based seamless entry with instant notifications
- 📊 **Real-time Analytics** - AI-powered insights and visitor pattern analysis
- ⚡ **Lightning Fast** - Instant registration and check-in process
- 🔔 **Smart Notifications** - Automated alerts for hosts
- 💼 **Professional** - Modern interface for enterprise environments

## Project Structure

```
QR_Based_VMS/
├── backend/          # Node.js + Express + PostgreSQL API
├── frontend/         # React + Vite + Tailwind frontend
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Backend: http://localhost:4000
# Frontend: http://localhost:5173
```

### Manual Setup

#### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure your database and ADMIN_API_KEY in .env
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend (.env)

```env
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/iivms
ADMIN_API_KEY=your-secure-admin-key
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your-gemini-api-key (optional)
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:4000
```

## API Documentation

### Public Endpoints

- `POST /api/visitors` - Register a new visitor
- `GET /health` - Health check

### Admin Endpoints (require x-admin-key header)

- `POST /api/admin/verify` - Verify admin credentials
- `GET /api/visitors` - List all visitors
- `GET /api/visitors/:token` - Get visitor by QR token
- `POST /api/visitors/:token/check-in` - Check in a visitor
- `DELETE /api/visitors/:id` - Delete a visitor
- `GET /api/ledger` - View audit ledger

### AI & Analytics

- `POST /api/ai/generate` - Generate AI insights (if Gemini API configured)
- `POST /api/analytics/events` - Record analytics events

## User Flows

### Visitor Flow

1. Visit the registration page
2. Fill out personal details and purpose
3. Receive QR code via email
4. Present QR code at entry for check-in

### Admin Flow

1. Login with admin key
2. View dashboard with visitor statistics
3. Monitor real-time check-ins
4. Review audit ledger
5. Manage visitor records

## Tech Stack

### Backend

- Node.js + Express
- PostgreSQL with connection pooling
- TypeScript
- Zod for validation
- Blockchain-inspired audit ledger

### Frontend

- React 19
- Vite
- Tailwind CSS
- Framer Motion
- React Router
- Zustand
- Axios

## Security Features

- Admin key-based authentication
- Tamper-proof audit ledger with hash chaining
- Input validation with Zod
- CORS protection
- SQL injection prevention
- Environment-based configuration

## Development

### Backend Development

```bash
cd backend
npm run dev        # Start with hot reload
npm run build      # Build TypeScript
npm start          # Run production build
```

### Frontend Development

```bash
cd frontend
npm run dev        # Start dev server
npm run build      # Production build
npm run preview    # Preview production build
```

## Database Schema

### Visitors Table

- id (serial primary key)
- name (text)
- email (text)
- phone (text)
- purpose (text)
- status (enum: registered, checked_in)
- qr_token (uuid)
- created_at (timestamp)
- updated_at (timestamp)

### Audit Ledger Table

- id (serial primary key)
- visitor_id (integer)
- hash (text)
- prev_hash (text, nullable)
- created_at (timestamp)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

## Support

For issues and questions, please open a GitHub issue or contact support@ii-vms.com.
