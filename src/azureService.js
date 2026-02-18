export async function fetchAzureCost(creds) {
    if (!creds.client || !creds.secret) return null;

    try {
        // 1. Get Auth Token
        const tokenUrl = `https://login.microsoftonline.com/${creds.tenant}/oauth2/v2.0/token`;
        const tokenBody = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: creds.client,
            client_secret: creds.secret,
            scope: 'https://management.azure.com/.default'
        });

        const tokenRes = await fetch(tokenUrl, { method: 'POST', body: tokenBody });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 2. Query Cost Management
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
        const today = date.toISOString();

        const costUrl = `https://management.azure.com/subscriptions/${creds.sub}/providers/Microsoft.CostManagement/query?api-version=2021-10-01`;

        const query = {
            type: "ActualCost",
            dataSet: {
                granularity: "None",
                aggregation: {
                    totalCost: { name: "Cost", function: "Sum" }
                },
                grouping: [{ type: "Dimension", name: "ServiceName" }],
                include: ["AccumulatedCost"]
            },
            timePeriod: { from: firstDay, to: today }
        };

        const costRes = await fetch(costUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        const costJson = await costRes.json();
        const rows = costJson.properties.rows; // [Cost, ServiceName, Currency]

        // Process Data
        let total = 0;
        const services = [];

        rows.forEach(row => {
            total += row[0];
            services.push({ name: row[1], amount: row[0] });
        });

        // Simple Linear Forecast
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        const currentDay = date.getDate();
        const forecast = (total / currentDay) * daysInMonth;

        return {
            provider: 'Azure',
            totalCost: total,
            forecast: forecast,
            services: services.sort((a, b) => b.amount - a.amount).slice(0, 5)
        };

    } catch (e) {
        console.error("Azure Fetch Error", e);
        return { provider: 'Azure', error: true };
    }
}
