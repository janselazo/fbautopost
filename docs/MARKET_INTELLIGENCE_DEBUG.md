# Market Intelligence not working — what to send for debugging

To fix “Market Intelligence still is not working,” the following information is very helpful.

---

## 1. What you see on screen

- Do you see **“No available vehicles to analyze”**? (Then the app has no vehicles with status “Available”.)
- Do you see a **red error box**? If yes, **copy the full error text** (or send a screenshot).
- Do you see **“No analysis results”** (empty state with Radar icon)? (Then the backend likely didn’t return any results.)
- Or something else (e.g. loading forever, blank page)? Describe it briefly.

---

## 2. Browser console (Network + Console)

- Open DevTools (F12 or right‑click → Inspect) → **Console** tab. Any **red errors**? Copy the message (or screenshot).
- In DevTools → **Network** tab, refresh and open **Market Intelligence** again. Find a request to **`analyze-one`** (or **`/api/market/analyze-one`**). Click it and tell me:
  - **Status code** (e.g. 200, 400, 503).
  - **Response** body (Preview or Response tab): copy the JSON or the `error.message` if present.

---

## 3. Backend terminal

- When you run the backend (`bun run dev` from repo root or `cd backend && bun run dev`), what appears in the terminal when you open Market Intelligence and it runs?
- Any **red errors** or lines containing `MarketCheck` or `analyze-one`? Copy those lines.

---

## 4. Checklist (you can just answer yes/no)

- Backend is running (e.g. you see “Listening on port 3000” or similar).
- In **`backend/.env`** you have a line: **`MARKETCHECK_API_KEY=...`** (with your real key, no quotes).
- You **restarted the backend** after adding or changing `MARKETCHECK_API_KEY`.
- You’re opening the app at **http://localhost:8000** (or the URL Vite shows) and clicking **Vehicle Comparison** (or Market Intelligence) in the sidebar.

---

## 5. Code that’s already in place (no need to send unless you changed it)

- **Frontend:** `webapp/src/components/autopost/MarketIntelligencePage.tsx` and `webapp/src/components/autopost/MarketScanner.tsx` — they call `GET/POST` to `/api/market/analyze-one` via `getBackendUrl()`.
- **Backend:** `backend/src/routes/market.ts` (analyze-one) and `backend/src/routes/marketcheck.ts` (fetchMarketComps, isMarketCheckConfigured). Analyze-one uses **MarketCheck only** (no OpenAI).

If you changed any of these files, you can paste the changed file (or the relevant part) so we can compare.

---

**Summary:** The most useful things to send are: **(1) the exact error message from the red box or empty state**, **(2) the `analyze-one` response status and body from the Network tab**, and **(3) any backend terminal errors** when you open Market Intelligence.
