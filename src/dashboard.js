import './styles.css';
import Chart from 'chart.js/auto';

let costChartInstance = null;
let currentData = null; // Store data for filtering

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // 1. Refresh button
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('animate-spin');
            chrome.runtime.sendMessage({ action: "FORCE_REFRESH" }, () => {
                setTimeout(() => {
                    loadData();
                    refreshBtn.classList.remove('animate-spin');
                }, 2000);
            });
        });
    }

    // 2. Time Period Buttons & Date Display
    const timeButtons = [
        document.getElementById('btn-1d'),
        document.getElementById('btn-7d'),
        document.getElementById('btn-30d')
    ];
    const dateDisplay = document.querySelector('#date-range-display span');

    timeButtons.forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            // Remove active classes
            timeButtons.forEach(b => {
                if (b) b.className = "px-3 py-1.5 text-xs font-medium text-muted-text hover:text-white transition-colors cursor-pointer";
            });

            // Add active class
            e.target.className = "bg-white/10 rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm ring-1 ring-white/10 transition-colors cursor-default";

            const period = e.target.innerText.trim();

            // Update Date Display
            if (dateDisplay) {
                const today = new Date();
                const opts = { month: 'short', day: 'numeric' };
                if (period === '1D') {
                    dateDisplay.innerText = today.toLocaleDateString(undefined, opts);
                } else if (period === '7D') {
                    const past = new Date();
                    past.setDate(today.getDate() - 7);
                    dateDisplay.innerText = `${past.toLocaleDateString(undefined, opts)} - ${today.toLocaleDateString(undefined, opts)}`;
                } else {
                    const past = new Date();
                    past.setDate(today.getDate() - 30);
                    dateDisplay.innerText = `${past.toLocaleDateString(undefined, opts)} - ${today.toLocaleDateString(undefined, opts)}`;
                }
            }

            if (currentData) {
                renderChart(currentData, currentData.rate || 1.0, currentData.currency || 'USD', period);
            }
        });
    });

    // Chart Toggles (Visual only for now as we lack daily history for Azure/GCP)
    ['toggle-aws', 'toggle-azure', 'toggle-gcp'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                const isActive = el.classList.contains('bg-white/10');
                if (isActive) {
                    el.classList.remove('bg-white/10', 'border', 'border-white/5');
                    el.classList.add('opacity-60', 'hover:opacity-100');
                    el.querySelector('span:last-child').className = "text-xs font-medium text-muted-text";
                } else {
                    el.classList.add('bg-white/10', 'border', 'border-white/5');
                    el.classList.remove('opacity-60', 'hover:opacity-100');
                    el.querySelector('span:last-child').className = "text-xs font-medium text-white";
                }
            });
        }
    });

    // 3. Sidebar Links
    const sidebarLinks = document.querySelectorAll('aside nav a');
    sidebarLinks.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.innerText.trim();

        // Skip valid links logic
        if (href !== '#' && !href.startsWith('javascript')) return;

        link.addEventListener('click', (e) => {
            e.preventDefault();

            // Map links to IDs
            let targetId = null;
            if (text.includes("Overview")) targetId = 'card-overview';
            else if (text.includes("Cost Analytics")) targetId = 'card-chart';
            else if (text.includes("Budgets")) targetId = 'card-budget';
            else if (text.includes("Forecasting")) targetId = 'card-forecast';
            else if (text.includes("Alerts")) targetId = 'card-system';
            else if (text.includes("Support")) {
                window.open("https://github.com/naren/CloudSight/issues", "_blank");
                return;
            }

            if (targetId) {
                const el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Highlight effect
                    el.classList.add('ring-2', 'ring-indigo-500', 'transition-all', 'duration-500');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500'), 1500);
                }
            }
        });
    });

    // 4. Sidebar Status Rows (Click to Configure)
    const providerRows = [
        { id: 'status-aws-container', tab: 'aws' },
        { id: 'status-azure-container', tab: 'azure' },
        { id: 'status-gcp-container', tab: 'gcp' }
    ];

    providerRows.forEach(p => {
        const el = document.getElementById(p.id);
        if (el) {
            el.addEventListener('click', () => {
                // Open Options page with specific tab
                window.location.href = `options.html#${p.tab}`;
            });
        }
    });
});

