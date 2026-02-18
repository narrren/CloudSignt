document.getElementById('save').addEventListener('click', () => {
    const creds = {
        aws: {
            key: document.getElementById('awsKey').value,
            secret: document.getElementById('awsSecret').value
        },
        azure: {
            tenant: document.getElementById('azTenant').value,
            client: document.getElementById('azClient').value,
            secret: document.getElementById('azSecret').value,
            sub: document.getElementById('azSub').value
        },
        gcp: {
            json: document.getElementById('gcpJson').value,
            billingId: document.getElementById('gcpBillingId').value
        }
    };

    chrome.storage.local.set({ cloudCreds: creds }, () => {
        document.getElementById('status').innerText = 'Credentials Saved!';
        setTimeout(() => document.getElementById('status').innerText = '', 2000);
        chrome.runtime.sendMessage({ action: "FORCE_REFRESH" });
    });
});
