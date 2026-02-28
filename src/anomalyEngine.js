// src/anomalyEngine.js

export function detectAnomalies(normalizedData) {
    // 1. Group data by provider + service + date
    const dailyCosts = {};

    normalizedData.forEach(item => {
        const dateRaw = item.timestamp.split('T')[0];
        const key = `${item.provider}_${item.service}`;
        if (!dailyCosts[key]) dailyCosts[key] = {};
        if (!dailyCosts[key][dateRaw]) dailyCosts[key][dateRaw] = 0;
        dailyCosts[key][dateRaw] += item.cost;
    });

    const anomalies = [];

    // 2. Perform Z-Score & Seasonal Check per service
    Object.keys(dailyCosts).forEach(key => {
        const [provider, service] = key.split('_');

        // Convert to array of { date, cost } and sort by date
        const history = Object.keys(dailyCosts[key])
            .map(date => ({ date, cost: dailyCosts[key][date] }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (history.length < 14) return; // Need at least 14 days for robust baseline

        const recent = history.slice(-1)[0]; // Today or latest
        const previous = history.slice(0, -1); // Exclude today from baseline

        const previousCosts = previous.map(h => h.cost);
        const mean = previousCosts.reduce((a, b) => a + b, 0) / previousCosts.length;

        const variance = previousCosts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / previousCosts.length;
        const stdDev = Math.sqrt(variance);

        const zScore = stdDev > 0 ? (recent.cost - mean) / stdDev : 0;

        // Seasonal adjustment: Compare to same weekday last week
        const latestDate = new Date(recent.date);
        const sameDayLastWeek = new Date(latestDate);
        sameDayLastWeek.setDate(latestDate.getDate() - 7);
        const seasonalMatch = previous.find(h => h.date === sameDayLastWeek.toISOString().split('T')[0]);

        let severity = null;

        // Core anomaly logic
        if (zScore > 2.5 && recent.cost > 2.0) {
            severity = "critical";
        } else if (zScore > 1.5 && recent.cost > 1.0) {
            // Secondary check: if it's over 1.5z AND significantly higher than same day last week
            if (seasonalMatch && recent.cost > (seasonalMatch.cost * 1.5)) {
                severity = "moderate";
            }
        }

        if (severity) {
            anomalies.push({
                isAnomaly: true,
                provider,
                service,
                date: recent.date,
                timestamp: recent.date + 'T00:00:00Z',
                severity: severity,
                deviationPercent: mean > 0 ? ((recent.cost - mean) / mean) * 100 : 100,
                baseline: mean,
                cost: recent.cost
            });
        }
    });

    return anomalies;
}
