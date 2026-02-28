# ☁️ CloudSight — Multi-Cloud FinOps Intelligence Platform

<p align="center">
  <strong>Real-time multi-cloud cost dashboard running entirely in your browser.</strong><br/>
  AWS · Azure · GCP — unified, encrypted, serverless.
</p>

---

## Overview

CloudSight is a **Manifest V3 Chrome Extension** that aggregates and visualizes cloud costs from **AWS, Azure, and GCP** in a single, secure dashboard. It runs entirely client-side with no backend — credentials never leave your browser.

## ✨ Features

### Multi-Cloud Cost Tracking
- **AWS** — Cost Explorer SDK (SigV4 authentication)
- **Azure** — Cost Management + Consumption APIs (OAuth client credentials), with automatic API fallback
- **GCP** — Cloud Billing API (signed JWTs)

### FinOps Intelligence Engine
- **Unified Cost Schema** — Provider-agnostic normalization engine (`costEngine.js`)
- **Anomaly Detection** — Z-score based spike detection across all providers
- **Forecasting** — Linear regression burn-rate projection with month-end spend estimates
- **Root Cause Analysis** — Attributes cost spikes to specific services and providers
- **FinOps Health Score** — Composite risk metric based on volatility, concentration, and growth momentum
- **AI Insights** — Rule-based insight generation with severity classification

### Dashboard & Analytics
- **Cost Trend Chart** — Interactive Chart.js graph with 1D / 7D / 30D / 60D / 90D time ranges
- **Provider Distribution** — Donut visualization with per-provider spend percentages
- **Top Services Breakdown** — Ranked service costs across all providers
- **Budget Tracking** — Real-time budget utilization with visual progress ring
- **Provider Health Monitor** — Latency, error rate, and status for each cloud integration

### Security & Architecture
- **AES-GCM Encryption** — Optional at-rest encryption for stored credentials (Web Crypto API)
- **Zero Backend** — Fully client-side; no data sent to external servers
- **Background Sync** — Service worker fetches costs every 6 hours via `chrome.alarms`
- **Multi-Currency** — Display costs in USD, EUR, GBP, INR, or JPY with automatic conversion
- **90-Day History** — Rolling historical data persistence for longitudinal analytics

---

## 🚀 Installation

### Developer Mode (Recommended)

```bash
git clone https://github.com/narrren/CloudSight.git
cd CloudSight
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist/` folder

### From ZIP

1. Download the latest release ZIP
2. Extract it
3. Load the extracted folder via **Load unpacked** in Chrome

---

## ⚙️ Configuration

1. Click the CloudSight extension icon → **Settings** (or navigate to the Options page)
2. Set your preferred **currency** and **monthly budget**
3. Enter credentials for your cloud providers:

### AWS Setup
- Create an IAM user with the **`AWSCostExplorerReadOnlyAccess`** policy
- Enter the **Access Key ID** and **Secret Access Key**

### Azure Setup
1. Go to **Microsoft Entra ID** → **App registrations** → **New registration**
2. Create a **Client Secret** under **Certificates & secrets**
3. Go to **Subscriptions** → your subscription → **Access control (IAM)**
4. Assign the **"Cost Management Reader"** role to your App Registration
5. Enter the **Subscription ID**, **Tenant ID**, **Client ID**, and **Client Secret** in CloudSight

### GCP Setup
- Create a Service Account with **Billing Viewer** role
- Generate a JSON key and paste it in CloudSight

