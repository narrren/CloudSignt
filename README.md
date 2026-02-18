# CloudSight

CloudSight project repository: Cloud Command Center Chrome Extension.

## Overview
A "Pro-Grade" Chrome Extension that visualizes **AWS, Azure, and Google Cloud (GCP)** Costs securely using official SDKs and direct API integrations.

## Features
- **Multi-Cloud Support**:
  - **AWS**: via Cost Explorer SDK (SigV4).
  - **Azure**: via Cost Management REST API (OAuth).
  - **GCP**: via Cloud Billing API (Signed JWTs).
- **Secure Credentials Storage**: Access keys and Service Principals are stored locally and encrypted.
- **Background Fetching**: Uses `chrome.alarms` to fetch data every 6 hours.
- **Cost Visualization**: Unified dashboard aggregating costs from all providers.
- **Budget Alerts**: Global threshold notifications.

## Installation

### Prerequisites
- Node.js and npm installed.

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/narrren/CloudSignt.git
   cd CloudSight
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
   This will generate a `dist/` folder containing the extension.

### Loading into Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the `dist/` folder inside the `CloudSight` project directory.
5. The extension "Cloud Command Center" should appear.

## Configuration
1. Click the extension icon and go to **Options**.
2. **AWS**: Enter Access Key ID and Secret Access Key (Read Only permissions required).
3. **Azure**: Enter Tenant ID, Client ID, Client Secret, and Subscription ID (Service Principal with Cost Management Reader role).
4. **GCP**: Paste the full JSON content of your Service Account Key (Billing Viewer role) and your Billing Account ID.
5. Save. The extension will fetch and aggregate data in the background.
