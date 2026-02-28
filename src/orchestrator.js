import { fetchAWSRaw } from "./awsService";
import { fetchAzureCost } from "./azureService";
import { fetchGCPCost } from "./gcpService";
import { getAwsCredentials, getAzureToken, getGcpAccessToken } from "./authManager";
import { normalize } from "./costEngine";
import { detectAnomalies } from "./anomalyEngine";
import { calculateForecast } from "./forecastEngine";
import { generateInsights } from "./insightEngine";
import { appendHistoricalData } from "./historyEngine";
import { analyzeRootCause } from "./rootCauseEngine";
import { calculateFinOpsMetrics } from "./finopsMetricsEngine";

let providerHealthMetrics = {
    aws: { latencies: [], errors: 0, total: 0 },
    azure: { latencies: [], errors: 0, total: 0 },
    gcp: { latencies: [], errors: 0, total: 0 }
};

// Phase 13: Provider Health & Integration Monitor
async function executeWithRetryAndTimeout(provider, fn, arg, retries = 3) {
    const start = performance.now();
    providerHealthMetrics[provider].total++;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 15000));
            const result = await Promise.race([fn(arg), timeoutPromise]);

            const duration = performance.now() - start;
            providerHealthMetrics[provider].latencies.push(duration);
            if (providerHealthMetrics[provider].latencies.length > 20) providerHealthMetrics[provider].latencies.shift();

            return result;
        } catch (err) {
            if (attempt === retries) {
                providerHealthMetrics[provider].errors++;
                // Preserve the original error instead of replacing with a generic message
                throw err;
            }
            // Only retry on timeouts or network errors, not on auth/permission errors
            const msg = err.message || '';
            if (msg.includes('RBAC') || msg.includes('Auth Failed') || msg.includes('credentials missing') ||
                msg.includes('403') || msg.includes('401')) {
                // Don't retry permission errors
                providerHealthMetrics[provider].errors++;
                throw err;
            }
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
    }
}

export function getProviderHealth() {
    const health = {};
    for (const p of ['aws', 'azure', 'gcp']) {
        const h = providerHealthMetrics[p];
        const avgLatency = h.latencies.length ? h.latencies.reduce((a, b) => a + b, 0) / h.latencies.length : 0;
        const failureRate = h.total ? h.errors / h.total : 0;

        let status = 'Healthy';
        if (failureRate > 0.5 || avgLatency > 8000) status = 'Unstable';
        else if (failureRate > 0.1 || avgLatency > 4000) status = 'Degraded';
        else if (h.total === 0) status = 'Unknown';

        health[p] = { avgLatency, failureRate, status };
    }
    return health;
}

function computeDailyTotals(norms) {
    const dailyMap = {};
    norms.forEach(n => {
        const d = n.timestamp.split('T')[0];
        dailyMap[d] = (dailyMap[d] || 0) + n.cost;
    });
    return Object.keys(dailyMap).sort().map(k => dailyMap[k]);
}

function buildLegacyPayload(provider, norms) {
    let total = 0;
    let serviceMap = {};
    let dailyMap = {};
    norms.forEach(item => {
        total += item.cost;
        if (!serviceMap[item.service]) serviceMap[item.service] = 0;
        serviceMap[item.service] += item.cost;
        const dateRaw = item.timestamp.split('T')[0];
        if (!dailyMap[dateRaw]) dailyMap[dateRaw] = 0;
        dailyMap[dateRaw] += item.cost;
    });
    const services = Object.keys(serviceMap).map(name => ({ name, amount: serviceMap[name] })).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const history = Object.keys(dailyMap).sort().map(date => ({ date, cost: dailyMap[date] }));
    return { provider: provider.toUpperCase(), totalCost: total, services, history };
}

