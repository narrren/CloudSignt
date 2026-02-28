export async function fetchAzureCost(creds) {
    if (!creds.clientId || !creds.clientSecret || !creds.tenantId || !creds.subscriptionId) {
        throw new Error('Azure credentials missing required fields (client ID, secret, tenant, or subscription)');
    }

    // 1. Get Auth Token
    const accessToken = await getAzureAccessToken(creds);

    // 2. Diagnostic: Can we even access this subscription?
    const canAccess = await checkSubscriptionAccess(accessToken, creds.subscriptionId);
    if (!canAccess.ok) {
        throw new Error(
            `Azure Access Denied: Your Service Principal cannot access subscription ${creds.subscriptionId}.\n` +
            `This means NO roles are assigned to the Service Principal (Object ID: ${canAccess.oid || 'unknown'}) on this subscription.\n\n` +
            `FIX: In Azure Portal → Subscriptions → ${creds.subscriptionId} → Access control (IAM) → Add role assignment → ` +
            `Role: "Cost Management Reader" → Members: search for your App name or Client ID ${creds.clientId} → Review + assign.\n\n` +
            `Detail: ${canAccess.error}`
        );
    }

    // 3. Try Cost Management API first (needs "Cost Management Reader" role)
    try {
        const result = await queryCostManagementAPI(accessToken, creds.subscriptionId);
        return result;
    } catch (costMgmtError) {
        console.warn("[Azure] Cost Management API failed, trying Consumption API fallback:", costMgmtError.message);

        // 4. Fallback to Consumption API (works with "Reader" role)
        try {
            const result = await queryConsumptionAPI(accessToken, creds.subscriptionId);
            return result;
        } catch (consumptionError) {
            const debugInfo = getTokenDebugInfo(accessToken, creds.subscriptionId);
            throw new Error(
                `Azure Permission Error: Your Service Principal can access the subscription but lacks cost-reading permissions.\n\n` +
                `FIX: In Azure Portal → Subscriptions → Access control (IAM) → Add role assignment → ` +
                `assign "Cost Management Reader" role to your App Registration.\n\n` +
                `Cost Management API: ${costMgmtError.message}\n` +
                `Consumption API: ${consumptionError.message}` +
                debugInfo
            );
        }
    }
}

async function getAzureAccessToken(creds) {
    const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        scope: 'https://management.azure.com/.default'
    });

    const tokenRes = await fetch(tokenUrl, { method: 'POST', body: tokenBody });
    if (!tokenRes.ok) {
        const tokenErr = await tokenRes.json().catch(() => ({}));
        throw new Error(`Azure Auth Failed: ${tokenErr.error_description || tokenErr.error || tokenRes.statusText}`);
    }

    const tokenData = await tokenRes.json();
    return tokenData.access_token;
}

// Diagnostic: Check if SP can even see the subscription
async function checkSubscriptionAccess(accessToken, subscriptionId) {
    let oid = '';
    try {
        const parts = accessToken.split('.');
        const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))));
        oid = payload.oid || '';
    } catch (e) { }

    try {
        const res = await fetch(`https://management.azure.com/subscriptions/${subscriptionId}?api-version=2022-12-01`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (res.ok) {
            return { ok: true, oid };
        }

        const err = await res.json().catch(() => ({}));
        return {
            ok: false,
            oid,
            error: `(${res.status}) ${err.error?.message || res.statusText}`
        };
    } catch (e) {
        return { ok: false, oid, error: e.message };
    }
}

// Primary: Cost Management API (requires "Cost Management Reader" role)
async function queryCostManagementAPI(accessToken, subscriptionId) {
    const costUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

    const query = {
        type: "ActualCost",
        timeframe: "MonthToDate",
        dataset: {
            granularity: "Daily",
            aggregation: {
                totalCost: { name: "Cost", function: "Sum" }
            },
            grouping: [
                { type: "Dimension", name: "ServiceName" }
            ]
        }
    };

    const costRes = await fetch(costUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
    });

    if (!costRes.ok) {
        const costErr = await costRes.json().catch(() => ({}));
        throw new Error(`(${costRes.status}) ${costErr.error?.message || costRes.statusText}`);
    }

    return await costRes.json();
}

// Fallback: Consumption Usage Details API (works with "Reader" role)
async function queryConsumptionAPI(accessToken, subscriptionId) {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = firstOfMonth.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const filter = `properties/usageStart ge '${startDate}' and properties/usageEnd le '${endDate}'`;
    const consumptionUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.Consumption/usageDetails?api-version=2023-05-01&$top=1000&$filter=${encodeURIComponent(filter)}`;

    const res = await fetch(consumptionUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`(${res.status}) ${err.error?.message || res.statusText}`);
    }

    const consumptionData = await res.json();
    const usageItems = consumptionData.value || [];

    // Transform to Cost Management API format for costEngine.normalize()
    const dailyServiceMap = {};
    usageItems.forEach(item => {
        const props = item.properties || {};
        const cost = props.costInBillingCurrency || props.cost || props.pretaxCost || 0;
        const date = (props.date || props.usageStart || '').split('T')[0];
        const service = props.meterCategory || props.consumedService || 'Unknown';
        const currency = props.billingCurrency || props.currency || 'USD';

        if (cost > 0 && date) {
            const key = `${date}_${service}`;
            if (!dailyServiceMap[key]) {
                dailyServiceMap[key] = { cost: 0, date, service, currency };
            }
            dailyServiceMap[key].cost += cost;
        }
    });

    const rows = Object.values(dailyServiceMap).map(item => {
        const dateFormatted = item.date.replace(/-/g, '');
        return [item.cost, dateFormatted, item.service, item.currency];
    });

    return {
        properties: {
            rows: rows,
            columns: [
                { name: "Cost", type: "Number" },
                { name: "UsageDate", type: "Number" },
                { name: "ServiceName", type: "String" },
                { name: "Currency", type: "String" }
            ]
        },
        _source: 'consumption_api_fallback'
    };
}

function getTokenDebugInfo(accessToken, subscriptionId) {
    try {
        const parts = accessToken.split('.');
        const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))));
        return `\n[Diagnostics] aud=${payload.aud} | tid=${payload.tid} | oid=${payload.oid} | sub=${subscriptionId}`;
    } catch (e) {
        return '\n[Diagnostics] Could not decode token.';
    }
}
