# CloudSight

CloudSight project repository: Cloud Command Center Chrome Extension.

## Overview
A "Pro-Grade" Chrome Extension that visualizes AWS Cloud Costs securely using the official AWS SDK and Chart.js.

## Features
- **Secure Credentials Storage**: Access keys are stored locally and encrypted.
- **Background Fetching**: Uses `chrome.alarms` to fetch data every 6 hours.
- **Cost Visualization**: Interactive charts using Chart.js.
- **Budget Alerts**: Notifications when spending exceeds a threshold.

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

## Usage
1. Click the extension icon and go to **Options** (right-click -> Options, or via the extensions page details).
2. Enter your AWS Read-Only credentials.
3. Save. The extension will fetch data in the background.
4. Open the popup to view your cloud costs and forecast.
