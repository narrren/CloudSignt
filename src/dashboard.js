import Chart from 'chart.js/auto';

// Helper: Format Currency
const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$'
};
function f(val, currency = 'USD') {
    const sym = CURRENCY_SYMBOLS[currency] || '$';
    return `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 1. Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const data = await chrome.storage.local.get(['dashboardData']);
    // if (data && data.dashboardData) {
    //     renderDashboard(data.dashboardData);
    // } else {
    //     // Handle empty state
    //     // document.getElementById('kpi-total').innerText = '$0.00';
    // }
});

function renderDashboard(data) {
    const currency = data.currency || 'USD';

    // ── 1. Update KPIs ────────────────────────────────────────────────────────

    // Total Spend
    document.getElementById('kpi-total').innerText = f(data.totalGlobal, currency);

    // Forecast
    let totalForecast = 0;
    ['aws', 'azure', 'gcp'].forEach(p => {
        if (data[p]?.forecast) totalForecast += parseFloat(data[p].forecast);
    });
    document.getElementById('kpi-forecast').innerText = f(totalForecast, currency);

    // Budget
    // Default budget $1000 if not set? Or use existing logic?
    const budgetLimit = 1000; // Hardcoded for demo, or fetch from settings if implemented
    const budgetPct = Math.min(100, (data.totalGlobal / budgetLimit) * 100).toFixed(0);
    const budgetRem = Math.max(0, budgetLimit - data.totalGlobal);

    document.getElementById('kpi-budget-pct').innerText = `${budgetPct}%`;
    document.getElementById('kpi-budget-rem').innerText = `${f(budgetRem, currency)} remaining`;

    // Update Budget Gauge SVG (Dasharray: value, 100)
    // The path id is 'gauge-path-fill'
    const gaugePath = document.getElementById('gauge-path-fill');
    if (gaugePath) {
        // Circumference is ~100. So we set first value to percentage.
        // Stroke-dasharray="pct, 100"
        gaugePath.setAttribute('stroke-dasharray', `${budgetPct}, 100`);
        // Color based on percentage
        if (budgetPct > 90) gaugePath.classList.remove('text-primary'); gaugePath.classList.add('text-rose-500');
    }

    // System Status
    // Logic: check errors
    const errors = [];
    if (data.aws?.error) errors.push('AWS');
    if (data.azure?.error) errors.push('Azure');
    if (data.gcp?.error) errors.push('GCP');

    const statusMain = document.getElementById('kpi-status-main');
    const statusSub = document.getElementById('kpi-status-sub');

    if (errors.length > 0) {
        statusMain.innerText = 'Attention';
        statusSub.innerText = `${errors.length} Alerts`;
        statusMain.classList.add('text-amber-500');
    } else {
        statusMain.innerText = 'Active';
        statusSub.innerText = 'Normal';
        statusMain.classList.remove('text-amber-500');
    }

    // Alerts Dot in Nav
    const navDot = document.getElementById('nav-alerts-indicator');
    if (errors.length > 0 && navDot) navDot.style.display = 'block';

    // Anomaly Header
    // Check data.anomaly or data.aws.anomaly
    const anomaly = data.aws?.anomaly; // Background script logic puts it here
    if (anomaly && anomaly.isAnomaly) {
        const headerAlert = document.getElementById('header-anomaly');
        const headerText = document.getElementById('header-anomaly-text');
        if (headerAlert) headerAlert.style.display = 'flex';
        if (headerText) headerText.innerText = `Spike detected: ${f(anomaly.today, currency)}`;
    }

    // ── 2. Provider Distribution (Donut SVG) ──────────────────────────────────
    // We need to calculate percentages for AWS, Azure, GCP
    const awsCost = data.aws?.totalCost || 0;
    const azureCost = data.azure?.totalCost || 0;
    const gcpCost = data.gcp?.totalCost || 0;
    const total = data.totalGlobal || 1; // avoid divide by zero

    const awsPct = (awsCost / total) * 100;
    const azurePct = (azureCost / total) * 100;
    const gcpPct = (gcpCost / total) * 100;

    // Update Text Legend
    document.getElementById('donut-pct-aws').innerText = `${awsPct.toFixed(0)}%`;
    document.getElementById('donut-pct-azure').innerText = `${azurePct.toFixed(0)}%`;
    document.getElementById('donut-pct-gcp').innerText = `${gcpPct.toFixed(0)}%`;
    document.getElementById('donut-total').innerText = f(total, currency); // Short format if needed

    // Update SVG Circles
    // Circle circumference ~100 (r=15.915)
    // AWS (Base): start 0
    document.getElementById('donut-path-aws')?.setAttribute('stroke-dasharray', `${awsPct}, 100`);

    // Azure (Next): start after AWS
    document.getElementById('donut-path-azure')?.setAttribute('stroke-dasharray', `${azurePct}, 100`);
    document.getElementById('donut-path-azure')?.setAttribute('stroke-dashoffset', `-${awsPct}`);

    // GCP (Next): start after AWS+Azure
    document.getElementById('donut-path-gcp')?.setAttribute('stroke-dasharray', `${gcpPct}, 100`);
    document.getElementById('donut-path-gcp')?.setAttribute('stroke-dashoffset', `-${awsPct + azurePct}`);


    // ── 3. Top Services List ──────────────────────────────────────────────────
    const servicesList = document.getElementById('services-list');
    if (servicesList) {
        servicesList.innerHTML = '';

        // Aggregate services from all providers
        let allServices = [];
        if (data.aws?.services) allServices.push(...data.aws.services.map(s => ({ ...s, provider: 'AWS', color: '#FF9900' })));
        if (data.azure?.services) allServices.push(...data.azure.services.map(s => ({ ...s, provider: 'Azure', color: '#0078D4' })));
        if (data.gcp?.services) allServices.push(...data.gcp.services.map(s => ({ ...s, provider: 'GCP', color: '#DB4437' })));

        // Sort by amount desc
        allServices.sort((a, b) => b.amount - a.amount);

        // Take top 5
        const top5 = allServices.slice(0, 5);

        top5.forEach(s => {
            const widthPct = (s.amount / allServices[0].amount) * 100; // Relative to max
            const html = `
            <div class="group">
                <div class="flex justify-between items-center text-sm mb-2">
                    <div class="flex items-center gap-3">
                        <div class="p-1.5 rounded bg-slate-800 text-[10px] font-bold" style="color: ${s.color}; border: 1px solid ${s.color}33">
                            ${s.provider}
                        </div>
                        <span class="font-medium text-slate-200">${s.name}</span>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-white">${f(s.amount, currency)}</span>
                    </div>
                </div>
                <div class="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500" style="width: ${widthPct}%; background-color: ${s.color}"></div>
                </div>
            </div>`;
            servicesList.insertAdjacentHTML('beforeend', html);
        });

        if (top5.length === 0) {
            servicesList.innerHTML = '<div class="text-center text-muted-text py-4">No services data available</div>';
        }
    }


    // ── 4. Charts (Trend) ─────────────────────────────────────────────────────
    const ctx = document.getElementById('trendChart');
    if (ctx) {
        // Aggregate history
        const historyMap = {};

        // Helper to add
        const addHist = (histArray) => {
            if (!histArray) return;
            histArray.forEach(day => {
                if (!historyMap[day.date]) historyMap[day.date] = 0;
                historyMap[day.date] += day.cost;
            });
        };

        if (data.aws?.history) addHist(data.aws.history);
        // Add others once implemented

        const labels = Object.keys(historyMap).sort();
        const values = labels.map(d => historyMap[d]);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(d => d.slice(5)), // MM-DD
                datasets: [{
                    label: 'Total Daily Spend',
                    data: values,
                    borderColor: '#6366F1', // Primary Indigo
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
                        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
                        return gradient;
                    },
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#151921',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: '#272B36',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        grid: { color: '#272B36', drawBorder: false },
                        ticks: { color: '#8A8F98', callback: (val) => '$' + val }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8A8F98' }
                    }
                }
            }
        });
    }

    // ── 5. Sidebar Status Dots ───────────────────────────────────────────────
    updateStatusDot('status-dot-aws', data.aws);
    updateStatusDot('status-dot-azure', data.azure);
    updateStatusDot('status-dot-gcp', data.gcp);
}

function updateStatusDot(id, pData) {
    const el = document.getElementById(id);
    if (!el) return;

    if (pData?.error) {
        el.classList.remove('bg-emerald-500', 'bg-slate-600');
        el.classList.add('bg-rose-500'); // Error
    } else if (pData?.totalCost !== undefined) {
        el.classList.remove('bg-slate-600', 'bg-rose-500');
        el.classList.add('bg-emerald-500'); // Active
        el.classList.add('shadow-[0_0_6px_rgba(16,185,129,0.8)]');
    } else {
        el.classList.add('bg-slate-600'); // Inactive/Loading
    }
}
