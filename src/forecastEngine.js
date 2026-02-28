// src/forecastEngine.js

export function calculateForecast(dailyTotals, currentMonthSpend, history = [], anomalies = []) {
    if (!dailyTotals || dailyTotals.length < 3) {
        return {
            burnRate: 0,
            projectedMonthEndSpend: currentMonthSpend,
            acceleration: 0,
            riskLevel: 'safe',
            trendDirection: 'stable',
            spikeFrequency: 0,
            stabilityScore: 100
        };
    }

    const last7Days = dailyTotals.slice(-7);
    const burnRate = last7Days.reduce((a, b) => a + b, 0) / last7Days.length;

    // Remaining days in month
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remainingDays = lastDay - today.getDate();

    const projectedMonthEndSpend = currentMonthSpend + (burnRate * remainingDays);

    // Calculate acceleration (slope of linear regression on last 7 days)
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = last7Days.length;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += last7Days[i];
        sumXY += i * last7Days[i];
        sumX2 += i * i;
    }
    const acceleration = (n * sumX2 - sumX * sumX) > 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

    let riskLevel = 'safe';
    if (acceleration > (burnRate * 0.1)) {
        riskLevel = 'critical'; // Increasing by > 10% of burn rate per day
    } else if (acceleration > (burnRate * 0.05)) {
        riskLevel = 'warning';
    }

    // Phase 14: Stability classification
    let trendDirection = 'stable';
    if (acceleration > (burnRate * 0.02)) trendDirection = 'upward';
    if (acceleration < -(burnRate * 0.02)) trendDirection = 'declining';

    // Spikes per 30 days
    // Count anomalies in the last 30 days of history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffStr = thirtyDaysAgo.toISOString().split('T')[0];

    // In our context, anomalies array passed is from current run (today's anomalies).
    // To properly count spikes, we should look at history.
    // However, if we don't store historical anomalies, we just use current as a proxy or just check history for days exceeding 2 std devs. 
    // For now, we use a simple heuristic: counts cost spikes in history.
    let spikeFrequency = anomalies.length;

    // We can calculate spikes by finding days where cost > mean + 2*sigma in history.
    if (history && history.length > 0) {
        const h30 = history.filter(h => h.date >= cutoffStr).map(h => h.normalizedData.reduce((acc, curr) => acc + curr.cost, 0));
        if (h30.length > 3) {
            const meanHist = h30.reduce((a, b) => a + b, 0) / h30.length;
            const varianceHist = h30.reduce((a, b) => a + Math.pow(b - meanHist, 2), 0) / h30.length;
            const stdDevHist = Math.sqrt(varianceHist);
            spikeFrequency = h30.filter(cost => cost > meanHist + 2 * stdDevHist).length;
        }
    }

    let stabilityScore = 100;
    if (trendDirection === 'upward') stabilityScore -= 20;
    stabilityScore -= (spikeFrequency * 10);
    stabilityScore = Math.max(0, Math.min(100, stabilityScore));

    return {
        burnRate: parseFloat(burnRate.toFixed(2)),
        projectedMonthEndSpend: parseFloat(projectedMonthEndSpend.toFixed(2)),
        acceleration: parseFloat(acceleration.toFixed(2)),
        riskLevel,
        trendDirection,
        spikeFrequency,
        stabilityScore
    };
}
