// src/awsService.js
import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from "@aws-sdk/client-cost-explorer";

export async function fetchAWSRaw(creds) {
    if (!creds.key || !creds.secret) {
        throw new Error('AWS credentials missing (key or secret is empty)');
    }

    const client = new CostExplorerClient({
        region: creds.region || "us-east-1",
        credentials: {
            accessKeyId: creds.key.trim(),
            secretAccessKey: creds.secret.trim()
        }
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // AWS History: 14 days
    const histStart = new Date();
    histStart.setDate(histStart.getDate() - 14);

    let costResponse;
    try {
        // Fetch 14 day history grouped by SERVICE at DAILY granularity
        // This is necessary for both history and anomalies
        costResponse = await client.send(new GetCostAndUsageCommand({
            TimePeriod: { Start: histStart.toISOString().split('T')[0], End: todayStr },
            Granularity: "DAILY",
            Metrics: ["UnblendedCost"],
            GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }]
        }));
    } catch (e) {
        const msg = e?.message || e?.name || String(e);
        throw new Error(msg);
    }

    // We pass the raw results back
    return costResponse;
}
