# DealerPost Pro Chrome Extension

Auto-fills Facebook Marketplace vehicle listing forms from your DealerPost dashboard.

## Install (Developer Mode)

1. Open **chrome://extensions/**
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `chrome-extension/` folder

## Setup

1. Open the extension popup (click the DP icon in Chrome)
2. Enter your backend server URL (from your DealerPost app settings)
3. Go to **Settings -> Extension** in DealerPost and click **Generate Pairing Code**
4. Enter the 6-digit code in the extension popup and click **Pair Extension**

## How It Works

1. Click **Post to FB** on any vehicle in your DealerPost dashboard
2. A posting session is created in the backend
3. The extension detects it (polling every 6s) and shows a badge
4. Click the extension icon -> **Open FB Marketplace & Auto-Fill**
5. A new tab opens at facebook.com/marketplace/create/vehicle
6. The extension auto-fills all fields (year, make, model, price, mileage, color, VIN, description)
7. Review the listing and click **Publish** yourself

## Generating Icons

Run `python3 package.sh` to generate icons and create a ZIP file.
