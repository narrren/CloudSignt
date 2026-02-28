// src/insightEngine.js

export function generateInsights(normalizedData, anomalies, rootCauses = [], finopsMetrics = null, forecast = null) {
    let insights = [];

    // Phase 15 logic
    if (finopsMetrics) {
        if (finopsMetrics.concentrationIndex > 0.8) {
            insights.push({
                severity: 'warning',
                headline: 'High Service Concentration',
                explanation: `Top 3 services account for ${(finopsMetrics.concentrationIndex * 100).toFixed(1)}% of total spend.`,
                topRiskFactor: 'Vendor Lock-in / Unoptimized Services',
                recommendedAction: 'Diversify service usage or negotiate enterprise discounts for top services.',
                confidenceScore: 90
            });
        }
        if (finopsMetrics.volatilityIndex > 0.5) {
            insights.push({
                severity: 'critical',
                headline: 'High Cost Volatility Detected',
                explanation: 'Daily spend is fluctuating significantly compared to the 30-day mean.',
                topRiskFactor: 'Unpredictable scaling or rogue workloads',
                recommendedAction: 'Investigate usage spikes and implement auto-scaling guardrails.',
                confidenceScore: 85
            });
        }
        if (finopsMetrics.riskScore > 70) {
            insights.push({
                severity: 'critical',
                headline: 'Critical FinOps Health Score',
                explanation: `Composite risk score is ${finopsMetrics.riskScore}/100 indicating poor financial health.`,
                topRiskFactor: 'Runaway costs',
                recommendedAction: 'Conduct an immediate architecture cost review.',
                confidenceScore: 95
            });
        }
    }

    if (forecast && forecast.riskLevel === 'critical') {
        insights.push({
            severity: 'critical',
            headline: 'Runaway Burn Rate Forecast',
            explanation: `Current acceleration (${forecast.acceleration.toFixed(2)}/day) projects significant budget overrun.`,
            topRiskFactor: 'Budget Exhaustion',
            recommendedAction: 'Adjust budget allocation and freeze non-essential scaling.',
            confidenceScore: 85
        });
    }

    if (anomalies && anomalies.length > 0) {
        anomalies.forEach((a, i) => {
            if (!a.isAnomaly) return;
            let rootCauseText = "";
            let recommendedAction = "Investigate the console immediately.";
            const rc = rootCauses.find(r => r.provider === a.provider && r.anomalyDate === a.timestamp.split('T')[0]);
            if (rc && rc.topContributors.length > 0) {
                rootCauseText = ` Primarily driven by ${rc.topContributors.map(c => c.service).join(', ')}.`;
                recommendedAction = `Review capacity scaling for ${rc.topContributors[0].service}.`;
            }
            insights.push({
                severity: a.severity === 'critical' ? 'critical' : 'warning',
                headline: `Unusual Spend in ${a.provider.toUpperCase()}`,
                explanation: `Spend deviated by $${(a.cost - a.baseline).toFixed(2)} from baseline.${rootCauseText}`,
                topRiskFactor: 'Rogue Workload',
                recommendedAction: recommendedAction,
                confidenceScore: 92
            });
        });
    }

    if (insights.length === 0) {
        insights.push({
            severity: 'safe',
            headline: 'Costs are Optimized',
            explanation: 'No critical anomalies, high volatility, or risky forecasts detected.',
            topRiskFactor: 'None',
            recommendedAction: 'Continue monitoring.',
            confidenceScore: 100
        });
    }

    return insights;
}
