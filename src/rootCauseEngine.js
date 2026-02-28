export function analyzeRootCause(normalizedData, anomalies) {
    if (!anomalies || anomalies.length === 0) return [];

    let rootCauses = [];
    anomalies.forEach(anomaly => {
        if (!anomaly.isAnomaly) return;

        // Filter data for the specific provider
        const providerData = normalizedData.filter(d => d.provider === anomaly.provider);

        // Sort chronologically
        const dates = [...new Set(providerData.map(d => d.timestamp.split('T')[0]))].sort();
        if (dates.length < 2) return;

        const latestDate = dates[dates.length - 1];
        const baselineDates = dates.slice(Math.max(0, dates.length - 15), dates.length - 1);

        let latestServices = {};
        providerData.filter(d => d.timestamp.startsWith(latestDate)).forEach(d => {
            latestServices[d.service] = (latestServices[d.service] || 0) + d.cost;
        });

        let baselineServices = {};
        let baselineDays = baselineDates.length;
        providerData.filter(d => baselineDates.includes(d.timestamp.split('T')[0])).forEach(d => {
            baselineServices[d.service] = (baselineServices[d.service] || 0) + d.cost;
        });

        Object.keys(baselineServices).forEach(k => {
            baselineServices[k] = baselineServices[k] / baselineDays;
        });

        let contributors = [];
        Object.keys(latestServices).forEach(service => {
            const current = latestServices[service];
            const baseline = baselineServices[service] || 0;
            const delta = current - baseline;
            if (delta > 0) {
                contributors.push({ service, deltaAmount: delta });
            }
        });

        const totalDelta = contributors.reduce((acc, c) => acc + c.deltaAmount, 0);
        if (totalDelta > 0) {
            contributors = contributors.map(c => ({
                ...c,
                contributionPercent: (c.deltaAmount / totalDelta) * 100
            })).sort((a, b) => b.contributionPercent - a.contributionPercent);
        }

        rootCauses.push({
            anomalyDate: latestDate,
            provider: anomaly.provider,
            topContributors: contributors.slice(0, 3)
        });
    });

    return rootCauses;
}
