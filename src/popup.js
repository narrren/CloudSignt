import Chart from 'chart.js/auto';

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['dashboardData', 'lastUpdated'], (result) => {
        const data = result.dashboardData;
        if (!data) {
            const costEl = document.getElementById('total-cost');
            costEl.innerText = "Setup Required";
            costEl.style.fontSize = "20px";
            costEl.style.cursor = "pointer";
            costEl.style.color = "#3498db";
            costEl.title = "Click to Open Settings";
            costEl.onclick = () => chrome.runtime.openOptionsPage();
            return;
        }


        // 1. Text Updates
        document.getElementById('total-cost').innerText = `$${data.totalGlobal.toFixed(2)}`;

        // Calculate Total Forecast
        const awsForecast = data.aws ? parseFloat(data.aws.forecast) : 0;
        const azureForecast = data.azure ? parseFloat(data.azure.forecast) : 0;
        const gcpForecast = data.gcp ? parseFloat(data.gcp.forecast) : 0;

        const totalForecast = awsForecast + azureForecast + gcpForecast;
        document.getElementById('forecast-cost').innerText = `$${totalForecast.toFixed(2)}`;
        document.getElementById('last-sync').innerText = result.dashboardData.lastUpdated ? new Date(result.dashboardData.lastUpdated).toLocaleTimeString() : "Never";

        // 2. Chart: Provider Breakdown
        const ctx = document.getElementById('serviceChart').getContext('2d');

        // Check which providers are active
        const labels = [];
        const values = [];
        const colors = [];

        if (data.aws && data.aws.totalCost > 0) { labels.push('AWS'); values.push(data.aws.totalCost); colors.push('#FF9900'); }
        if (data.azure && data.azure.totalCost > 0) { labels.push('Azure'); values.push(data.azure.totalCost); colors.push('#0078D4'); }
        if (data.gcp && data.gcp.totalCost > 0) { labels.push('GCP'); values.push(data.gcp.totalCost); colors.push('#4285F4'); }

        // If no cost, show empty state
        if (labels.length === 0) {
            labels.push('No Cost Data');
            values.push(1);
            colors.push('#E0E0E0');
        }

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Spend by Provider' }
                }
            }
        });
    });
});
