# CloudSight Enterprise - Project Digest

**Project Name:** CloudSight Enterprise  
**Version:** 1.2 (Production Ready)  
**Type:** Chrome Extension (Manifest V3)  
**Description:** A comprehensive Multi-Cloud Cost Management Dashboard for AWS, Azure, and GCP.

---

## 🚀 Project Overview

CloudSight Enterprise is a secure browser extension designed to give DevOps engineers and managers a real-time "Single Pane of Glass" view of their cloud expenditures. It connects directly to cloud provider APIs to fetch running costs, forecasts them, and alerts user on budget overruns.

### Key Capabilities
1.  **Multi-Cloud Aggregation**: View AWS, Azure, and GCP costs in one currency.
2.  **Real-Time Data**: Fetches live data from cloud APIs (Cost Explorer, RateCard, Billing).
3.  **Secure & Private**: 
    *   Credentials are encrypted (AES-GCM) and stored locally (`chrome.storage`). 
    *   **No external servers**: Data goes directly from your browser to AWS/Azure/GCP.
4.  **Current Status**: 🟡 Pending AWS Permissions (User needs to attach policy)
**Last Action**: Verified background logic and added "Test Connection" button.
**Next Steps**:
1. User attaches `AWSCostExplorerReadOnlyAccess` in AWS Console.
2. User verifies connection in Extension Options.
3. Final dashboard verification.hboard**:
    *   **Cost Trend Analysis**: Visual chart of daily spending.
    *   **Provider Distribution**: Breakdown of cost by provider.
    *   **Top Services**: List of most expensive services.
    *   **Alert System**: Visual and popup alerts for connection failures or budget overruns.

---

## 🛠 Technology Stack

*   **Core**: HTML5, Vanilla JavaScript (ES6+)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Utility-first framework)
*   **Build Tool**: [Webpack 5](https://webpack.js.org/) (Production Optimized)
*   **Minification**: [Terser Plugin](https://webpack.js.org/plugins/terser-webpack-plugin/) (Code shrinking & console log removal)
*   **Charts**: [Chart.js](https://www.chartjs.org/) (Data visualization)
*   **Icons**: Google Material Symbols + Custom Assets
*   **Assets Generation**: Python (Pillow) automation

---

## 📂 File Structure

```text
CloudSight/
├── dist/                   # Production build output (Ready for Store)
│   ├── assets/             # Generated icons (16, 32, 48, 128) & tiles
│   ├── background.bundle.js
│   ├── dashboard.bundle.js
│   ├── options.bundle.js
│   ├── dashboard.html
│   └── ...
├── src/                    # Source code
│   ├── assets/             # Raw image assets & master.png
│   ├── background.js       # Background Service Worker (API fetching, Data processing)
│   ├── dashboard.js        # Dashboard UI logic (Charts, Alerts)
│   ├── dashboard.html      # Main Dashboard View
│   ├── options.js          # Settings Page logic (Credential saving, Encryption)
│   ├── cryptoUtils.js      # Encryption helper functions
│   ├── input.css           # Tailwind source CSS
│   └── styles.css          # Global styles
├── generate_assets.py      # Python script to generate store assets
├── manifest.json           # Chrome Extension Manifest V3 (Strict CSP)
├── webpack.config.js       # Production Webpack config
├── tailwind.config.js      # Tailwind configuration
└── package.json            # Scripts: build, zip, assets
```

---

## 🔌 Architecture & Security

1.  **Configuration**: User enters API Creds in `options.html`.
2.  **Encryption**: Creds are encrypted via `cryptoUtils.js` before saving.
3.  **Data Fetching**:
    *   `background.js` uses `chrome.alarms` to fetch data every 6 hours.
    *   **Strict CSP**: Manifest prevents unauthorized script execution.
4.  **Visualization**:
    *   `dashboard.js` renders charts.
    *   **Modal Alerts**: Custom styled modal for system alerts replacing browser popups.

---

## 💻 Installation & Build Guide

### Prerequisites
*   Node.js (v14+)
*   Python (for asset generation)

### 1. Setup
```bash
npm install
pip install pillow
```

### 2. Generate Assets
Place your logo at `src/assets/master.png` and run:
```bash
npm run assets
```
This generates all required icons and store tiles.

### 3. Build & Package
To create a clean, minimized production zip:
```bash
npm run zip
```
*   Compiles `src/` into `dist/` (Minified, No Console Logs).
*   Creates `CloudSight-v1.0.zip` ready for Chrome Web Store upload.

---

## ✨ Production Updates (v1.2)
*   **Store Compliance**: Valid `manifest.json`, optimized assets, and extensive permission justification.
*   **Code Hygiene**: All debug logs (`console.log`) stripped automatically via Terser.
*   **Privacy Policy**: Hosted at `https://narrren.github.io/CloudSight/privacy.html`.
*   **User Onboarding**: Auto-opens Options page on installation.
*   **Alert System**: Replaced native alerts with a responsive Modal UI.

## ⚠️ Troubleshooting
*   **"No Data Found"**: Ensure credentials are correct in Settings.
*   **Build Errors**: Run `npm install` to ensure `terser-webpack-plugin` is present.

---
**Maintained by:** Naren Dey
