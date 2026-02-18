import Chart from 'chart.js/auto';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
const BUDGET_LIMIT_USD = 1000;

document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    document.getElementById('open-dashboard').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    });
    document.getElementById('open-options').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    chrome.storage.local.get(['dashboardData'], (result) => {
        const data = result.dashboardData;

        if (!data) {
            document.getElementById('total-cost').innerText = 'Setup Required';
            document.getElementById('total-cost').style.cursor = 'pointer';
            document.getElementById('total-cost').onclick = () => chrome.runtime.openOptionsPage();
            const banner = document.getElementById('alert-banner');
            banner.className = 'alert-banner warn';
            document.getElementById('alert-text').innerText = 'Click Settings to add cloud credentials';
            return;
        }

        const currency = data.currency || 'USD';
        const rate = data.rate || 1.0;
        const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
        const f = (v) => `${sym}${(v).toFixed(2)}`;
        const fRaw = (v) => `${sym}${(v * rate).toFixed(2)}`;
        const budgetLimit = BUDGET_LIMIT_USD * rate;

        // Sync time
        document.getElementById('sync-time').innerText = data.lastUpdated
            ? `Synced ${new Date(data.lastUpdated).toLocaleTimeString()}`
            : 'Never synced';

        // Hero
        document.getElementById('total-cost').innerText = f(data.totalGlobal);

        const awsForecast = parseFloat(data.aws?.forecast || 0);
        const azureForecast = parseFloat(data.azure?.forecast || 0);
        const gcpForecast = parseFloat(data.gcp?.forecast || 0);
        const totalForecast = (awsForecast + azureForecast + gcpForecast) * rate;
        document.getElementById('forecast-cost').innerText = f(totalForecast);

        // Budget
        const budgetPct = (data.totalGlobal / budgetLimit) * 100;
        const budgetEl = document.getElementById('budget-pct');
        budgetEl.innerText = `${budgetPct.toFixed(1)}%`;
        budgetEl.style.color = budgetPct >= 100 ? 'var(--red)' : budgetPct >= 80 ? 'var(--yellow)' : 'var(--green)';

        // Alerts
        let alertCount = 0;
        let alertMsg = 'All systems normal';
        let alertType = 'ok';
        if (data.aws?.anomaly?.isAnomaly) { alertCount++; alertMsg = `AWS Spike: ${fRaw(data.aws.anomaly.today)}`; alertType = 'danger'; }
        if (budgetPct >= 100) { alertCount++; alertMsg = `Budget exceeded! ${budgetPct.toFixed(0)}% used`; alertType = 'danger'; }
        else if (budgetPct >= 80) { alertCount++; alertMsg = `Budget warning: ${budgetPct.toFixed(0)}% used`; alertType = 'warn'; }

        document.getElementById('alert-count').innerText = alertCount;
        document.getElementById('alert-text').innerText = alertMsg;
        const banner = document.getElementById('alert-banner');
        banner.className = `alert-banner ${alertType}`;
        banner.querySelector('span').innerText = alertType === 'ok' ? '✅' : alertType === 'warn' ? '⚠️' : '🚨';

        // Provider pills
        document.getElementById('aws-cost').innerText = fRaw(data.aws?.totalCost || 0);
        document.getElementById('azure-cost').innerText = fRaw(data.azure?.totalCost || 0);
        document.getElementById('gcp-cost').innerText = fRaw(data.gcp?.totalCost || 0);

        // Chart
        const labels = [], values = [], colors = [];
        if ((data.aws?.totalCost || 0) > 0) { labels.push('AWS'); values.push((data.aws.totalCost) * rate); colors.push('#FF9900'); }
        if ((data.azure?.totalCost || 0) > 0) { labels.push('Azure'); values.push((data.azure.totalCost) * rate); colors.push('#0078D4'); }
        if ((data.gcp?.totalCost || 0) > 0) { labels.push('GCP'); values.push((data.gcp.totalCost) * rate); colors.push('#4285F4'); }
        if (values.length === 0) { labels.push('No Data'); values.push(1); colors.push('#30363d'); }

        new Chart(document.getElementById('serviceChart'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#161b22'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8b949e', font: { size: 11 }, padding: 10 }
                    },
                    tooltip: {
                        callbacks: { label: ctx => ` ${sym}${ctx.parsed.toFixed(2)}` }
                    }
                }
            }
        });
    });
});
