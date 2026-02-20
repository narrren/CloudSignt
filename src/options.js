import './styles.css'; // Ensure CSS is extracted
import { encryptData, decryptData } from './cryptoUtils';

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.tab-content');
const btnSave = document.getElementById('btn-save');
const msgStatus = document.getElementById('status-msg');

// Fields
const elCurrency = document.getElementById('currency');
const elBudget = document.getElementById('budget-limit'); // New Budget Field
const elEncrypt = document.getElementById('encrypt');

// AWS
const elAwsKey = document.getElementById('aws-key');
const elAwsSecret = document.getElementById('aws-secret');

// Azure
const elAzSub = document.getElementById('az-sub');
const elAzTenant = document.getElementById('az-tenant');
const elAzClient = document.getElementById('az-client');
const elAzSecret = document.getElementById('az-secret');

// GCP
const elGcpJson = document.getElementById('gcp-json');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    handleHashNavigation();
});

function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        const targetTab = document.querySelector(`.tab-btn[data-tab="${hash}"]`);
        if (targetTab) {
            // Simulate click
            targetTab.click();
        }
    }
}

// --- Tab Logic ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Reset state
        tabs.forEach(t => {
            t.classList.remove('bg-primary/10', 'text-white', 'ring-1', 'ring-primary/20');
            t.classList.add('text-slate-400', 'hover:bg-card-dark', 'hover:text-slate-200');
        });
        sections.forEach(s => s.classList.add('hidden'));

        // Activate clicked
        tab.classList.remove('text-slate-400', 'hover:bg-card-dark', 'hover:text-slate-200');
        tab.classList.add('bg-primary/10', 'text-white', 'ring-1', 'ring-primary/20');

        const targetId = tab.dataset.tab;
        document.getElementById(`sect-${targetId}`).classList.remove('hidden');
    });
});

// --- Verify Logic ---
document.getElementById('btn-verify').addEventListener('click', async () => {
    const btn = document.getElementById('btn-verify');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Testing...';

    // Construct Creds Object (Duplicated from Save to ensure latest values)
    const creds = {
        aws: {
            key: elAwsKey.value.trim(),
            secret: elAwsSecret.value.trim()
        },
        azure: {
            subscriptionId: elAzSub.value.trim(),
            tenantId: elAzTenant.value.trim(),
            clientId: elAzClient.value.trim(),
            clientSecret: elAzSecret.value.trim()
        },
        gcp: {
            json: elGcpJson.value.trim()
        }
    };

    chrome.runtime.sendMessage({ action: "TEST_CONNECTION", creds: creds }, (response) => {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">verified_user</span> Test Connection';

        if (chrome.runtime.lastError) {
            showStatus("Error: " + chrome.runtime.lastError.message, true);
            return;
        }

        if (response && response.success) {
            showStatus("Connection Successful! You can now save.", false);
        } else {
            const errs = response.errors && response.errors.length > 0 ? response.errors.join(", ") : "Unknown Error (Check Console)";
            showStatus("Connection Failed: " + errs, true);
        }
    });
});

// --- Save Logic ---
btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    btnSave.innerText = "Saving...";

    // Construct Creds Object
    const creds = {
        aws: {
            key: elAwsKey.value.trim(),
            secret: elAwsSecret.value.trim()
        },
        azure: {
            subscriptionId: elAzSub.value.trim(),
            tenantId: elAzTenant.value.trim(),
            clientId: elAzClient.value.trim(),
            clientSecret: elAzSecret.value.trim()
        },
        gcp: {
            json: elGcpJson.value.trim()
        }
    };

    const currency = elCurrency.value;
    const budgetLimit = parseFloat(elBudget.value) || 1000;
    const useEncryption = elEncrypt.checked;

    try {
        const storageData = { currency, budgetLimit };

        if (useEncryption) {
            // Encrypt and store in encryptedCreds
            const encrypted = await encryptData(creds);
            storageData.encryptedCreds = encrypted;
            // Clear plain creds to be safe
            storageData.cloudCreds = null;
        } else {
            // Store plain text
            storageData.cloudCreds = creds;
            storageData.encryptedCreds = null;
        }

        await chrome.storage.local.set(storageData);

        // Trigger background refresh
        chrome.runtime.sendMessage({ action: "FORCE_REFRESH" });

        showStatus("Configuration saved successfully! Redirecting...");
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    } catch (err) {
        // console.error("Save failed", err);
        showStatus("Error saving settings: " + err.message, true);
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '<span class="material-symbols-outlined">save</span> Save Configuration';
    }
});

function showStatus(msg, isError = false) {
    msgStatus.innerText = msg;
    msgStatus.className = isError
        ? "mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-center gap-2"
        : "mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center gap-2";
    msgStatus.classList.remove('hidden');
    setTimeout(() => msgStatus.classList.add('hidden'), 5000);
}

// --- Load Logic ---
async function loadSettings() {
    chrome.storage.local.get(['currency', 'budgetLimit', 'cloudCreds', 'encryptedCreds'], async (result) => {
        if (result.currency) elCurrency.value = result.currency;
        if (result.budgetLimit) elBudget.value = result.budgetLimit;

        let creds = result.cloudCreds;

        // Auto-detect encryption status based on data presence
        if (result.encryptedCreds && !creds) {
            elEncrypt.checked = true;
            try {
                creds = await decryptData(result.encryptedCreds);
            } catch (e) {
                console.error("Failed to decrypt for UI", e);
                showStatus("Could not decrypt existing credentials. Please re-enter.", true);
            }
        } else {
            elEncrypt.checked = false;
        }

        if (creds) {
            // Populate Fields
            if (creds.aws) {
                elAwsKey.value = creds.aws.key || '';
                elAwsSecret.value = creds.aws.secret || '';
            }
            if (creds.azure) {
                elAzSub.value = creds.azure.subscriptionId || '';
                elAzTenant.value = creds.azure.tenantId || '';
                elAzClient.value = creds.azure.clientId || '';
                elAzSecret.value = creds.azure.clientSecret || '';
            }
            if (creds.gcp) {
                elGcpJson.value = creds.gcp.json || '';
            }
        }
    });
}