// 5. Listen for updates (Fix for real-time updates)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.dashboardData || changes.cloudCreds) {
            loadData();
        }
    }
});


function loadData() {
    chrome.storage.local.get(['dashboardData', 'cloudCreds', 'encryptedCreds'], (result) => {
        const data = result.dashboardData;
        const creds = result.cloudCreds;
        const encrypted = result.encryptedCreds;

        // NEW: Check for Zero State (No Creds AND No Encrypted Data)
        // If encrypted data exists, we assume setup is done.
        const hasPlainCreds = creds && (creds.aws || creds.azure || creds.gcp);
        const hasEncryptedCreds = !!encrypted;

        if (!hasPlainCreds && !hasEncryptedCreds) {
            renderZeroState();
            return;
        }

        // We have credentials, so remove zero state if it exists
        const zeroState = document.getElementById('zero-state-overlay');
        if (zeroState) zeroState.remove();

        // Reset content visibility
        const content = document.querySelector('.p-8');
        if (content) content.style.opacity = '1';

        if (data) {
            currentData = data;
            updateDashboard(data);
            updateSidebarStatus(creds, data.isDemo, data);
        } else {
            // Creds exist but no data yet (Loading or Error)
            updatePlaceholder("Fetching Data...");
            updateSidebarStatus(creds, false, null);
            // Trigger fetch if just setup and not already fetching
            chrome.runtime.sendMessage({ action: "FORCE_REFRESH" });
        }
    });
}
// [renderZeroState function remains unchanged]

// ...

function updateSidebarStatus(creds, isDemo, data) {
    // Helper to set Active
    const setActive = (textId, containerId, dotId = null) => {
        const textEx = document.getElementById(textId);
        const contEx = document.getElementById(containerId);
        if (textEx) {
            textEx.textContent = "Active";
            textEx.className = "text-[10px] text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded";
        }
        if (contEx) {
            contEx.classList.remove("opacity-60");
            contEx.classList.add("opacity-100");
        }
        if (dotId) {
            const dot = document.getElementById(dotId);
            if (dot) {
                dot.classList.remove("bg-red-500", "bg-gray-500");
                dot.classList.add("bg-emerald-500");
            }
        }
    };

    // Fallback: If no raw creds (encrypted), use Data presence as indicator of active connection
    const useData = !creds && data;

    // AWS
    if ((creds && creds.aws && creds.aws.key) || (useData && data.aws && !data.aws.error)) {
        setActive(null, 'status-aws-container', 'status-aws-dot');
    }

    // Azure
    if ((creds && creds.azure && creds.azure.clientId) || (useData && data.azure && !data.azure.error)) {
        setActive('status-azure-text', 'status-azure-container');
    }

    // GCP
    if ((creds && creds.gcp && creds.gcp.json) || (useData && data.gcp && !data.gcp.error)) {
        setActive('status-gcp-text', 'status-gcp-container');
    }
}

