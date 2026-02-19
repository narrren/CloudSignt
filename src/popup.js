document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['dashboardData'], (result) => {
        const data = result.dashboardData;
        // UI updates disabled for static mockup stability
        // if (data) {
        //     updateUI(data);
        // } else {
        //     // Trigger a background refresh if no data exists?
        //     // For now just show placeholders or error
        //     // document.getElementById('total-spend').innerText = '$0.00';
        //     // document.getElementById('forecast-spend').innerText = '$0.00';
        // }
    });

    // Navigation Listeners
    document.getElementById('btn-open-dashboard')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard.html' });
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    });
});

const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$'
};

function fmt(val, currency = 'USD') {
    const sym = CURRENCY_SYMBOLS[currency] || '$';
    // Handle string inputs from AWS SDK
    const num = parseFloat(val || 0);
    return `${sym}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function updateUI(data) {
    const currency = data.currency || 'USD';
    const total = data.totalGlobal || 0;

    // 1. Total Spend
    const totalEl = document.getElementById('total-spend');
    if (totalEl) totalEl.innerText = fmt(total, currency);

    const currencyEl = document.getElementById('currency-display');
    if (currencyEl) currencyEl.innerText = currency;

    // 2. Forecast
    // Sum up forecasts
    let totalForecast = 0;
    ['aws', 'azure', 'gcp'].forEach(p => {
        if (data[p] && data[p].forecast) {
            totalForecast += parseFloat(data[p].forecast);
        }
    });
    const forecastEl = document.getElementById('forecast-spend');
    if (forecastEl) forecastEl.innerText = fmt(totalForecast, currency);

    // 3. Alerts Count
    // Simple logic: If budget exceeded or anomaly -> Critical
    let alertCount = 0; // Logic could be more complex, reading from background alarms?
    // Start with 0. If user has 'alerts' array in data (from background check), use it.
    // For now we simulate based on data state
    if (data.anomaly) alertCount++;
    if (data.aws?.error) alertCount++;

    const alertEl = document.getElementById('alert-count');
    if (alertEl) {
        alertEl.innerText = alertCount;
        // Show indicator if alerts > 0
        const signal = document.getElementById('alert-indicator');
        if (signal) signal.style.display = alertCount > 0 ? 'block' : 'none';

        const statusText = document.getElementById('alert-status-text');
        if (statusText) {
            statusText.innerText = alertCount > 0 ? `${alertCount} Issues Found` : 'All systems normal';
            statusText.className = alertCount > 0 ? 'text-rose-400 text-[10px] font-medium mt-1 block relative z-10' : 'text-slate-500 text-[10px] font-medium mt-1 block relative z-10';
        }
    }

    // 4. Provider Badges & List
    const providers = ['aws', 'azure', 'gcp'];
    const providerList = document.getElementById('provider-list');
    if (providerList) providerList.innerHTML = ''; // Clear loading

    providers.forEach(p => {
        const pData = data[p];
        const isConnected = pData && !pData.error && pData.totalCost !== undefined;

        // Update header badges
        const badge = document.getElementById(`badge-${p}`);
        if (badge) {
            if (isConnected) {
                badge.classList.remove('grayscale', 'opacity-40');
                badge.classList.add('opacity-100');
            } else {
                badge.classList.add('grayscale', 'opacity-40');
                badge.classList.remove('opacity-100');
            }
        }

        // Add to active services list if connected
        if (isConnected && providerList) {
            const cost = parseFloat(pData.totalCost || 0);
            const providerColor = p === 'aws' ? '#FF9900' : p === 'azure' ? '#0078D4' : '#DB4437'; // AWS Orange, Azure Blue, GCP Red
            // Calculate width relative to total for visual bar
            const pct = total > 0 ? (cost / total) * 100 : 0;

            // Get top service name if avaiable
            const topService = pData.services && pData.services.length > 0 ? pData.services[0].name : 'Compute';

            const html = `
                <div class="flex items-center gap-3 py-1">
                    <div class="w-6 h-6 rounded flex items-center justify-center bg-slate-800 text-[9px] font-bold border border-slate-700" style="color: ${providerColor}">${p.toUpperCase()}</div>
                    <div class="flex-1">
                        <div class="flex justify-between text-[11px] mb-1">
                            <span class="text-slate-300 truncate max-w-[120px]">${topService}</span>
                            <span class="text-white font-mono">${fmt(cost, currency)}</span>
                        </div>
                        <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${providerColor}"></div>
                        </div>
                    </div>
                </div>
            `;
            providerList.insertAdjacentHTML('beforeend', html);
        }
    });

    // If no providers connected
    if (providerList && providerList.children.length === 0) {
        providerList.innerHTML = `<div class="text-center text-slate-500 text-xs py-2">No providers connected.<br>Click settings to configure.</div>`;
    }
}
