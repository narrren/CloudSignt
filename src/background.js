import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand }
    from "@aws-sdk/client-cost-explorer";
import { fetchAzureCost } from "./azureService";
import { fetchGCPCost } from "./gcpService";

// 1. Setup Alarm (Check cost every 6 hours)
chrome.runtime.onInstalled.addListener((details) => {
    // Set daily schedule
    chrome.alarms.create("fetchCloudCosts", { periodInMinutes: 360 });

    // Open Options Page on Install
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.runtime.openOptionsPage();
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "fetchCloudCosts") fetchAllData();
});

// Added: Listen for manual refresh from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "FORCE_REFRESH") {
        fetchAllData().then(() => {
            sendResponse({ status: "done" });
        });
        return true; // Keep channel open
    }
    if (message.action === "TEST_CONNECTION") {
        testConnection(message.creds).then(result => sendResponse(result));
        return true;
    }
});

async function testConnection(creds) {
    let results = { success: true, errors: [] };

    if (creds.aws && creds.aws.key) {
        try {
            await fetchAWS(creds.aws);
        } catch (e) {
            results.success = false;
            results.errors.push(`AWS: ${e.message}`);
        }
    }

    if (creds.azure && creds.azure.clientId) {
        try {
            await fetchAzureCost(creds.azure);
        } catch (e) {
            results.success = false;
            results.errors.push(`Azure: ${e.message}`);
        }
    }

    if (creds.gcp && creds.gcp.json) {
        try {
            await fetchGCPCost(creds.gcp);
        } catch (e) {
            results.success = false;
            results.errors.push(`GCP: ${e.message}`);
        }
    }

    return results;
}

import { decryptData } from './cryptoUtils';

// Hardcoded Exchange Rates (Base USD) - In V2, fetch from API
const RATES = {
    'USD': 1.0,
    'EUR': 0.93,
    'GBP': 0.79,
    'INR': 83.5,
    'JPY': 150.2
};

// 2. Main Fetch Logic
// 2. Main Fetch Logic
async function fetchAllData() {
    const result = await chrome.storage.local.get(["cloudCreds", "encryptedCreds", "currency", "budgetLimit"]);

    const currency = result.currency || 'USD';
    const budgetLimit = result.budgetLimit || 1000;
    const rate = RATES[currency] || 1.0;

    // cloudCreds may be stored as null (not undefined) when encryption is enabled
    let creds = result.cloudCreds || null;

    // Decrypt if necessary
    if (!creds && result.encryptedCreds) {
        try {
            creds = await decryptData(result.encryptedCreds);
        } catch (e) {
            console.error("Background: Decryption failed", e);
            // Cannot proceed without creds
            return;
        }
    }

    if (!creds) {
        console.log("Background: No credentials found.");
        return;
    }

    let dashboardData = {
        lastUpdated: new Date().toISOString(),
        currency: currency,
        rate: rate,
        budgetLimit: budgetLimit,
        totalGlobal: 0,
        aws: null,
        azure: null,
        gcp: null
    };

    // --- AWS ---
    if (creds.aws && creds.aws.key) {
        try {
            const awsData = await fetchAWS(creds.aws);
            dashboardData.aws = awsData;
            dashboardData.totalGlobal += awsData.totalCost;
        } catch (e) {
            console.error("AWS Fetch Error:", e);
            dashboardData.aws = { error: e.message };
        }
    }

    // --- Azure ---
    if (creds.azure && creds.azure.clientId) {
        try {
            const azureData = await fetchAzureCost(creds.azure);
            dashboardData.azure = azureData;
            dashboardData.totalGlobal += azureData.totalCost;
        } catch (e) {
            console.error("Azure Fetch Error:", e);
            dashboardData.azure = { error: e.message };
        }
    }

    // --- GCP ---
    if (creds.gcp && creds.gcp.json) {
        try {
            const gcpData = await fetchGCPCost(creds.gcp);
            dashboardData.gcp = gcpData;
            dashboardData.totalGlobal += gcpData.totalCost;
        } catch (e) {
            console.error("GCP Fetch Error:", e);
            dashboardData.gcp = { error: e.message };
        }
    }

    // Save to Storage
    await chrome.storage.local.set({ dashboardData: dashboardData });
    return dashboardData;
}

