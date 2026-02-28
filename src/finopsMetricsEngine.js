export function calculateFinOpsMetrics(normalizedData, history, totalSpend) {
    if (!normalizedData || normalizedData.length === 0 || totalSpend === 0) {
        return { concentrationIndex: 0, volatilityIndex: 0, growthMomentum: 0, diversificationRatio: 0, riskScore: 0 };
    }

    // 1. Cost Concentration Index
    let serviceMap = {};
    normalizedData.forEach(d => {
        serviceMap[d.service] = (serviceMap[d.service] || 0) + d.cost;
    });
    const top3Cost = Object.values(serviceMap).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    const concentrationIndex = top3Cost / totalSpend;

    // 2. Volatility Index & Growth Momentum
    let volatilityIndex = 0;
    let growthMomentum = 0;

    if (history && history.length > 0) {
        const dailyTotals = history.map(h => h.normalizedData.reduce((acc, curr) => acc + curr.cost, 0));
        if (dailyTotals.length >= 2) {
            const mean = dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length;
            const variance = dailyTotals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyTotals.length;
            const stdDev = Math.sqrt(variance);
            volatilityIndex = mean > 0 ? stdDev / mean : 0;

            // Linear regression slope
            const n = dailyTotals.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumY += dailyTotals[i];
                sumXY += i * dailyTotals[i];
                sumX2 += i * i;
            }
            const slope = (n * sumX2 - sumX * sumX) > 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
            growthMomentum = mean > 0 ? slope / mean : 0;
        }
    }

    // 4. Cloud Diversification Ratio
    let providerMap = {};
    normalizedData.forEach(d => {
        providerMap[d.provider] = (providerMap[d.provider] || 0) + d.cost;
    });
    const topProviderCost = Math.max(...Object.values(providerMap), 0);
    const diversificationRatio = topProviderCost / totalSpend;

    // 5. Risk Score
    const cScore = Math.min(concentrationIndex * 100, 100) * 0.3;     // 30% weight
    const vScore = Math.min(volatilityIndex * 200, 100) * 0.2;        // 20% weight
    const gScore = Math.max(0, Math.min(growthMomentum * 500, 100)) * 0.3; // 30% weight
    const dScore = Math.min(diversificationRatio * 100, 100) * 0.2;   // 20% weight

    const riskScore = Math.min(Math.round(cScore + vScore + gScore + dScore), 100);

    return {
        concentrationIndex,
        volatilityIndex,
        growthMomentum,
        diversificationRatio,
        riskScore
    };
}
