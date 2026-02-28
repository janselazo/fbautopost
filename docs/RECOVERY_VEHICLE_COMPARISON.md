# Recovering Vehicle Comparison code

If Vehicle Comparison looked or worked differently in Vibecode and you want that version back, you can recover it by copying from Vibecode into this repo.

## Files that make up Vehicle Comparison

| Role | File path |
|------|-----------|
| **Page (title + scanner)** | `webapp/src/components/autopost/MarketIntelligencePage.tsx` |
| **Scanner UI (radius, results, filters)** | `webapp/src/components/autopost/MarketScanner.tsx` |
| **Routing (when to show it)** | `webapp/src/pages/Index.tsx` — the block where `activeView === 'market-intelligence'` |
| **Sidebar link** | `webapp/src/components/autopost/Sidebar.tsx` — nav item with `view: 'market-intelligence'`, label "Vehicle Comparison" |
| **Backend API** | `backend/src/routes/market.ts` — `POST /api/market/analyze-one` (MarketCheck only) |
| **MarketCheck helpers** | `backend/src/routes/marketcheck.ts` — `fetchMarketComps`, `isMarketCheckConfigured` |

## Option 1: Copy from Vibecode

1. Open your project in **Vibecode** (the app where Vehicle Comparison still works as you want).
2. In the file tree, open each file in the table above.
3. Copy the **full contents** of each file from Vibecode.
4. In this repo (Cursor/local), open the same file and **paste** to replace the contents. Save.

Start with:

- `MarketIntelligencePage.tsx` — small; defines the Vehicle Comparison page.
- `MarketScanner.tsx` — large; defines the scan UI, filters, and calls to `/api/market/analyze-one`.

Then, if the Vibecode app has different routing or sidebar entries, copy:

- The `market-intelligence` block from `Index.tsx`.
- The "Vehicle Comparison" item from `Sidebar.tsx` (inside the `navGroups` "Inventory" section).

Backend (only if Vibecode had a different analyze-one or MarketCheck flow):

- The `analyze-one` handler in `backend/src/routes/market.ts`.
- Any changes in `backend/src/routes/marketcheck.ts`.

## Option 2: Compare Vibecode vs this repo

1. In Vibecode, open `MarketIntelligencePage.tsx` and `MarketScanner.tsx`.
2. In Cursor, open the same files under `webapp/src/components/autopost/`.
3. Compare (or diff) the two versions and paste over any sections you want from Vibecode.

## Option 3: Git (if you have another clone or branch)

If the “original” Vehicle Comparison code was in a different branch or another clone:

```bash
# List branches
git branch -a

# See an old version of a file (replace COMMIT with a hash from git log)
git show COMMIT:webapp/src/components/autopost/MarketScanner.tsx

# Restore that file from that commit
git checkout COMMIT -- webapp/src/components/autopost/MarketScanner.tsx
```

Your current repo only has a couple of commits, so older versions may exist only in Vibecode or another copy of the repo.

## What this repo has right now

- **Vehicle Comparison** is the view with title “Vehicle Comparison”, subtitle “Real-time competitor analysis… Powered by MarketCheck.”
- It renders **MarketScanner**: radius selector (50–750 mi), HOT DEAL / WORTH POSTING / SKIP filters, and results from `POST /api/market/analyze-one`.
- The backend uses **MarketCheck only** (no OpenAI) for that endpoint; `MARKETCHECK_API_KEY` must be set in `backend/.env`.

If something in Vibecode looked or behaved differently, use Option 1 or 2 to copy those versions into the files above.
