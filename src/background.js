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

// 2. Main Fetch Logic
async function fetchAllData() {
    const result = await chrome.storage.local.get("cloudCreds");
    const creds = result.cloudCreds || {};

    // use Promise.allSettled to allow partial failures
    const results = await Promise.allSettled([
        creds.aws?.key ? fetchAWS(creds.aws) : Promise.reject("AWS Not Configured"),
        creds.azure?.client ? fetchAzureCost(creds.azure) : Promise.reject("Azure Not Configured"),
        creds.gcp?.json ? fetchGCPCost(creds.gcp) : Promise.reject("GCP Not Configured")
    ]);

    // Extract data safely
    const awsData = results[0].status === 'fulfilled' ? results[0].value : { totalCost: 0, error: true };
    const azureData = results[1].status === 'fulfilled' ? results[1].value : { totalCost: 0, error: true };
    const gcpData = results[2].status === 'fulfilled' ? results[2].value : { totalCost: 0, error: true };

    const combined = {
        aws: awsData,
        azure: azureData,
        gcp: gcpData,
        // Only sum up valid numbers
        totalGlobal: (awsData.totalCost || 0) + (azureData.totalCost || 0) + (gcpData.totalCost || 0),
        lastUpdated: new Date().toISOString()
    };

    // Check Budgets (Global Limit)
    const GLOBAL_LIMIT = 1000;
    if (combined.totalGlobal > GLOBAL_LIMIT) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Global Budget Exceeded!',
            message: `Total spend is $${combined.totalGlobal.toFixed(2)}`
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

    const [costResponse, forecastResponse] = await Promise.all([
        client.send(costCommand),
        client.send(forecastCommand)
    ]);

    return {
        provider: 'AWS',
        totalCost: calculateTotal(costResponse),
        services: processServices(costResponse),
        forecast: forecastResponse.Total.Amount,
        unit: forecastResponse.Total.Unit
    };
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