// 3. AWS Implementation
async function fetchAWS(creds) {
    if (!creds.key || !creds.secret) {
        throw new Error('AWS credentials missing (key or secret is empty)');
    }

    const client = new CostExplorerClient({
        region: "us-east-1",
        credentials: {
            accessKeyId: creds.key.trim(),
            secretAccessKey: creds.secret.trim()
        }
    });

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    // ── A. Current month cost (critical — throw on failure) ───────────────
    let costResponse;
    try {
        costResponse = await client.send(new GetCostAndUsageCommand({
            TimePeriod: { Start: firstDay, End: tomorrow },
            Granularity: "MONTHLY",
            Metrics: ["UnblendedCost"],
            GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
        }));
    } catch (e) {
        const msg = e?.message || e?.name || String(e);
        throw new Error(msg);
    }

    // ── B. Forecast (optional — new accounts often lack enough data) ──────
    let forecastTotal = '0';
    try {
        if (tomorrow <= lastDay) {
            const fr = await client.send(new GetCostForecastCommand({
                TimePeriod: { Start: tomorrow, End: lastDay },
                Metric: "UNBLENDED_COST",
                Granularity: "MONTHLY"
            }));
            forecastTotal = fr.Total?.Amount || '0';
        }
    } catch (e) {
        // console.warn('AWS Forecast skipped (normal for new accounts):', e?.message);
    }

    // ── C. 14-day daily history (optional) ───────────────────────────
    let history = [];
    try {
        const histStart = new Date();
        histStart.setDate(histStart.getDate() - 14);
        const hr = await client.send(new GetCostAndUsageCommand({
            TimePeriod: { Start: histStart.toISOString().split('T')[0], End: todayStr },
            Granularity: "DAILY",
            Metrics: ["UnblendedCost"]
        }));
        history = (hr.ResultsByTime || []).map(r => ({
            date: r.TimePeriod.Start,
            cost: parseFloat(r.Total?.UnblendedCost?.Amount || 0)
        }));
    } catch (e) {
        // console.warn('AWS history skipped:', e?.message);
    }

    return {
        provider: 'AWS',
        totalCost: calculateTotal(costResponse),
        services: processServices(costResponse),
        forecast: forecastTotal,
        anomaly: detectAnomaly(history),
        history: history
    };
}


function detectAnomaly(history) {
    // history is now a plain array of { date, cost }
    if (!history || history.length < 3) return null;
    const dailyCosts = history.map(h => h.cost);
    const latestCost = dailyCosts[dailyCosts.length - 1];
    const previousCosts = dailyCosts.slice(0, dailyCosts.length - 1);
    const avg = previousCosts.reduce((a, b) => a + b, 0) / previousCosts.length;
    if (latestCost > (avg * 3) && latestCost > 1.0) {
        return { isAnomaly: true, today: latestCost, average: avg };
    }
    return null;
}

function processServices(response) {
    const results = response?.ResultsByTime;
    if (!results || results.length === 0) return [];
    const groups = results[0]?.Groups || [];
    return groups
        .map(g => ({ name: g.Keys[0], amount: parseFloat(g.Metrics.UnblendedCost.Amount) }))
        .filter(s => s.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
}

function calculateTotal(response) {
    const results = response?.ResultsByTime;
    if (!results || results.length === 0) return 0;
    const groups = results[0]?.Groups || [];
    return groups.reduce((acc, curr) => acc + parseFloat(curr.Metrics.UnblendedCost.Amount), 0);
}
