import './styles.css';
document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('btn-open-dashboard').addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard.html' });
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});

function loadData() {
    chrome.storage.local.get(['dashboardData'], (result) => {
        if (result.dashboardData) {
            updatePopup(result.dashboardData);
        }
    });
}

function updatePopup(data) {
    const currency = data.currency || 'USD';
    const rate = data.rate || 1.0;
    const format = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);

    // 1. Total Spend
    document.getElementById('popup-total-spend').innerText = format(data.totalGlobal || 0);

    // 2. Forecast
    let totalForecast = 0;
    if (data.aws?.forecast) totalForecast += parseFloat(data.aws.forecast);
    if (data.azure?.forecast) totalForecast += parseFloat(data.azure.forecast);
    if (data.gcp?.forecast) totalForecast += parseFloat(data.gcp.forecast);

    document.getElementById('popup-forecast-spend').innerText = format(totalForecast * rate);

    // 3. Status
    const statusDot = document.getElementById('popup-status-dot');
    const statusText = document.getElementById('popup-status-text');
    let errors = [];
    if (data.aws?.error) errors.push("AWS");
    if (data.azure?.error) errors.push("Azure");
    if (data.gcp?.error) errors.push("GCP");

    if (errors.length > 0) {
        statusDot.classList.remove('bg-emerald-500');
        statusDot.classList.add('bg-rose-500');
        statusText.innerText = "Attention Needed";
    } else {
        statusDot.classList.remove('bg-rose-500');
        statusDot.classList.add('bg-emerald-500');
        statusText.innerText = "System Active";
    }

    // 4. Header Icons
    const toggleIcon = (id, active) => {
        const el = document.getElementById(id);
        if (active) {
            el.classList.remove('grayscale', 'opacity-40');
        } else {
            el.classList.add('grayscale', 'opacity-40');
        }
    };
    // Check if distinct provider data exists > 0 or no error
    toggleIcon('status-aws', (data.aws && !data.aws.error && data.aws.totalCost >= 0));
    toggleIcon('status-azure', (data.azure && !data.azure.error && data.azure.totalCost >= 0));
    toggleIcon('status-gcp', (data.gcp && !data.gcp.error && data.gcp.totalCost >= 0));

    // 5. Services List (Top 3)
    const listEl = document.getElementById('popup-services-list');
    listEl.innerHTML = '';

    let allServices = [];
    if (data.aws?.services) data.aws.services.forEach(s => allServices.push({ ...s, provider: 'AWS', color: '#FF9900' }));
    if (data.azure?.services) data.azure.services.forEach(s => allServices.push({ ...s, provider: 'Azure', color: '#0078D4' }));
    if (data.gcp?.services) data.gcp.services.forEach(s => allServices.push({ ...s, provider: 'GCP', color: '#DB4437' }));

    allServices.sort((a, b) => b.amount - a.amount);
    const top3 = allServices.slice(0, 3);
    const totalCalc = (data.aws?.totalCost || 0) + (data.azure?.totalCost || 0) + (data.gcp?.totalCost || 0);

    const icons = {
        AWS: `<svg class="w-full h-full text-[#FF9900]" viewBox="0 0 24 24" fill="currentColor"><path d="M16.9 11.2c-.4.5-1.2.7-2.1.7-.8 0-1.5-.2-2-.5l.4-1.6c.4.2.9.4 1.4.4.4 0 .7-.1.9-.2.2-.1.3-.4.3-.6 0-.3-.1-.5-.4-.7-.3-.2-.7-.4-1.3-.5-.7-.1-1.2-.2-1.7-.4-.5-.2-1-.5-1.3-.9-.3-.5-.5-1.1-.5-1.8 0-.8.3-1.5.9-2 .6-.5 1.5-.8 2.5-.8 1.1 0 1.9.3 2.4.8.5.5.8 1.2.8 2.2h-1.6c0-.6-.2-1.2-.5-1.6-.3-.4-.8-.6-1.3-.6-.5 0-.9.2-1.2.5-.2.2-.4.4-.4.7 0 .2.1.4.3.5.2.1.4.2.8.3.5 0 .9.2 1.3.3.6.2 1.1.4 1.5.7.4.3.7.6.9 1 .2.4.3.9.3 1.5 0 .8-.2 1.4-.6 1.9zm-7.1-1.6c.6 0 1.1.2 1.4.6.3.4.5 1 .5 1.7h-5.2c.1-.7.3-1.3.6-1.7.4-.4.9-.6 1.5-.6h1.2zm-2.8 3.8c.2.4.4 1.1.4 2h4v.7c0 1.4-.3 2.5-1 3.3-.7.8-1.6 1.2-2.8 1.2-1.2 0-2.2-.4-2.9-1.3-.7-.9-1-2.3-1-4.1h3.3zm6.6 2.2c-.6 1-.7 1.4-1.1 1.9-.9 1.2-2.6 1.3-3.6 1.3-1.3 0-2.6-.5-3.3-1.2l-1.3 1.3c1.2 1.2 3 1.8 5 1.8 1.6 0 3.8-.4 5.3-2.6.2-.3 1-1.6 1.6-2.5l-2.6 0z" /><path d="M19 8h-1.5v3H16v1.5h1.5v3H19v-3h3V11h-3V8z" opacity="0.8"/></svg>`,
        Azure: `<svg class="w-full h-full text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor"><path d="M5.4 20l3.1-9.3 5.4 9.3H5.4zm-1.8-1l7.8-14h1.7l-4.2 14H3.6zm10.2 1l5.8-9.8h-4.6l-3.3 5.6 2.1 4.2z"/></svg>`,
        GCP: `<svg class="w-full h-full text-[#DB4437]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 24c6.6 0 12-5.4 12-12S18.6 0 12 0 0 5.4 0 12s5.4 12 12 12z" fill="#fff" fill-opacity="0.1"></path><path d="M12.3 10.3v3.4h4.8c-.2 1.2-1.4 3.5-4.8 3.5-2.9 0-5.3-2.4-5.3-5.3s2.4-5.3 5.3-5.3c1.3 0 2.5.5 3.4 1.3l2.7-2.7C16.8 3.7 14.7 2.7 12.3 2.7 7 2.7 2.7 7 2.7 12.3s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.8-.1-1.4-.2-2H12.3z"></path></svg>`
    };

    top3.forEach(s => {
        const amountConverted = s.amount * rate;
        const pct = totalCalc > 0 ? (s.amount / totalCalc) * 100 : 0;
        const providerIcon = icons[s.provider] || s.provider;

        const html = `
        <div class="flex items-center gap-3 py-1">
            <div class="w-6 h-6 rounded flex items-center justify-center p-1 bg-slate-800 border border-slate-700">
                ${providerIcon}
            </div>
            <div class="flex-1">
                <div class="flex justify-between text-[11px] mb-1">
                    <span class="text-slate-300 truncate w-24">${s.name}</span>
                    <span class="text-white font-mono">${format(amountConverted)}</span>
                </div>
                <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${s.color}"></div>
                </div>
            </div>
        </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });

    if (top3.length === 0) {
        listEl.innerHTML = '<div class="text-center text-[11px] text-slate-500">No active services found.</div>';
    }
}
