import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand }
    from "@aws-sdk/client-cost-explorer";
import { fetchAzureCost } from "./azureService";
import { fetchGCPCost } from "./gcpService";

// 1. Setup Alarm (Check cost every 6 hours)
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("fetchCloudCosts", { periodInMinutes: 360 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "fetchCloudCosts") fetchAllData();
});

// Added: Listen for manual refresh from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "FORCE_REFRESH") {
        fetchAllData().then(() => {
            // Optional: send response back if needed
        });
    }
});

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
async function fetchAllData() {
    const result = await chrome.storage.local.get(["cloudCreds", "encryptedCreds", "currency"]);

    // cloudCreds may be stored as null (not undefined) when encryption is enabled
    let creds = result.cloudCreds || null;
    const currency = result.currency || 'USD';
    const rate = RATES[currency] || 1.0;

    // Handle Encrypted credentials
    if (!creds && result.encryptedCreds) {
        try {
            creds = await decryptData(result.encryptedCreds);
        } catch (e) {
            console.error("Decryption failed in background", e);
            // Surface a clear error to the dashboard instead of silently failing
            chrome.storage.local.set({
                dashboardData: {
                    decryptionError: true,
                    errorMessage: 'Credential decryption failed. Please re-save your credentials in Settings.',
                    lastUpdated: new Date().toISOString(),
                    currency,
                    rate,
                    totalGlobal: 0,
                    aws: { totalCost: 0, error: true },
                    azure: { totalCost: 0, error: true },
                    gcp: { totalCost: 0, error: true }
                }
            });
            return;
        }
    }

    // If still no creds after decryption attempt, nothing is configured
    if (!creds || (!creds.aws?.key && !creds.azure?.client && !creds.gcp?.json)) {
        chrome.storage.local.set({
            dashboardData: {
                notConfigured: true,
                lastUpdated: new Date().toISOString(),
                currency,
                rate,
                totalGlobal: 0,
                aws: { totalCost: 0, error: true },
                azure: { totalCost: 0, error: true },
                gcp: { totalCost: 0, error: true }
            }
        });
        return;
    }


    // use Promise.allSettled to allow partial failures
    const results = await Promise.allSettled([
        creds.aws?.key ? fetchAWS(creds.aws) : Promise.reject("AWS Not Configured"),
        creds.azure?.client ? fetchAzureCost(creds.azure) : Promise.reject("Azure Not Configured"),
        creds.gcp?.json ? fetchGCPCost(creds.gcp) : Promise.reject("GCP Not Configured")
    ]);

    // Extract data safely — capture error reason for display
    const awsData = results[0].status === 'fulfilled'
        ? results[0].value
        : { totalCost: 0, error: true, errorMsg: String(results[0].reason?.message || results[0].reason || 'Unknown error') };
    const azureData = results[1].status === 'fulfilled'
        ? results[1].value
        : { totalCost: 0, error: true, errorMsg: String(results[1].reason?.message || results[1].reason || 'Unknown error') };
    const gcpData = results[2].status === 'fulfilled'
        ? results[2].value
        : { totalCost: 0, error: true, errorMsg: String(results[2].reason?.message || results[2].reason || 'Unknown error') };

    // Convert to User's Currency
    const convert = (val) => val * rate;

    const combined = {
        aws: awsData,
        azure: azureData,
        gcp: gcpData,
        totalGlobal: convert((awsData.totalCost || 0) + (azureData.totalCost || 0) + (gcpData.totalCost || 0)),
        lastUpdated: new Date().toISOString(),
        currency: currency,
        rate: rate // Store rate so popup knows
    };

    // Check Budgets (Limit converted approx to $1000 USD)
    const GLOBAL_LIMIT = 1000 * rate;

    if (combined.totalGlobal > GLOBAL_LIMIT) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: `Global Budget Exceeded!`,
            message: `Total spend is ${currency} ${combined.totalGlobal.toFixed(2)}`
        });
    }

    // Anomalies (AWS only for now)
    if (combined.aws && combined.aws.anomaly && combined.aws.anomaly.isAnomaly) {
        // Note: Anomaly numbers are in USD inside the AWS object.
        // We should convert them for the message
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'AWS Cost Spike Detected!',
            message: `Yesterday's spend (${currency} ${convert(combined.aws.anomaly.today).toFixed(2)}) is >3x higher than average.`
        });
    }

    chrome.storage.local.set({ dashboardData: combined });
}

// 3. AWS Implementation
async function fetchAWS(creds) {
    const client = new CostExplorerClient({
        region: "us-east-1", // Cost Explorer is global but endpoint is usually us-east-1
        credentials: {
            accessKeyId: creds.key,
            secretAccessKey: creds.secret
        }
    });

    // A. Get Current Month Costs + Service Breakdown
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString().split('T')[0];

    const costCommand = new GetCostAndUsageCommand({
        TimePeriod: { Start: firstDay, End: tomorrow },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
    });

    // B. Get Forecast
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    const forecastCommand = new GetCostForecastCommand({
        TimePeriod: { Start: tomorrow, End: lastDayOfMonth },
        Metric: "UNBLENDED_COST",
        Granularity: "MONTHLY"
    });

    const [costResponse, forecastResponse, historyResponse] = await Promise.all([
        client.send(costCommand),
        client.send(forecastCommand),
        fetchAWSHistory(client)
    ]);

    const anomaly = detectAnomaly(historyResponse);

    // Process History for Charting
    const history = historyResponse.ResultsByTime.map(r => ({
        date: r.TimePeriod.Start,
        cost: parseFloat(r.Total.UnblendedCost.Amount)
    }));

    return {
        provider: 'AWS',
        totalCost: calculateTotal(costResponse),
        services: processServices(costResponse),
        forecast: forecastResponse.Total.Amount,
        unit: forecastResponse.Total.Unit,
        anomaly: anomaly,
        history: history
    };

}

async function fetchAWSHistory(client) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14); // 2 weeks history

    const command = new GetCostAndUsageCommand({
        TimePeriod: { Start: start.toISOString().split('T')[0], End: end.toISOString().split('T')[0] },
        Granularity: "DAILY",
        Metrics: ["UnblendedCost"]
    });
    return client.send(command);
}

function detectAnomaly(historyResponse) {
    const dailyCosts = historyResponse.ResultsByTime.map(r => parseFloat(r.Total.UnblendedCost.Amount));
    if (dailyCosts.length < 3) return null;

    // Last day is "today" or "yesterday", let's check the most recent complete day
    const latestCost = dailyCosts[dailyCosts.length - 1];
    const previousCosts = dailyCosts.slice(0, dailyCosts.length - 1);

    // Calculate Average
    const sum = previousCosts.reduce((a, b) => a + b, 0);
    const avg = sum / previousCosts.length;

    // Simple Spike Detection (3x Average)
    if (latestCost > (avg * 3) && latestCost > 1.0) { // Ignore small amounts
        return { isAnomaly: true, today: latestCost, average: avg };
    }
    return null;
}

// Helper: Process AWS JSON into Chart.js format
function processServices(response) {
    // AWS returns an array of services. Sort by cost and take top 5.
    const groups = response.ResultsByTime[0].Groups;
    return groups
        .map(g => ({ name: g.Keys[0], amount: parseFloat(g.Metrics.UnblendedCost.Amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5); // Top 5 services
}

function calculateTotal(response) {
    // Sum up all groups
    return response.ResultsByTime[0].Groups
        .reduce((acc, curr) => acc + parseFloat(curr.Metrics.UnblendedCost.Amount), 0);
}
