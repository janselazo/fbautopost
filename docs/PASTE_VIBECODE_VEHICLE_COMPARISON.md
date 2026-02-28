# Paste from Vibecode to fix Vehicle Comparison (Compare button)

If the section after clicking **Compare** is not working, you can copy code from the Vibecode app so we match the working behavior.

## What to paste from Vibecode

**1. Compare flow (recommended)**  
In Vibecode, open the file that handles the Vehicle Comparison screen (often something like `VehicleComparisonPage.tsx`, `VehicleComparison.tsx`, or a page under a “market” / “comparison” folder). Copy and paste here:

- The **function that runs when the user clicks the Compare button** (e.g. `runCompare`, `handleCompare`, or the `onClick` handler). Include the full function and how it calls the API (URL, query params, how it reads the response).
- If the API response shape is different (e.g. the comps/listings are under a different key like `data.results` instead of `data.listings`), paste the **part where the response is used** (e.g. `setState` or variables that hold the comps/listings).

**2. API / backend URL**  
If Vibecode uses a different base URL or env variable for the backend (e.g. `VITE_API_URL`, `VITE_BACKEND_URL`, or a hardcoded host), paste:

- The line(s) where the **base URL** or **API base** is defined.
- The **exact URL or path** used for the “comps” or “compare” request (e.g. `/api/market/compare`, `/api/marketcheck/comps`, or full URL).

**3. Full component (if easier)**  
Alternatively, paste the **entire Vehicle Comparison component** from Vibecode (the one that contains the Compare button and the results section). Then we can align our component with it (API calls, state, and rendering).

## What was fixed on our side

- **Error handling:** Compare now shows a clear error message if the request fails, VIN decode fails, or the backend returns an error (e.g. missing `MARKETCHECK_API_KEY`).
- **Response shape:** We accept both `json.data` and a top-level `json` for comps, and we normalize `listings` so different backend shapes still work.
- **Empty state:** If the backend returns no listings, we show “No listings found” instead of a blank section.
- **Safety:** We use `.catch(() => ({}))` on `res.json()` and guard against missing `data`/`listings`/`stats` so the UI doesn’t crash.

## Quick checks

1. **Backend running** – Start the backend (e.g. `bun run dev` from repo root or `cd backend && bun run dev`). It should listen on port 3000.
2. **MarketCheck key** – In `backend/.env` set `MARKETCHECK_API_KEY=your_key` and restart the backend.
3. **Browser** – After clicking Compare, open DevTools → **Network**, find the request to `vin-decode` or `comps`. Check the **status code** and **Response** body. Paste the status and a copy of the response (or the `error.message` if present) so we can match Vibecode or fix the backend.

Once you paste the Compare handler (and optionally the API URL or full component) from Vibecode, we can mirror that behavior here so the section after Compare works the same way.
