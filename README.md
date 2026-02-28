# AutoPost — Multi-Platform Marketplace for Car Dealers

A premium dealership CRM tool that helps car salesmen manage their vehicle inventory and auto-generate posts for Facebook Marketplace, Facebook Groups, and Craigslist.

## Local development (Cursor)

To run the app locally (e.g. in Cursor) and connect to your own backend:

**Prerequisites**

- Open the terminal and go to the **project root** (the folder that contains both `backend` and `webapp`). For example:
  ```bash
  cd /Users/janse/Documents/GitHub/fbautopost
  ```
  Or in Cursor: **File → Open Folder** and choose the `fbautopost` folder, then open the terminal there.
- **Bun** is required. If you see `command not found: bun`, install it (macOS/Linux):
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
  Then close and reopen the terminal (or run `source ~/.zshrc`). Check with `bun --version`.

1. **Clone and install** — From the repo root, run `bun install` in both `backend/` and `webapp/`. Then run `bun install` once in the repo root (for the `dev` script).
2. **Environment** — Copy `backend/.env.example` to `backend/.env` and `webapp/.env.example` to `webapp/.env`. Fill in your Supabase URL, anon key, and JWT secret (see [Authentication](#authentication)); add optional keys for MarketCheck, Stripe, or OpenAI as needed.
3. **Start both servers** — From the **repo root** run:
   ```bash
   bun run dev
   ```
   This starts the backend (port 3000) and webapp (port 8000) in one terminal. Or start them in two terminals: from `backend/` run `bun run dev`, then from `webapp/` run `bun run dev`.
4. **Open the app** — In your browser go to **http://localhost:8000**. The app will use the local backend via the Vite proxy; no need to set `VITE_BACKEND_URL` for local dev.

**Troubleshooting: "vite: command not found" or "localhost refused to connect"**

If the webapp fails to start (e.g. `vite: command not found` in the terminal), the webapp dependencies are not installed. Install them, then start again:

```bash
cd /Users/janse/Documents/GitHub/fbautopost/webapp
bun install
cd /Users/janse/Documents/GitHub/fbautopost
bun run dev
```

Ensure you have run `bun install` in **both** `backend/` and `webapp/` at least once (and in the repo root for the `dev` script).

## Pushing to GitHub

Commit and push as usual. Do **not** commit `.env` (it is in `.gitignore`). Use `.env.example` as a template; each developer or clone creates their own `.env` from it. If `.env` was ever committed in the past, rotate any exposed secrets (Supabase, Stripe, API keys) and remove the file from the repo (e.g. `git rm --cached backend/.env webapp/.env` then commit).

## Authentication

The app uses **Supabase** for authentication (frontend and backend).

- Frontend: Supabase client (`@supabase/supabase-js`) sends an OTP to the user's email and issues a JWT access token on sign-in.
- Backend: The Hono backend verifies the Supabase JWT via `SUPABASE_JWT_SECRET`. All API requests from the frontend include `Authorization: Bearer <token>`.
- If no token is present (or `SUPABASE_JWT_SECRET` is not configured), the backend falls back to `userId = "default"` for single-user mode.

### Adding the Supabase JWT Secret
1. Go to your Supabase Dashboard → Project Settings → API
2. Copy the **JWT Secret** value
3. Add it to `backend/.env`: `SUPABASE_JWT_SECRET=<your-jwt-secret>`

## MarketCheck Dealership Integration

The "Connect Inventory" module pulls real dealership inventory and market comparables from the **MarketCheck API**.

### Setup
1. Get a MarketCheck API key at [marketcheck.com](https://www.marketcheck.com/api/)
2. Add `MARKETCHECK_API_KEY=your_key_here` to `backend/.env` (or your ENV tab if using Vibecode)
3. Go to **Connect Inventory** in the app and search for your dealership

### How It Works
1. **Search** — Dealer lookup via `GET /api/marketcheck/dealers?q=<name or website>`
2. **Inventory** — Pull full dealer inventory via `GET /api/marketcheck/inventory?dealer_id=<id>`
3. **Market Comps** — For each vehicle, fetch competing listings via `GET /api/marketcheck/comps?year=&make=&model=&latitude=&longitude=`
4. **Score** — Competitive scoring engine rates each car Hot / Decent / Skip based on price vs. market avg, mileage, supply count, and days on lot
5. **Post** — One-click flow copies fields + AI description → Facebook Marketplace

### Backend Routes (`/api/marketcheck/`)
- `GET /api/marketcheck/dealers` — Search dealerships (no auth required)
- `GET /api/marketcheck/inventory` — Get dealer's vehicle listings (no auth required)
- `GET /api/marketcheck/comps` — Get market comparables for a vehicle (no auth required)

All routes return `{ data: ... }` on success or `{ error: { message, code } }` on failure. If the API key is not configured, returns `503` with code `MARKETCHECK_NOT_CONFIGURED`.

## Chrome Extension (DealerPost Pro)

A Chrome extension that auto-fills Facebook Marketplace vehicle listing forms directly from the web app.

**Location:** `/chrome-extension/` directory
**Download:** Available at `/chrome-extension.zip` (served from webapp public folder)

### Setup Flow
1. Go to **Settings → Extension** in the web app
2. Download the extension ZIP and load it in Chrome (Developer Mode → Load Unpacked)
3. In the extension popup, enter the backend URL
4. Click **Generate Pairing Code** in the app → enter the 6-digit code in the extension
5. Click **Post to FB** on any vehicle → extension polls for the session and auto-fills FB Marketplace

### Backend API (extension-specific endpoints)
- `POST /api/extension/pairing-code` — Auth required. Generates a 6-digit code valid for 10 minutes
- `POST /api/extension/pair` — No auth. Extension submits code to link to user account
- `POST /api/extension/posting-session` — Auth required. Creates a session with vehicle data + post text
- `GET /api/extension/posting-session/latest?userId=...` — No auth. Returns latest pending session for userId
- `POST /api/extension/posting-session/:id/complete` — No auth. Marks session as posted

## App Flow

1. **Connect Dealership** — First-time users are prompted to connect their dealership via MarketCheck API
2. **Connect Facebook** — Link your Facebook account to enable direct posting to Marketplace
3. **Dashboard** — After connecting, view Hot Deals that should be posted immediately, along with inventory stats
4. **Inventory** — Browse all connected inventory with competitive scoring labels (Hot, Decent, Skip)
5. **Post to Marketplace** — One-click posting flow with AI-generated descriptions

## Features

- **Connect Inventory (MarketCheck API Integration)** — Connect to your dealership inventory automatically via MarketCheck's database of 45,000+ US dealerships. Features include:
  - Dealer search by name or website
  - Automatic inventory pull from MarketCheck API
  - Competitive market scanning (100+ listings per vehicle within 100mi)
  - AI-powered competitive scoring (Hot Deal, Decent, Skip)
  - One-click Facebook Marketplace posting flow
  - AI-generated listing descriptions
- **Facebook Integration** — Connect your Facebook account to:
  - Post vehicles directly to Facebook Marketplace
  - Manage connection status from Dashboard and Settings
  - View connected account details and page information
  - Refresh tokens and manage permissions
- **Smart Dashboard** — Shows Hot Deals prioritized at the top with posting recommendations, plus Facebook connection status
- **Dealership Inventory Table** — All vehicles with tier labels, competitive scores, and one-click posting
- **Multi-Platform Post Composer** — Select a vehicle, choose platforms (Facebook Marketplace, Facebook Groups, Craigslist), pick a template, customize hashtags and pricing display
- **3 Post Templates**: Premium Listing, Quick Sale, and Feature Highlight
- **Post History** — Track all posted, scheduled, and draft listings with timestamps and platform info
- **Marketplace Integrations (Settings)** — Connect and manage multiple platforms including:
  - Facebook Marketplace (OAuth integration)
  - Facebook Groups (select groups to post to)
  - Craigslist (region-based posting)

## Tech Stack

- React + Vite (port 8000)
- TypeScript
- TailwindCSS + shadcn/ui
- Lucide React icons
- Fonts: Bebas Neue (headings) + DM Sans (body)
- **Backend**: Hono + Bun (port 3000)
- **Database**: SQLite with Prisma ORM
- **Auth**: Better Auth with Email OTP

## Design

Industrial/premium automotive aesthetic — dark charcoal (#0d0d0f) background with warm amber/gold accents. Feels like a Bloomberg terminal crossed with a luxury car brochure.

## App Structure

```
src/
  pages/
    Index.tsx                    — Main app shell with view routing + FacebookProvider + DealershipProvider
  components/
    autopost/
      types.ts                   — TypeScript types, sample data, post generation logic
      DealershipContext.tsx      — Context for sharing connected dealer data across views
      FacebookContext.tsx        — Context for Facebook integration state (connect/disconnect/token management)
      ConnectInventory.tsx       — MarketCheck API integration + dealership connection flow
      DealershipInventoryTable.tsx — Inventory table with tier labels and posting
      DashboardView.tsx          — Dashboard with Hot Deals section + Facebook connect CTA
      SettingsView.tsx           — Settings with full Facebook integration module
      Sidebar.tsx                — Left navigation sidebar
      PostComposer.tsx           — Facebook post composer + live preview
      PostHistory.tsx            — Post history grid
```

## Notes

- **Authentication**: Users sign in with email OTP (one-time password). The app is protected and requires login.
- **Facebook Integration**: Currently uses a mock OAuth flow for demo purposes. For production:
  - Add Facebook App credentials via the ENV tab
  - Implement real OAuth callback in the backend
  - Store access tokens securely in the database
- Marketplace posting is simulated/mocked — clicking "POST" shows a success toast and adds to history. Real integrations would require:
  - **Facebook**: Graph API credentials via the ENV tab
  - **Craigslist**: Manual posting (no official API) or third-party services
- Vehicle data is stored per-user in the SQLite database.
