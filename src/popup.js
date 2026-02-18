import Chart from 'chart.js/auto';

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['dashboardData', 'lastUpdated'], (result) => {
        if (!result.dashboardData) {
            document.getElementById('total-cost').innerText = "No Data";
            return;
        }

        const data = result.dashboardData;

        // 1. Text Updates
        document.getElementById('total-cost').innerText = `$${data.totalCost.toFixed(2)}`;
        // Check if forecast exists and is valid
        const forecastVal = data.forecast ? parseFloat(data.forecast).toFixed(2) : "--";
        document.getElementById('forecast-cost').innerText = `$${forecastVal}`;
        document.getElementById('last-sync').innerText = result.lastUpdated ? new Date(result.lastUpdated).toLocaleTimeString() : "Never";

        // 2. Chart.js Visualization
        const ctx = document.getElementById('serviceChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.services.map(s => s.name),
                datasets: [{
                    data: data.services.map(s => s.amount),
                    backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Top 5 Services' }
                }
            }
        });
    });
});
