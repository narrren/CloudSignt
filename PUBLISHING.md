# How to Publish "Cloud Command Center"

This guide covers three methods of "publishing" your extension, depending on your goal.

---

## Method 1: Local Installation (For You & Developers)
**Best for:** Testing, developing, and personal use.

1.  **Build the Project**:
    Open your terminal in the project folder and run:
    ```bash
    npm run build
    ```
    This creates the `dist/` folder.

2.  **Open Chrome Extensions**:
    In Google Chrome, navigate to: `chrome://extensions/`

3.  **Enable Developer Mode**:
    Toggle the switch in the top-right corner to **ON**.

4.  **Load Unpacked**:
    Click the **Load unpacked** button (top-left).
    Select the **`CloudSight/dist`** folder on your computer.

5.  **Pin It**:
    Click the puzzle piece icon in your Chrome toolbar and pin "Cloud Command Center".

---

## Method 2: Create a .CRX File (For Internal Sharing)
**Best for:** Sharing with a few colleagues without using the store.

1.  **Go to Chrome Extensions**:
    Navigate to `chrome://extensions/` with Developer Mode ON.

2.  **Pack Extension**:
    Click the **Pack extension** button at the top.

3.  **Select Directory**:
    - **Extension root directory**: Browse and select your `CloudSight/dist` folder.
    - **Private key file**: Leave this blank for the first time.

4.  **Create**:
    Click **Pack Extension**.

5.  **Result**:
    Chrome will generate two files in the parent folder (outside `dist`):
    - `dist.crx` (The installer file).
    - `dist.pem` (Your private key). **KEEP THIS SAFE.**

6.  **Install on another machine**:
    Drag and drop the `.crx` file onto the `chrome://extensions/` page of another browser.

---

## Method 3: Publish to the Chrome Web Store (Official)
**Best for:** Public distribution to the world.

### Prerequisites
- A Google Account.
- A Developer Account ($5 one-time fee).
- A zipped copy of your build (I created `CloudCommandCenter.zip` for you).

### Steps

1.  **Register**:
    Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/dev/dashboard) and register.

2.  **Create New Item**:
    Click **+ New Item**.

3.  **Upload**:
    Drag and drop the `CloudCommandCenter.zip` file (which contains the contents of `dist/`).

4.  **Store Listing Metadata**:
    You will need to fill out:
    - **Description**: Detailed explanation of features (Cloud Cost Management, AWS/Azure/GCP support, etc.).
    - **Category**: "Developer Tools" or "Productivity".
    - **Screenshots**: You must upload at least one screenshot (1280x800) of your popup/dashboard.
    - **Icon**: Upload the 128x128 icon (you can find `icon.png` in `src/`).

5.  **Privacy Practices (Critical)**:
    Since this extension handles "Financial and Payment Information" (Cloud Costs) and uses "Authentication Credentials", you must declare this:
    - **Permissions**: Explain why you need `storage` (to save settings) and `alarms` (background fetching).
    - **Data Usage**: Certify that you do **not** collect or sell user data. Everything is stored locally.

6.  **Submit for Review**:
    Click **Submit for Review**. Google usually takes 24-48 hours to review extensions.
