# Privacy Policy for CloudSight Enterprise

**Effective Date:** February 20, 2026

## 1. Introduction
CloudSight Enterprise ("we", "our", or "us") is a browser extension designed to help you monitor cloud costs. We are committed to protecting your privacy and ensuring the security of your data.

## 2. Data Collection
**We do not collect, transmit, or store your personal data on our servers.**

All information (API keys, billing data, cost metrics) is processed locally on your device within the browser extension environment.

## 3. Data Storage
Your Cloud Provider credentials (API Keys, Client IDs, Service Account JSONs) are:
1.  **Encrypted** using AES-GCM encryption before storage.
2.  **Stored Locally** using the `chrome.storage.local` API.
3.  **Never Transmitted** to us or any third-party analytics service.

## 4. Third-Party Services
The extension communicates directly and exclusively with the following official Cloud Provider APIs to fetch your cost data:
*   **AWS Cost Explorer API** (`*.amazonaws.com`)
*   **Azure Cost Management API** (`management.azure.com`)
*   **Google Cloud Billing API** (`cloudbilling.googleapis.com`)

We do not use any third-party tracking, analytics, or advertising services.

## 5. User Consent
By installing and using CloudSight Enterprise, you consent to the local processing of your data as described in this policy. You may uninstall the extension at any time to remove all stored data from your browser.

## 6. Contact
For questions regarding this privacy policy, please contact us via the Chrome Web Store support page.
