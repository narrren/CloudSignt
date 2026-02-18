import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand }
    from "@aws-sdk/client-cost-explorer";

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
    const data = await chrome.storage.local.get("awsCreds");
    if (!data.awsCreds) return;

    try {
        const awsData = await fetchAWS(data.awsCreds);

        // Check for Alerts
        checkBudgets(awsData);

        // Save to Storage
        chrome.storage.local.set({
            dashboardData: awsData,
            lastUpdated: new Date().toISOString()
        });

    } catch (err) {
        console.error("API Fetch Failed", err);
    }
}

// 3. AWS Implementation
async function fetchAWS(creds) {
    const client = new CostExplorerClient({
        region: "us-east-1", // Cost Explorer is global but endpoint is usually us-east-1
        credentials: {
            accessKeyId: creds.accessKeyId,
            secretAccessKey: creds.secretAccessKey
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

// 4. Budget Alert Logic
function checkBudgets(data) {
    const BUDGET_LIMIT = 500.00; // You can make this user-configurable in options

    if (data.totalCost > BUDGET_LIMIT) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Budget Exceeded!',
            message: `Current spend is $${data.totalCost.toFixed(2)}, exceeding limit of $${BUDGET_LIMIT}.`
        });
    }
}
