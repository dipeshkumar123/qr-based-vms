# 🚀 Quick Start Guide - II-VMS

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running
- Backend configured and running on port 4000

## 1. Start Backend (if not running)

```powershell
cd backend
npm install
# Configure .env file with DATABASE_URL and ADMIN_API_KEY
npm run dev
```

Backend should be running at: http://localhost:4000

## 2. Start Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend will be available at: http://localhost:5173

## 3. Access the Application

### For Visitors
1. Open http://localhost:5173
2. Click **"Register as Visitor"**
3. Fill out the form
4. Receive your QR token

### For Admins
1. Open http://localhost:5173
2. Click **"Admin Login"**
3. Enter your admin key (from backend .env ADMIN_API_KEY)
4. Access the dashboard

## 4. Test the Flow

### Visitor Registration
- Navigate to `/register`
- Fill: Name, Email, Phone, Purpose
- Submit and get QR token

### Admin Dashboard
- Login at `/admin/login`
- View visitor stats
- Check in visitors
- View audit ledger
- Search and filter

## Environment Setup

### Backend `.env`
```env
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/iivms
ADMIN_API_KEY=your-secure-admin-key-here
CORS_ORIGIN=http://localhost:5173
```

### Frontend `.env`
```env
VITE_API_BASE_URL=http://localhost:4000
```

## Default Credentials

**Admin Key**: Set in backend `.env` as `ADMIN_API_KEY`

## Troubleshooting

❌ **Cannot connect to backend**
- Check backend is running on port 4000
- Verify CORS_ORIGIN is set correctly

❌ **Admin login fails**
- Verify ADMIN_API_KEY matches in backend .env
- Check browser console for errors

❌ **Styles not loading**
- Clear browser cache
- Restart dev server
- Check Tailwind config

## Features to Try

✅ Visitor self-registration
✅ Admin authentication
✅ Real-time dashboard stats
✅ Visitor search and filter
✅ Check-in functionality
✅ Audit ledger viewing
✅ Responsive design (try mobile view)
✅ Smooth animations

## URLs

- **Landing Page**: http://localhost:5173/
- **Register**: http://localhost:5173/register
- **Admin Login**: http://localhost:5173/admin/login
- **Dashboard**: http://localhost:5173/admin/dashboard (requires auth)

## Production Build

```powershell
cd frontend
npm run build
npm run preview
```

Build output will be in `frontend/dist/`

---

**Enjoy the new II-VMS frontend! 🎉**
