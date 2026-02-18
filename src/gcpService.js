import * as jose from 'jose';

export async function fetchGCPCost(creds) {
    if (!creds.json || !creds.billingId) return null;

    try {
        const keyData = JSON.parse(creds.json);

        // 1. Create Signed JWT
        const privateKey = await jose.importPKCS8(keyData.private_key, 'RS256');
        const jwt = await new jose.SignJWT({
            scope: 'https://www.googleapis.com/auth/cloud-billing.readonly'
        })
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer(keyData.client_email)
            .setAudience(keyData.token_uri)
            .setExpirationTime('1h')
            .setIssuedAt()
            .sign(privateKey);

        // 2. Exchange JWT for Access Token
        const tokenRes = await fetch(keyData.token_uri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 3. Query Cloud Billing API
        // Note: GCP Billing API is complex. We query the aggregate for the billing account.
        // For simplicity in this demo, we assume the user wants the total for the billing account.
        // Real GCP cost API usually requires BigQuery, but we can check "budgets" API if configured, 
        // or use the 'services' list. 
        // *Constraint:* GCP does not have a simple "Get Current Cost" REST endpoint like AWS/Azure without BigQuery.
        // *Workaround:* We will just fetch the "Budget" status if available, or return a placeholder if BigQuery isn't set up.

        // HOWEVER, for this example, let's assume we use the Cloud Billing Budget API 
        // to get the current spend if a budget is defined.
        // URL: https://billingbudgets.googleapis.com/v1/billingAccounts/{billingId}/budgets

        const budgetRes = await fetch(`https://billingbudgets.googleapis.com/v1/billingAccounts/${creds.billingId}/budgets`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const budgetJson = await budgetRes.json();

        // Try to extract spend from the first budget found
        let total = 0;
        if (budgetJson.budgets && budgetJson.budgets.length > 0) {
            // GCP budgets don't always return "current spend" in the list view,
            // but this is the closest we get without BigQuery.
            // If this fails, this section needs BigQuery integration which is too heavy for extension.
            total = 0; // Placeholder: GCP Rest API is limited for direct cost reading.
        }

        return {
            provider: 'GCP',
            totalCost: total,
            forecast: 0,
            services: [{ name: "Check Console (BigQuery Required)", amount: 0 }]
        };

    } catch (e) {
        console.error("GCP Fetch Error", e);
        return { provider: 'GCP', error: true };
    }
}