4. Click **Save Configuration** — CloudSight will fetch your costs automatically

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────┬───────────────┬───────────────────────────┤
│  popup.js   │ dashboard.js  │       options.js          │
│  (Quick     │ (Full         │       (Settings &         │
│   View)     │  Dashboard)   │        Credentials)       │
├─────────────┴───────────────┴───────────────────────────┤
│                 background.js (Service Worker)           │
│         ┌──────────┬──────────┬──────────┐              │
│         │  AWS SDK │  Azure   │  GCP JWT │              │
│         │  (SigV4) │  (OAuth) │  (SA)    │              │
│         └────┬─────┴────┬─────┴────┬─────┘              │
│              └──────────┼──────────┘                     │
│                    orchestrator.js                        │
│         ┌──────────────────────────────────┐             │
│         │  costEngine → anomalyEngine →    │             │
│         │  forecastEngine → insightEngine  │             │
│         │  → rootCauseEngine → finopsMetrics│            │
│         │  → historyEngine                 │             │
│         └──────────────────────────────────┘             │
│                  chrome.storage.local                    │
│              (AES-GCM encrypted optional)                │
└─────────────────────────────────────────────────────────┘
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `orchestrator.js` | Central data pipeline — fetches, normalizes, analyzes, stores |
| `costEngine.js` | Provider-agnostic cost normalization with USD conversion |
| `anomalyEngine.js` | Z-score based anomaly detection |
| `forecastEngine.js` | Linear regression forecasting with burn rate |
| `insightEngine.js` | Rule-based insight generation |
| `rootCauseEngine.js` | Cost spike attribution analysis |
| `finopsMetricsEngine.js` | Composite FinOps health scoring |
| `historyEngine.js` | 90-day rolling history persistence |
| `authManager.js` | Multi-account credential management |
| `cryptoUtils.js` | AES-GCM encryption/decryption utilities |

---

## 🔧 Troubleshooting

### AWS: "GetCostAndUsage" Access Denied
Your IAM user needs the `ce:GetCostAndUsage` permission.
1. Go to **AWS IAM Console** → **Users** → your user
2. **Add Permissions** → Attach **`AWSCostExplorerReadOnlyAccess`**

> **Root User Note:** Enable "IAM User and Role Access to Billing Information" in Account Settings.

### Azure: "Microsoft.CostManagement/Query/read" Access Denied
1. Go to **Azure Portal** → **Subscriptions** → your subscription
2. Click **Access control (IAM)** → **Add role assignment**
3. Assign **"Cost Management Reader"** to your App Registration
4. Wait 5–10 minutes for propagation

> **Tip:** If searching for your app returns no results, your App Registration may not have a Service Principal. Run `az ad sp create --id <your-client-id>` in Azure Cloud Shell.

> **Directory Mismatch:** Ensure your App Registration is in the same Azure AD tenant as your subscription.

### Azure: Automatic API Fallback
CloudSight automatically tries the **Consumption API** if the Cost Management API is denied. The Consumption API works with just the **"Reader"** role. If both fail, ensure your Service Principal has at least "Reader" on the subscription.

---

## 📁 Project Structure

```
CloudSight/
├── src/
│   ├── background.js          # Service worker (data fetching, alarms)
│   ├── dashboard.html/js      # Full analytics dashboard
│   ├── popup.html/js          # Quick-view popup
│   ├── options.html/js        # Settings & credential management
│   ├── orchestrator.js        # Central data pipeline
│   ├── costEngine.js          # Cost normalization engine
│   ├── anomalyEngine.js       # Anomaly detection
│   ├── forecastEngine.js      # Spend forecasting
│   ├── insightEngine.js       # AI insight generation
│   ├── rootCauseEngine.js     # Spike attribution
│   ├── finopsMetricsEngine.js # FinOps health scoring
│   ├── historyEngine.js       # Historical data persistence
│   ├── authManager.js         # Multi-account auth
│   ├── cryptoUtils.js         # AES-GCM encryption
│   ├── awsService.js          # AWS Cost Explorer integration
│   ├── azureService.js        # Azure Cost Management integration
│   ├── gcpService.js          # GCP Billing integration
│   ├── manifest.json          # Chrome Extension manifest (V3)
│   └── styles.css             # Tailwind entry point
├── webpack.config.js          # Build configuration
├── tailwind.config.js         # Tailwind CSS config
├── package.json               # Dependencies
├── PRIVACY_POLICY.md          # Privacy policy
└── ROADMAP.md                 # Strategic roadmap
```

---

## 🛡️ Privacy

CloudSight is fully client-side. No data is transmitted to any server other than the official cloud provider APIs (AWS, Azure, GCP). Credentials are stored locally in `chrome.storage.local` with optional AES-GCM encryption. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
