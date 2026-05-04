# MenuWebAR — Route 66 Digital Menu with AR

A React + Express digital restaurant menu for **Route 66** (Santiago, Chile) featuring Augmented Reality food visualization. Customers can browse the menu, preview dishes in 3D, and project them onto their table using AR.

## Features

- 📱 **Responsive digital menu** — Browse categories, items, and prices on any device
- 🥽 **AR visualization** — View 3D dish models and project them onto your table via WebXR
- 📅 **Reservations** — Book a table with date/time/zone selection, sent via WhatsApp
- 🔐 **Admin dashboard** — Full CRUD for menu items and categories with JWT authentication
- ⚡ **Loading skeletons** — Smooth perceived performance while data loads

## Tech Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Frontend | React 18, React Router 7, CSS Modules                 |
| Backend  | Express 5, Node.js                                    |
| AR       | Google Model Viewer (WebXR, Scene Viewer, Quick Look) |
| Auth     | JWT + bcrypt                                          |
| Build    | Vite 5                                                |
| Testing  | Vitest, Testing Library, Supertest                    |
| Linting  | ESLint 9, Prettier                                    |

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install --legacy-peer-deps
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable                    | Description                             | Required   |
| --------------------------- | --------------------------------------- | ---------- |
| `JWT_SECRET`                | Secret for signing JWT tokens           | Production |
| `ADMIN_DEFAULT_EMAIL`       | Initial admin email                     | First run  |
| `ADMIN_DEFAULT_PASSWORD`    | Initial admin password                  | First run  |
| `PORT`                      | Server port (default: 3001)             | No         |
| `SUPABASE_URL`              | Supabase project URL (backend API)      | Yes        |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend API) | Yes        |

The API reads/writes menu data only from Supabase.
If backend Supabase variables are missing, data routes return `503` until configured.

### Running Locally

```bash
# Start both frontend and backend
npm run dev:full

# Or run separately:
npm run dev       # Vite dev server on :5173
npm run server    # Express API on :3001
```

Open http://localhost:5173 for the menu, or http://localhost:5173/admin for the admin panel.

### Building for Production

```bash
npm run build
npm run server    # Serves both API and static files from dist/
```

## Project Structure

```
├── index.html                  # Entry HTML
├── vite.config.js              # Vite + Vitest configuration
├── eslint.config.js            # ESLint flat config
├── Dockerfile                  # Production container
├── .env.example                # Environment variable template
│
├── server/
│   ├── server.js               # Express API (auth, CRUD, health check)
│   ├── data/
│   │   ├── menu.json           # Legacy local data file (not used as API data source)
│   │   ├── admin.json          # Admin credentials (auto-generated)
│   │   └── supabase-schema.sql # SQL schema for Supabase tables
│   └── __tests__/
│       └── server.test.js      # API endpoint tests
│
├── src/
│   ├── main.jsx                # React entry with Router + ErrorBoundary
│   ├── App.jsx                 # Main layout, menu fetching, skeleton loading
│   ├── globals.css             # CSS variables and base styles
│   ├── config/
│   │   └── restaurant.js       # Centralized restaurant configuration
│   ├── components/
│   │   ├── Header.jsx          # Sticky navbar
│   │   ├── Footer.jsx          # Contact, hours, map, socials
│   │   ├── CategoryTabs.jsx    # Menu category tabs
│   │   ├── MenuSection.jsx     # Menu items grid
│   │   ├── MenuCard.jsx        # Item card with 3D/AR modal
│   │   ├── MenuCardSkeleton.jsx # Loading skeleton
│   │   ├── ReservationSection.jsx # Booking form → WhatsApp
│   │   ├── DirectARViewer.jsx  # Full-screen AR viewer (/ar/:itemId)
│   │   └── ErrorBoundary.jsx   # React error boundary
│   ├── admin/
│   │   ├── AdminDashboard.jsx  # Admin CRUD panel
│   │   ├── AdminLogin.jsx      # Login form
│   │   └── api.js              # Admin API client
│   └── test/
│       ├── setup.js            # Test setup (jest-dom)
│       ├── CategoryTabs.test.jsx
│       ├── ErrorBoundary.test.jsx
│       └── restaurant.config.test.js
│
└── public/assets/
    ├── IMG/                    # Menu item images
    ├── modelosAR/              # 3D GLB models for AR
    └── references/             # Logo and brand assets
```

## API Endpoints

### Public

| Method | Endpoint          | Description     |
| ------ | ----------------- | --------------- |
| GET    | `/api/health`     | Health check    |
| GET    | `/api/menu`       | Full menu data  |
| GET    | `/api/categories` | Categories list |
| GET    | `/api/menu-items` | All menu items  |

### Authentication

| Method | Endpoint           | Description          |
| ------ | ------------------ | -------------------- |
| POST   | `/api/auth/login`  | Login (rate-limited) |
| GET    | `/api/auth/verify` | Verify JWT token     |

### Admin (requires Bearer token)

| Method | Endpoint                    | Description     |
| ------ | --------------------------- | --------------- |
| GET    | `/api/admin/categories`     | List categories |
| POST   | `/api/admin/categories`     | Create category |
| PUT    | `/api/admin/categories/:id` | Update category |
| DELETE | `/api/admin/categories/:id` | Delete category |
| GET    | `/api/admin/items`          | List items      |
| POST   | `/api/admin/items`          | Create item     |
| PUT    | `/api/admin/items/:id`      | Update item     |
| DELETE | `/api/admin/items/:id`      | Delete item     |
| PUT    | `/api/admin/password`       | Change password |

## AR Model Requirements

- Format: **GLB** (binary glTF)
- Recommended size: under 5 MB for fast mobile loading
- Place files in `public/assets/modelosAR/`
- Reference in menu items as `/assets/modelosAR/filename.glb`

## Scripts

| Script               | Description               |
| -------------------- | ------------------------- |
| `npm run dev`        | Start Vite dev server     |
| `npm run server`     | Start Express API server  |
| `npm run dev:full`   | Start both concurrently   |
| `npm run build`      | Production build          |
| `npm run lint`       | Run ESLint                |
| `npm run lint:fix`   | Run ESLint with auto-fix  |
| `npm run format`     | Format code with Prettier |
| `npm run test`       | Run tests                 |
| `npm run test:watch` | Run tests in watch mode   |

## Docker Deployment

```bash
docker build -t menuwebar .
docker run -p 3001:3001 \
  -e JWT_SECRET=your-strong-secret \
  -e ADMIN_DEFAULT_EMAIL=admin@restaurant.com \
  -e ADMIN_DEFAULT_PASSWORD=your-password \
  menuwebar
```

## License

Private project — all rights reserved.