function updateDashboard(data) {
    const currency = data.currency || 'USD';
    const rate = data.rate || 1.0;
    const format = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);

    const totalEl = document.getElementById('total-spend');
    if (totalEl) totalEl.innerText = format(data.totalGlobal || 0);

    let totalForecast = 0;
    if (data.aws?.forecast) totalForecast += parseFloat(data.aws.forecast);
    if (data.azure?.forecast) totalForecast += parseFloat(data.azure.forecast);
    if (data.gcp?.forecast) totalForecast += parseFloat(data.gcp.forecast);
    if (document.getElementById('forecast-spend')) document.getElementById('forecast-spend').innerText = format(totalForecast * rate);

    // Dynamic Budget Limit
    const limitRaw = data.budgetLimit || 1000;
    const budgetLimit = limitRaw * rate;

    const usedPct = budgetLimit > 0 ? ((data.totalGlobal / budgetLimit) * 100).toFixed(0) : 0;
    const remaining = Math.max(0, budgetLimit - data.totalGlobal); // Don't show negative

    if (document.getElementById('budget-used')) document.getElementById('budget-used').innerText = usedPct + "%";
    if (document.getElementById('budget-remaining')) document.getElementById('budget-remaining').innerText = format(remaining);

    const budgetCircle = document.getElementById('budget-circle');
    // Ensure stroke-dasharray doesn't break if pct > 100
    const dashPct = Math.min(usedPct, 100);
    if (budgetCircle) budgetCircle.setAttribute("stroke-dasharray", `${dashPct}, 100`);

    const statusEl = document.getElementById('system-status');
    const alertPill = document.getElementById('alert-pill');
    const alertCountStr = document.getElementById('alert-count');
    const anomalyBadge = document.getElementById('anomaly-badge');

    let errors = [];


    let statusText = "Active";
    let statusColor = "text-white";
    let alerts = [];

    // 1. Check Budget
    if (usedPct >= 100) {
        statusText = "Critical";
        statusColor = "text-red-500";
        alerts.push(`Budget Exceeded (${usedPct}%)`);
    } else if (usedPct >= 85) {
        statusText = "Warning";
        statusColor = "text-amber-500";
        alerts.push(`Budget Near Limit (${usedPct}%)`);
    }

    // 2. Check Errors
    // Fix: Ensure we display meaningful messages, not just 'true'
    const getErrorMsg = (err) => {
        if (typeof err === 'string') return err;
        if (err === true) return "Connection Failed (Check Credentials)";
        return "Unknown Error";
    };

    if (data.aws?.error) errors.push(`AWS: ${getErrorMsg(data.aws.error)}`);
    if (data.azure?.error) errors.push(`Azure: ${getErrorMsg(data.azure.error)}`);
    if (data.gcp?.error) errors.push(`GCP: ${getErrorMsg(data.gcp.error)}`);

    if (errors.length > 0) {
        statusText = "Attention";
        statusColor = "text-amber-500";
        alerts.push(...errors);
    }

    // 3. Render Status
    if (statusEl) {
        statusEl.innerText = statusText;
        statusEl.className = `text-3xl font-bold tracking-tight ${statusColor}`;

        // Make the card clickable for details
        const cardSystem = document.getElementById('card-system');
        if (cardSystem) {
            cardSystem.style.cursor = alerts.length > 0 ? 'pointer' : 'default';
            cardSystem.onclick = () => {
                if (alerts.length > 0) {
                    showAlertModal(alerts);
                }
            };
        }
    }

    // 4. Render Pill
    if (alertPill && alertCountStr) {
        if (alerts.length > 0) {
            alertPill.style.display = "inline-flex";
            alertCountStr.innerText = `${alerts.length} Alert(s)`;
            // Update pill color based on severity
            if (statusText === 'Critical') {
                alertPill.className = "flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-500 border border-red-500/20 animate-pulse";
                alertPill.querySelector('span').className = "h-1.5 w-1.5 rounded-full bg-red-500";
            } else {
                alertPill.className = "flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-500 border border-amber-500/20 animate-pulse";
                alertPill.querySelector('span').className = "h-1.5 w-1.5 rounded-full bg-amber-500";
            }
        } else {
            alertPill.style.display = "none";
        }
    }

    // 5. Anomaly Badge
    if (data.aws?.anomaly?.isAnomaly && anomalyBadge) {
        anomalyBadge.style.setProperty('display', 'flex', 'important');
        alerts.push("Anomaly: Unusual Spend Detected in AWS");
    }
    if (document.getElementById('last-updated') && data.lastUpdated) {
        document.getElementById('last-updated').innerText = new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function showAlertModal(alerts) {
        const modal = document.getElementById('alert-modal');
        const content = document.getElementById('alert-modal-content');
        const list = document.getElementById('alert-list');
        const btnClose = document.getElementById('close-modal');
        const btnResolve = document.getElementById('btn-resolve');

        if (!modal || !list) return;

        // Populate List
        list.innerHTML = '';
        alerts.forEach(alertMsg => {
            // Determine icon and color based on content
            let icon = 'error';
            let colorClass = 'text-red-400';
            let borderClass = 'border-red-500/20';
            let bgClass = 'bg-red-500/10';

            if (alertMsg.includes("Warning") || alertMsg.includes("Attention") || alertMsg.includes("Near Limit")) {
                icon = 'warning';
                colorClass = 'text-amber-400';
                borderClass = 'border-amber-500/20';
                bgClass = 'bg-amber-500/10';
            } else if (alertMsg.includes("Info")) {
                icon = 'info';
                colorClass = 'text-blue-400';
                borderClass = 'border-blue-500/20';
                bgClass = 'bg-blue-500/10';
            }

            const item = `
                <div class="flex items-start gap-3 p-3 rounded-lg border ${borderClass} ${bgClass}">
                    <span class="material-symbols-outlined ${colorClass} text-[20px] mt-0.5">${icon}</span>
                    <span class="text-sm text-slate-200 font-medium leading-relaxed">${alertMsg}</span>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', item);
        });

        // Show Modal
        modal.classList.remove('hidden');
        // Small delay for transition
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        });

        const closeModal = () => {
            modal.classList.add('opacity-0');
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        };

        btnClose.onclick = closeModal;
        btnResolve.onclick = closeModal;

        // Close on click outside
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }


    const awsCost = (data.aws?.totalCost || 0) * rate;
    const azureCost = (data.azure?.totalCost || 0) * rate;
    const gcpCost = (data.gcp?.totalCost || 0) * rate;
    const totalCalc = awsCost + azureCost + gcpCost;
    if (document.getElementById('dist-total')) document.getElementById('dist-total').innerText = (totalCalc / 1000).toFixed(1) + "k";

    const setDist = (id, cost) => {
        const el = document.getElementById(id);
        if (el && totalCalc > 0) el.innerText = Math.round((cost / totalCalc) * 100) + "%";
    };
    setDist('dist-aws-pct', awsCost);
    setDist('dist-azure-pct', azureCost);
    setDist('dist-gcp-pct', gcpCost);

    const listEl = document.getElementById('top-services-list');
    if (listEl) {
        listEl.innerHTML = '';
        let allServices = [];
        if (data.aws?.services) data.aws.services.forEach(s => allServices.push({ ...s, provider: 'AWS', color: '#FF9900' }));
        if (data.azure?.services) data.azure.services.forEach(s => allServices.push({ ...s, provider: 'Azure', color: '#0078D4' }));
        if (data.gcp?.services) data.gcp.services.forEach(s => allServices.push({ ...s, provider: 'GCP', color: '#DB4437' }));
        allServices.sort((a, b) => b.amount - a.amount);
        const top5 = allServices.slice(0, 5);

        // Icon Definitions
        const icons = {
            AWS: `<svg class="w-full h-full text-[#FF9900]" viewBox="0 0 24 24" fill="currentColor"><path d="M16.9 11.2c-.4.5-1.2.7-2.1.7-.8 0-1.5-.2-2-.5l.4-1.6c.4.2.9.4 1.4.4.4 0 .7-.1.9-.2.2-.1.3-.4.3-.6 0-.3-.1-.5-.4-.7-.3-.2-.7-.4-1.3-.5-.7-.1-1.2-.2-1.7-.4-.5-.2-1-.5-1.3-.9-.3-.5-.5-1.1-.5-1.8 0-.8.3-1.5.9-2 .6-.5 1.5-.8 2.5-.8 1.1 0 1.9.3 2.4.8.5.5.8 1.2.8 2.2h-1.6c0-.6-.2-1.2-.5-1.6-.3-.4-.8-.6-1.3-.6-.5 0-.9.2-1.2.5-.2.2-.4.4-.4.7 0 .2.1.4.3.5.2.1.4.2.8.3.5 0 .9.2 1.3.3.6.2 1.1.4 1.5.7.4.3.7.6.9 1 .2.4.3.9.3 1.5 0 .8-.2 1.4-.6 1.9zm-7.1-1.6c.6 0 1.1.2 1.4.6.3.4.5 1 .5 1.7h-5.2c.1-.7.3-1.3.6-1.7.4-.4.9-.6 1.5-.6h1.2zm-2.8 3.8c.2.4.4 1.1.4 2h4v.7c0 1.4-.3 2.5-1 3.3-.7.8-1.6 1.2-2.8 1.2-1.2 0-2.2-.4-2.9-1.3-.7-.9-1-2.3-1-4.1h3.3zm6.6 2.2c-.6 1-.7 1.4-1.1 1.9-.9 1.2-2.6 1.3-3.6 1.3-1.3 0-2.6-.5-3.3-1.2l-1.3 1.3c1.2 1.2 3 1.8 5 1.8 1.6 0 3.8-.4 5.3-2.6.2-.3 1-1.6 1.6-2.5l-2.6 0z" /><path d="M19 8h-1.5v3H16v1.5h1.5v3H19v-3h3V11h-3V8z" opacity="0.8"/></svg>`,
            Azure: `<svg class="w-full h-full text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor"><path d="M5.4 20l3.1-9.3 5.4 9.3H5.4zm-1.8-1l7.8-14h1.7l-4.2 14H3.6zm10.2 1l5.8-9.8h-4.6l-3.3 5.6 2.1 4.2z"/></svg>`,
            GCP: `<svg class="w-full h-full text-[#DB4437]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 24c6.6 0 12-5.4 12-12S18.6 0 12 0 0 5.4 0 12s5.4 12 12 12z" fill="#fff" fill-opacity="0.1"></path><path d="M12.3 10.3v3.4h4.8c-.2 1.2-1.4 3.5-4.8 3.5-2.9 0-5.3-2.4-5.3-5.3s2.4-5.3 5.3-5.3c1.3 0 2.5.5 3.4 1.3l2.7-2.7C16.8 3.7 14.7 2.7 12.3 2.7 7 2.7 2.7 7 2.7 12.3s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.8-.1-1.4-.2-2H12.3z"></path></svg>`
        };

        top5.forEach(s => {
            const amountConverted = s.amount * rate;
            const pct = totalCalc > 0 ? (amountConverted / totalCalc) * 100 : 0;
            const providerIcon = icons[s.provider] || '<span class="material-symbols-outlined text-[16px]">dns</span>';

            const html = `
            <div class="group">
                <div class="flex justify-between items-center text-sm mb-2">
                    <div class="flex items-center gap-3">
                        <div class="h-8 w-8 p-1.5 rounded flex items-center justify-center" style="background-color: ${s.color}1a;">
                            ${providerIcon}
                        </div>
                        <div class="flex flex-col">
                            <span class="font-medium text-slate-200">${s.name}</span>
                            <span class="text-[10px] text-muted-text uppercase tracking-wide">${s.provider}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-white">${format(amountConverted)}</span>
                    </div>
                </div>
                <div class="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div class="h-full rounded-full group-hover:brightness-110 transition-all duration-500" style="width: ${pct}%; background-color: ${s.color};"></div>
                </div>
            </div>`;
            listEl.insertAdjacentHTML('beforeend', html);
        });
        if (top5.length === 0) listEl.innerHTML = '<div class="text-center text-muted-text py-4">No data available</div>';
    }

    // Default to 14 days (or max available) initially
    renderChart(data, rate, currency, '30D');
}

function renderChart(data, rate, currency, period = '30D') {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;

    if (costChartInstance) {
        costChartInstance.destroy();
    }

    let history = data.aws?.history || [];

    // Filter History based on Period
    // history is array of { date: 'YYYY-MM-DD', cost: number }
    // Sort just in case
    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Slice
    if (period === '1D') {
        history = history.slice(-1);
    } else if (period === '7D') {
        history = history.slice(-7);
    } else {
        // 30D or Max (we only have ~14 days usually)
        history = history.slice(-30);
    }

    const labels = history.map(h => new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = history.map(h => h.cost * rate);

    if (values.length === 0) {
        ctx.style.display = 'none';
        return;
    } else {
        ctx.style.display = 'block';
    }

    costChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'AWS Daily Cost',
                data: values,
                borderColor: '#5E6AD2',
                backgroundColor: 'rgba(94, 106, 210, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
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
                    backgroundColor: '#1E293B',
                    titleColor: '#F8FAFC',
                    bodyColor: '#F8FAFC',
                    borderColor: '#334155',
                    borderWidth: 1,
                    callbacks: {
                        label: (context) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(context.raw)
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false },
                    ticks: { color: '#64748B', maxTicksLimit: 7 }
                },
                y: {
                    display: true,
                    grid: { color: '#334155', drawBorder: false },
                    ticks: { color: '#64748B', callback: (val) => val }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}
