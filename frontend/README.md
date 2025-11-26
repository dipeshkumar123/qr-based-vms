# II-VMS Frontend

Modern React frontend for the Intelligent, Integrated Visitor Management System.

## Features

- 🎨 Modern UI with Tailwind CSS
- ⚡ Fast development with Vite
- 🎭 Smooth animations with Framer Motion
- 🔐 Admin authentication
- 📱 Fully responsive design
- 🎯 Visitor registration with QR code generation
- 📊 Admin dashboard with analytics

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend server running on port 4000

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:4000
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Route pages
│   ├── lib/            # API client and utilities
│   ├── store/          # State management (Zustand)
│   ├── App.jsx         # Main app component
│   └── main.jsx        # Entry point
├── public/             # Static assets
└── index.html          # HTML template
```

## Pages

- **Landing Page** (`/`) - Homepage with features and CTA
- **Visitor Registration** (`/register`) - Self-service registration form
- **Admin Login** (`/admin/login`) - Admin authentication
- **Admin Dashboard** (`/admin/dashboard`) - Visitor management and analytics

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Router** - Client-side routing
- **Zustand** - Lightweight state management
- **Axios** - HTTP client

## Key Features

### For Visitors
- Simple registration form
- Instant QR code generation
- Email confirmation

### For Admins
- Secure key-based authentication
- Real-time visitor list
- Check-in management
- Audit ledger view
- Search and filter functionality

## Design Philosophy

The UI is inspired by modern platforms like Coursera and Udemy, featuring:
- Clean, professional design
- Smooth animations and transitions
- Gradient accents
- Accessible color contrast
- Mobile-first responsive layout
- Intuitive navigation

## API Integration

The frontend communicates with the backend API at `http://localhost:4000/api`:

- `POST /api/visitors` - Register new visitor
- `GET /api/visitors` - List all visitors (admin)
- `POST /api/visitors/:token/check-in` - Check in visitor (admin)
- `DELETE /api/visitors/:id` - Delete visitor (admin)
- `GET /api/ledger` - View audit ledger (admin)
- `POST /api/admin/verify` - Verify admin key

## Contributing

1. Follow the existing code style
2. Use meaningful component and variable names
3. Add comments for complex logic
4. Test on multiple screen sizes

## License

MIT

