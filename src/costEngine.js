// src/costEngine.js

// Convert any currency to USD for uniform aggregation
const RATES_TO_USD = {
    'USD': 1.0,
    'EUR': 1.075,   // 1 EUR = ~1.075 USD
    'GBP': 1.266,   // 1 GBP = ~1.266 USD
    'INR': 0.01198,  // 1 INR = ~0.012 USD
    'JPY': 0.00666   // 1 JPY = ~0.0067 USD
};

function toUSD(amount, fromCurrency) {
    if (!fromCurrency || fromCurrency === 'USD') return amount;
    const convRate = RATES_TO_USD[fromCurrency.toUpperCase()];
    return convRate ? amount * convRate : amount;
}

export function normalize(rawData, provider, metadata = {}) {
    let normalized = [];
    if (!rawData) return normalized;

    if (provider === 'aws') {
        const results = rawData.ResultsByTime || [];
        results.forEach(period => {
            const date = period.TimePeriod.Start;
            const groups = period.Groups || [];

            // If no groups (e.g. just asking for daily total)
            if (groups.length === 0) {
                const amount = parseFloat(period.Total?.UnblendedCost?.Amount || 0);
                if (amount > 0) {
                    normalized.push({
                        provider: 'aws',
                        accountId: metadata.accountId || 'default',
                        subscriptionId: null,
                        projectId: null,
                        service: 'Total',
                        region: 'global',
                        usageType: 'standard',
                        cost: amount,
                        currency: 'USD',
                        timestamp: `${date}T00:00:00Z`
                    });
                }
            } else {
                groups.forEach(group => {
                    const rawAmount = parseFloat(group.Metrics.UnblendedCost.Amount);
                    const rawCurrency = group.Metrics.UnblendedCost.Unit || 'USD';
                    const amount = toUSD(rawAmount, rawCurrency);
                    if (amount > 0) {
                        normalized.push({
                            provider: 'aws',
                            accountId: metadata.accountId || 'default',
                            subscriptionId: null,
                            projectId: null,
                            service: group.Keys[0] || 'Unknown',
                            region: metadata.region || 'global',
                            usageType: 'standard',
                            cost: amount,
                            currency: 'USD',
                            timestamp: `${date}T00:00:00Z`
                        });
                    }
                });
            }
        });
    } else if (provider === 'azure') {
        const rows = rawData.properties?.rows || [];
        rows.forEach(row => {
            // Azure rows: [Cost, Date, ServiceName, Currency] for Daily granularity
            // If none granularity: [Cost, ServiceName, Currency]
            // We assume daily granularity is implemented now
            let amount = 0, dateStr = new Date().toISOString(), serviceName = 'Unknown', currency = 'USD';

            if (row.length >= 4) {
                amount = row[0] || 0;
                // Azure returns date as number (20260227) or string — normalize to string first
                const dateRaw = String(row[1] || '');
                if (dateRaw.length >= 8) {
                    dateStr = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}T00:00:00Z`;
                }
                serviceName = row[2] || 'Unknown';
                currency = row[3] || 'USD';
            } else {
                amount = row[0] || 0;
                serviceName = row[1] || 'Unknown';
                currency = row[2] || 'USD';
            }

            if (amount > 0) {
                normalized.push({
                    provider: 'azure',
                    accountId: null,
                    subscriptionId: metadata.subscriptionId || 'default',
                    projectId: null,
                    service: serviceName,
                    region: 'global',
                    usageType: 'standard',
                    cost: toUSD(amount, currency),
                    currency: 'USD',
                    timestamp: dateStr
                });
            }
        });
    } else if (provider === 'gcp') {
        const date = new Date().toISOString();
        normalized.push({
            provider: 'gcp',
            accountId: null,
            subscriptionId: null,
            projectId: metadata.projectId || 'default',
            service: 'Current Spend (Requires BigQuery Setup)',
            region: 'global',
            usageType: 'standard',
            cost: 0,
            currency: 'USD',
            timestamp: date
        });
    }

    return normalized;
}
