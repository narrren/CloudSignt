import Chart from 'chart.js/auto';

// ── Helpers ──────────────────────────────────────────────────────────────────
const BUDGET_LIMIT_USD = 1000;

const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥'
};

function fmt(val, currency, rate = 1) {
    const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
    return `${sym}${(val * rate).toFixed(2)}`;
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function providerStatus(providerData) {
    if (!providerData || providerData.error) return ['Not Connected', 'status-nc'];
    if (providerData.anomaly?.isAnomaly) return ['⚠ Spike', 'status-warn'];
    return ['✓ OK', 'status-ok'];
}

// ── Main ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Buttons
    document.getElementById('refresh-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'FORCE_REFRESH' });
        setEl('sync-badge', '⏳ Refreshing…');
        setTimeout(() => location.reload(), 8000);
    });
    document.getElementById('nav-refresh')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.sendMessage({ action: 'FORCE_REFRESH' });
        setEl('sync-badge', '⏳ Refreshing…');
        setTimeout(() => location.reload(), 8000);
    });
    document.getElementById('open-options')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Load Data
    const result = await chrome.storage.local.get(['dashboardData']);
    const data = result.dashboardData;

    if (!data) {
        setEl('sync-badge', '⚠ No Data – Configure Settings');
        document.getElementById('kpi-total').innerText = 'Setup Required';
        document.getElementById('kpi-total').style.cursor = 'pointer';
        document.getElementById('kpi-total').onclick = () => chrome.runtime.openOptionsPage();
        document.getElementById('alerts-list').innerHTML = `
      <div class="alert-item info">
        <div class="alert-icon">ℹ️</div>
        <div>
          <div class="alert-title">No cloud credentials configured</div>
          <div class="alert-desc">Click Settings to add your AWS, Azure, or GCP credentials.</div>
        </div>
      </div>`;
        return;
    }

    // ── Decryption Error State ───────────────────────────────────────────────────
    if (data.decryptionError) {
        setEl('sync-badge', '⚠ Decryption Error');
        document.getElementById('kpi-total').innerText = 'Error';
        document.getElementById('alerts-list').innerHTML = `
      <div class="alert-item danger">
        <div class="alert-icon">🔐</div>
        <div>
          <div class="alert-title">Credential Decryption Failed</div>
          <div class="alert-desc">${data.errorMessage || 'Please re-open Settings and re-save your credentials.'}</div>
        </div>
      </div>`;
        setEl('kpi-alerts', '1');
        setEl('kpi-alert-sub', 'Decryption error');
        return;
    }

    // ── Not Configured State ─────────────────────────────────────────────────────
    if (data.notConfigured) {
        setEl('sync-badge', '⚠ Not Configured');
        document.getElementById('kpi-total').innerText = 'Setup Required';
        document.getElementById('kpi-total').style.cursor = 'pointer';
        document.getElementById('kpi-total').onclick = () => chrome.runtime.openOptionsPage();
        document.getElementById('alerts-list').innerHTML = `
      <div class="alert-item info">
        <div class="alert-icon">ℹ️</div>
        <div>
          <div class="alert-title">No cloud credentials configured</div>
          <div class="alert-desc">Click Settings to add your AWS, Azure, or GCP credentials.</div>
        </div>
      </div>`;
        return;
    }

    const currency = data.currency || 'USD';
    const rate = data.rate || 1.0;
    const budgetLimit = BUDGET_LIMIT_USD * rate;
    const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
    const f = (val) => fmt(val, currency);  // already-converted values
    const fRaw = (val) => fmt(val, currency, rate); // raw USD values

    // ── Sync Badge ──────────────────────────────────────────────────────────────
    const syncTime = data.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Never';
    setEl('sync-badge', `✓ Synced ${syncTime}`);
    setEl('sidebar-sync', syncTime);
    setEl('kpi-updated', `Updated ${syncTime}`);
    setEl('currency-badge', currency);

    // ── KPI Cards ───────────────────────────────────────────────────────────────
    setEl('kpi-total', f(data.totalGlobal));

    const awsCost = (data.aws?.totalCost || 0);
    const azureCost = (data.azure?.totalCost || 0);
    const gcpCost = (data.gcp?.totalCost || 0);

    const awsForecast = parseFloat(data.aws?.forecast || 0);
    const azureForecast = parseFloat(data.azure?.forecast || 0);
    const gcpForecast = parseFloat(data.gcp?.forecast || 0);
    const totalForecast = (awsForecast + azureForecast + gcpForecast) * rate;

    setEl('kpi-forecast', f(totalForecast));

    // Budget
    const budgetPct = (data.totalGlobal / budgetLimit) * 100;
    setEl('kpi-budget-pct', `${budgetPct.toFixed(1)}%`);
    setEl('kpi-budget-sub', `of ${sym}${budgetLimit.toFixed(0)} limit`);
    const budgetCard = document.getElementById('kpi-budget-card');
    if (budgetPct >= 100) {
        budgetCard.classList.add('red');
    } else if (budgetPct >= 80) {
        budgetCard.classList.add('yellow');
    } else {
        budgetCard.classList.add('green');
    }

    // Provider KPIs
    setEl('kpi-aws', fRaw(awsCost));
    setEl('kpi-azure', fRaw(azureCost));
    setEl('kpi-gcp', fRaw(gcpCost));
    setEl('kpi-aws-sub', data.aws?.error ? 'Not connected' : `Forecast: ${fRaw(awsForecast)}`);
    setEl('kpi-azure-sub', data.azure?.error ? 'Not connected' : `Forecast: ${fRaw(azureForecast)}`);
    setEl('kpi-gcp-sub', data.gcp?.error ? 'Not connected' : `Forecast: ${fRaw(gcpForecast)}`);

    // ── Alerts ──────────────────────────────────────────────────────────────────
    const alerts = [];
    if (budgetPct >= 100) alerts.push({ type: 'danger', icon: '🚨', title: 'Budget Exceeded!', desc: `You have used ${budgetPct.toFixed(1)}% of your ${sym}${budgetLimit.toFixed(0)} limit.` });
    else if (budgetPct >= 80) alerts.push({ type: 'warn', icon: '⚠️', title: 'Budget Warning', desc: `${budgetPct.toFixed(1)}% of budget used. Approaching limit.` });
    if (data.aws?.anomaly?.isAnomaly) alerts.push({ type: 'danger', icon: '📈', title: 'AWS Cost Spike', desc: `Yesterday's spend (${fRaw(data.aws.anomaly.today)}) was >3× the 14-day average (${fRaw(data.aws.anomaly.average)}).` });
    if (totalForecast > budgetLimit * 1.1) alerts.push({ type: 'warn', icon: '🔮', title: 'Forecast Exceeds Budget', desc: `Predicted EOM bill of ${f(totalForecast)} exceeds your limit.` });
    // Only show "No Providers Connected" if ALL providers have errors AND total is 0
    // (i.e. not just Azure/GCP being unconfigured while AWS is working)
    if (data.aws?.error && data.azure?.error && data.gcp?.error && data.totalGlobal === 0) {
        alerts.push({ type: 'warn', icon: '⚠️', title: 'No Cost Data Available', desc: 'AWS fetch may have failed. Check your credentials in Settings or wait for the next refresh.' });
    }

    setEl('kpi-alerts', alerts.length);
    setEl('kpi-alert-sub', alerts.length === 0 ? 'All systems normal' : `${alerts.length} issue${alerts.length > 1 ? 's' : ''} detected`);
    setEl('alerts-count-label', `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`);

    const alertBadge = document.getElementById('alert-badge');
    if (alerts.length > 0) {
        alertBadge.style.display = 'inline';
        alertBadge.innerText = alerts.length;
    }

    const alertsList = document.getElementById('alerts-list');
    if (alerts.length === 0) {
        alertsList.innerHTML = `<div class="no-alerts">✅ No alerts. Everything looks healthy!</div>`;
    } else {
        alertsList.innerHTML = alerts.map(a => `
      <div class="alert-item ${a.type}">
        <div class="alert-icon">${a.icon}</div>
        <div>
          <div class="alert-title">${a.title}</div>
          <div class="alert-desc">${a.desc}</div>
        </div>
      </div>`).join('');
    }

    // ── Provider Status Cards ────────────────────────────────────────────────────
    ['aws', 'azure', 'gcp'].forEach(p => {
        const [label, cls] = providerStatus(data[p]);
        const el = document.getElementById(`${p}-status`);
        if (el) { el.innerText = label; el.className = `provider-status ${cls}`; }
    });

    setEl('aws-mtd', fRaw(awsCost));
    setEl('aws-forecast', fRaw(awsForecast));
    setEl('aws-top', data.aws?.services?.[0]?.name || '–');
    setEl('aws-anomaly', data.aws?.anomaly?.isAnomaly ? `⚠ Spike: ${fRaw(data.aws.anomaly.today)}` : '✓ Normal');

    setEl('azure-mtd', fRaw(azureCost));
    setEl('azure-forecast', fRaw(azureForecast));
    setEl('azure-top', data.azure?.services?.[0]?.name || '–');

    setEl('gcp-mtd', fRaw(gcpCost));
    setEl('gcp-forecast', fRaw(gcpForecast));

    // ── Services Table ───────────────────────────────────────────────────────────
    const services = data.aws?.services || [];
    const maxCost = services[0]?.amount || 1;
    const tbody = document.getElementById('services-tbody');
    if (services.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:20px;">No AWS service data available</td></tr>`;
    } else {
        tbody.innerHTML = services.map(s => {
            const pct = (s.amount / maxCost) * 100;
            return `
        <tr>
          <td>${s.name}</td>
          <td style="font-weight:600;">${fRaw(s.amount)}</td>
          <td>
            <div class="bar-row">
              <div class="bar-bg"><div class="bar-fill" style="width:${pct}%;background:var(--aws);"></div></div>
              <span style="font-size:11px;color:var(--muted);min-width:35px;">${pct.toFixed(0)}%</span>
            </div>
          </td>
        </tr>`;
        }).join('');
    }

    // ── Chart 1: 14-Day Trend Line ───────────────────────────────────────────────
    const history = data.aws?.history || [];
    const trendLabels = history.length
        ? history.map(h => h.date.slice(5))   // MM-DD
        : Array.from({ length: 14 }, (_, i) => `Day ${i + 1}`);
    const trendValues = history.length
        ? history.map(h => h.cost * rate)
        : Array(14).fill(0);

    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [
                {
                    label: 'AWS Daily',
                    data: trendValues,
                    borderColor: '#FF9900',
                    backgroundColor: 'rgba(255,153,0,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#8b949e', font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${sym}${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
                y: {
                    ticks: { color: '#8b949e', font: { size: 10 }, callback: v => `${sym}${v}` },
                    grid: { color: '#21262d' }
                }
            }
        }
    });

    // ── Chart 2: Provider Donut ──────────────────────────────────────────────────
    const donutLabels = [];
    const donutValues = [];
    const donutColors = [];
    if (awsCost > 0) { donutLabels.push('AWS'); donutValues.push(awsCost * rate); donutColors.push('#FF9900'); }
    if (azureCost > 0) { donutLabels.push('Azure'); donutValues.push(azureCost * rate); donutColors.push('#0078D4'); }
    if (gcpCost > 0) { donutLabels.push('GCP'); donutValues.push(gcpCost * rate); donutColors.push('#4285F4'); }
    if (donutValues.length === 0) { donutLabels.push('No Data'); donutValues.push(1); donutColors.push('#30363d'); }

    new Chart(document.getElementById('donutChart'), {
        type: 'doughnut',
        data: {
            labels: donutLabels,
            datasets: [{ data: donutValues, backgroundColor: donutColors, borderWidth: 2, borderColor: '#161b22' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 11 }, padding: 12 } },
                tooltip: { callbacks: { label: ctx => ` ${sym}${ctx.parsed.toFixed(2)}` } }
            }
        }
    });

    // ── Chart 3: Top Services Bar ────────────────────────────────────────────────
    const svcLabels = services.map(s => s.name.replace('Amazon ', '').replace('AWS ', ''));
    const svcValues = services.map(s => s.amount * rate);

    new Chart(document.getElementById('servicesChart'), {
        type: 'bar',
        data: {
            labels: svcLabels.length ? svcLabels : ['No Data'],
            datasets: [{
                label: 'Cost',
                data: svcValues.length ? svcValues : [0],
                backgroundColor: ['#FF9900', '#ffb84d', '#ffd699', '#ffe5b3', '#fff2d9'],
                borderRadius: 4,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${sym}${ctx.parsed.x.toFixed(2)}` } }
            },
            scales: {
                x: { ticks: { color: '#8b949e', font: { size: 10 }, callback: v => `${sym}${v}` }, grid: { color: '#21262d' } },
                y: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { display: false } }
            }
        }
    });

    // ── Chart 4: Budget Gauge (Doughnut) ────────────────────────────────────────
    const gaugeUsed = Math.min(data.totalGlobal, budgetLimit);
    const gaugeRemaining = Math.max(budgetLimit - data.totalGlobal, 0);
    const gaugeColor = budgetPct >= 100 ? '#f85149' : budgetPct >= 80 ? '#d29922' : '#3fb950';

    new Chart(document.getElementById('gaugeChart'), {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Remaining'],
            datasets: [{
                data: [gaugeUsed, gaugeRemaining],
                backgroundColor: [gaugeColor, '#21262d'],
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180,
            rotation: -90,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${sym}${ctx.parsed.toFixed(2)}` } }
            }
        },
        plugins: [{
            id: 'gaugeText',
            afterDraw(chart) {
                const { ctx, chartArea: { top, width, height } } = chart;
                ctx.save();
                ctx.font = 'bold 18px Inter, sans-serif';
                ctx.fillStyle = '#e6edf3';
                ctx.textAlign = 'center';
                ctx.fillText(`${budgetPct.toFixed(0)}%`, width / 2, top + height * 0.85);
                ctx.font = '11px Inter, sans-serif';
                ctx.fillStyle = '#8b949e';
                ctx.fillText('of budget', width / 2, top + height * 0.85 + 18);
                ctx.restore();
            }
        }]
    });

    // ── Chart 5: Forecast vs Actual Bar ─────────────────────────────────────────
    new Chart(document.getElementById('forecastChart'), {
        type: 'bar',
        data: {
            labels: ['AWS', 'Azure', 'GCP'],
            datasets: [
                {
                    label: 'Actual (MTD)',
                    data: [awsCost * rate, azureCost * rate, gcpCost * rate],
                    backgroundColor: 'rgba(88,166,255,0.7)',
                    borderRadius: 4,
                },
                {
                    label: 'Forecast (EOM)',
                    data: [awsForecast * rate, azureForecast * rate, gcpForecast * rate],
                    backgroundColor: 'rgba(188,140,255,0.7)',
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#8b949e', font: { size: 11 } } },
                tooltip: { callbacks: { label: ctx => ` ${sym}${ctx.parsed.y.toFixed(2)}` } }
            },
            scales: {
                x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { display: false } },
                y: { ticks: { color: '#8b949e', font: { size: 10 }, callback: v => `${sym}${v}` }, grid: { color: '#21262d' } }
            }
        }
    });

});