// Phase 17: Architectural Hardening Orchestrator
export async function orchestrateFetch(creds, existingHistory, currency, rate, budgetLimit) {
    const awsAuths = await getAwsCredentials(creds.aws);
    const azureAuths = await getAzureToken(creds.azure);
    const gcpAuths = await getGcpAccessToken(creds.gcp);

    let normalizedCostData = [];
    let dashboardData = {
        lastUpdated: new Date().toISOString(), currency, rate, budgetLimit, totalGlobal: 0,
        aws: null, azure: null, gcp: null
    };

    // AWS
    for (const auth of awsAuths) {
        if (!auth.key) continue;
        try {
            const raw = await executeWithRetryAndTimeout('aws', fetchAWSRaw, auth);
            const norms = normalize(raw, 'aws', { accountId: auth.accountId || 'default' });
            normalizedCostData.push(...norms);
            dashboardData.aws = buildLegacyPayload('aws', norms);
        } catch (e) {
            dashboardData.aws = { error: e.message };
        }
    }

    // Azure
    for (const auth of azureAuths) {
        if (!auth.clientId) continue;
        try {
            const raw = await executeWithRetryAndTimeout('azure', fetchAzureCost, auth);
            const norms = normalize(raw, 'azure', { subscriptionId: auth.subscriptionId });
            normalizedCostData.push(...norms);
            dashboardData.azure = buildLegacyPayload('azure', norms);
        } catch (e) {
            dashboardData.azure = { error: e.message };
        }
    }

    // GCP
    for (const auth of gcpAuths) {
        if (!auth.json) continue;
        try {
            const raw = await executeWithRetryAndTimeout('gcp', fetchGCPCost, auth);
            const norms = normalize(raw, 'gcp', { projectId: 'default' });
            normalizedCostData.push(...norms);
            dashboardData.gcp = buildLegacyPayload('gcp', norms);
        } catch (e) {
            dashboardData.gcp = { error: e.message };
        }
    }

    // Phase 10: History Append
    const updatedHistory = appendHistoricalData(existingHistory, normalizedCostData);

    // Advanced Engines
    const anomalies = detectAnomalies(normalizedCostData);
    const rootCauses = analyzeRootCause(normalizedCostData, anomalies); // Phase 11

    const globalDailyTotals = computeDailyTotals(normalizedCostData);
    const currentMonthSpend = normalizedCostData.reduce((a, b) => a + b.cost, 0);

    const forecast = calculateForecast(globalDailyTotals, currentMonthSpend, updatedHistory, anomalies); // Phase 14

    const finopsMetrics = calculateFinOpsMetrics(normalizedCostData, updatedHistory, currentMonthSpend); // Phase 12
    const insights = generateInsights(normalizedCostData, anomalies, rootCauses, finopsMetrics, forecast); // Phase 15

    // Global Accumulation
    dashboardData.totalGlobal = currentMonthSpend;
    dashboardData.globalForecast = forecast;
    dashboardData.globalAnomalies = anomalies;
    dashboardData.globalInsights = insights;
    dashboardData.finopsMetrics = finopsMetrics;
    dashboardData.rootCauses = rootCauses;
    dashboardData.providerHealth = getProviderHealth();
    dashboardData.historicalData = updatedHistory.map(h => ({
        date: h.date,
        cost: h.normalizedData.reduce((acc, curr) => acc + curr.cost, 0)
    }));

    ['aws', 'azure', 'gcp'].forEach(prov => {
        if (dashboardData[prov] && !dashboardData[prov].error) {
            const provDaily = computeDailyTotals(normalizedCostData.filter(x => x.provider === prov));
            const provForecast = calculateForecast(provDaily, dashboardData[prov].totalCost);
            dashboardData[prov].forecast = provForecast.projectedMonthEndSpend;
            dashboardData[prov].analytics = {
                burnRate: provForecast.burnRate,
                velocityPct: provForecast.acceleration > 0 ? provForecast.acceleration * 10 : 0
            };
            const provAnom = anomalies.find(a => a.provider === prov);
            if (provAnom) dashboardData[prov].anomaly = { isAnomaly: true, today: provAnom.cost, average: provAnom.baseline };
        }
    });

    return { dashboardData, normalizedCostData, updatedHistory };
}
