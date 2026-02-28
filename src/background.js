import { decryptData } from './cryptoUtils';
import { orchestrateFetch } from './orchestrator';
import { fetchAWSRaw } from "./awsService";
import { fetchAzureCost } from "./azureService";
import { fetchGCPCost } from "./gcpService";

// 1. Setup Alarm
chrome.runtime.onInstalled.addListener((details) => {
    chrome.alarms.create("fetchCloudCosts", { periodInMinutes: 360 });
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.runtime.openOptionsPage();
    }
    // Clear stale data on extension update to pick up code fixes
    if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
        chrome.storage.local.remove(['dashboardData', 'normalizedCostData'], () => {
            console.log("[CloudSight] Cleared stale data after update");
            fetchAllData();
        });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "fetchCloudCosts") fetchAllData();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "FORCE_REFRESH") {
        // Clear old data first, then fetch fresh
        chrome.storage.local.remove(['dashboardData'], () => {
            fetchAllData().then(() => sendResponse({ status: "done" })).catch(() => sendResponse({ status: "error" }));
        });
        return true;
    }
    if (message.action === "TEST_CONNECTION") {
        testConnection(message.creds).then(result => sendResponse(result));
        return true;
    }
});

async function testConnection(creds) {
    let results = { success: true, errors: [] };
    if (creds.aws && creds.aws.key) {
        try { await fetchAWSRaw(creds.aws); }
        catch (e) { results.success = false; results.errors.push(`AWS: ${e.message}`); }
    }
    if (creds.azure && creds.azure.clientId) {
        try { await fetchAzureCost(creds.azure); }
        catch (e) { results.success = false; results.errors.push(`Azure: ${e.message}`); }
    }
    if (creds.gcp && creds.gcp.json) {
        try { await fetchGCPCost(creds.gcp); }
        catch (e) { results.success = false; results.errors.push(`GCP: ${e.message}`); }
    }
    return results;
}

const RATES = { 'USD': 1.0, 'EUR': 0.93, 'GBP': 0.79, 'INR': 83.5, 'JPY': 150.2 };

async function fetchAllData() {
    const result = await chrome.storage.local.get(["cloudAccounts", "cloudCreds", "encryptedCreds", "currency", "budgetLimit", "historicalCostData"]);
    const currency = result.currency || 'USD';
    const budgetLimit = result.budgetLimit || 1000;
    const rate = RATES[currency] || 1.0;
    const existingHistory = result.historicalCostData || [];

    let creds = result.cloudAccounts || result.cloudCreds || null;
    if (!creds && result.encryptedCreds) {
        try { creds = await decryptData(result.encryptedCreds); }
        catch (e) { console.error("Decryption failed", e); return; }
    }
    if (!creds) { console.log("No credentials found."); return; }

    console.log("[CloudSight BG] Credentials found:", {
        hasAws: !!(creds.aws && (Array.isArray(creds.aws) ? creds.aws.length : creds.aws.key)),
        hasAzure: !!(creds.azure && (Array.isArray(creds.azure) ? creds.azure.length : creds.azure.clientId)),
        hasGcp: !!(creds.gcp && (Array.isArray(creds.gcp) ? creds.gcp.length : creds.gcp.json))
    });

    try {
        const { dashboardData, normalizedCostData, updatedHistory } = await orchestrateFetch(creds, existingHistory, currency, rate, budgetLimit);

        console.log("[CloudSight BG] Orchestration complete:", {
            totalGlobal: dashboardData.totalGlobal,
            awsOk: !!(dashboardData.aws && !dashboardData.aws.error),
            awsError: dashboardData.aws?.error || 'none',
            azureOk: !!(dashboardData.azure && !dashboardData.azure.error),
            azureError: dashboardData.azure?.error || 'none',
            normalizedCount: normalizedCostData.length,
            historyCount: updatedHistory.length
        });

        await chrome.storage.local.set({
            normalizedCostData,
            dashboardData,
            historicalCostData: updatedHistory
        });
        return dashboardData;
    } catch (e) {
        console.error("[CloudSight BG] Orchestration FAILED:", e.message);
        // Store partial data so dashboard knows something happened
        const fallbackData = {
            lastUpdated: new Date().toISOString(),
            currency, rate, budgetLimit,
            totalGlobal: 0,
            aws: null, azure: null, gcp: null,
            _error: e.message
        };
        await chrome.storage.local.set({ dashboardData: fallbackData });
        return fallbackData;
    }
}
