export function appendHistoricalData(existingHistory = [], newNormalizedData = []) {
    const today = new Date().toISOString().split('T')[0];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Filter out data older than 90 days
    let updatedHistory = existingHistory.filter(h => h.date >= cutoffStr);

    // Update or append today's snapshot
    const existingIndex = updatedHistory.findIndex(h => h.date === today);
    if (existingIndex >= 0) {
        updatedHistory[existingIndex].normalizedData = newNormalizedData;
    } else {
        updatedHistory.push({
            date: today,
            normalizedData: newNormalizedData
        });
    }

    // Sort chronologically
    updatedHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    return updatedHistory;
}

export function getHistoricalSeries(history, provider = null, service = null) {
    return history.map(h => {
        let cost = 0;
        h.normalizedData.forEach(item => {
            if (provider && item.provider !== provider) return;
            if (service && item.service !== service) return;
            cost += item.cost;
        });
        return { date: h.date, cost };
    });
}
