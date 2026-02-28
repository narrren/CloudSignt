import * as jose from 'jose';

export async function fetchGCPCost(creds) {
    if (!creds.json) {
        throw new Error('GCP Service Account JSON missing');
    }

    try {
        const keyData = JSON.parse(creds.json);
        if (!keyData.project_id || !keyData.private_key || !keyData.client_email) {
            throw new Error('Invalid JSON format: missing project_id, private_key, or client_email');
        }

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

        if (!tokenRes.ok) {
            const tokenErr = await tokenRes.json();
            throw new Error(`Auth Failed: ${tokenErr.error_description || tokenErr.error}`);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        // 3. Get Billing Account ID from Project
        const billingInfoRes = await fetch(`https://cloudbilling.googleapis.com/v1/projects/${keyData.project_id}/billingInfo`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!billingInfoRes.ok) {
            const billErr = await billingInfoRes.json();
            throw new Error(`Failed to get billing info: ${billErr.error?.message || billingInfoRes.statusText}`);
        }

        const billingInfo = await billingInfoRes.json();
        const billingAccountId = billingInfo.billingAccountName?.split('/')[1];

        if (!billingAccountId) {
            throw new Error('No billing account associated with this project.');
        }

        // 4. Query Cloud Billing Budget API
        const budgetRes = await fetch(`https://billingbudgets.googleapis.com/v1/billingAccounts/${billingAccountId}/budgets`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!budgetRes.ok) {
            const budgErr = await budgetRes.json();
            throw new Error(`Budget API Failed: ${budgErr.error?.message || budgetRes.statusText}. Ensure Billing Budgets API is enabled.`);
        }

        const budgetJson = await budgetRes.json();

        // Return raw API data
        return budgetJson;


    } catch (e) {
        console.error("GCP Fetch Error", e);
        throw e; // Rethrow to let background.js catch it
    }
}
