let metricChart;

function fetchChartData() {
    // const urlParams = new URLSearchParams(window.location.search);

    // const metric = urlParams.get('metric') ?? 'CurrentRMS';
    
    fetch('/query-all-data')      
        .then(response => response.json())
        .then(data => {
            if (!metricChart) {
                // First time: create the chart
                const ctx = document.getElementById('metricChart').getContext('2d');
                metricChart = createChart(ctx, data);
            } else {
                // Update chart data
                updateChart(metricChart, data);
            }
        });
}

// Fetch data every 2 seconds
setInterval(fetchChartData, 2000);
// Initial fetch
fetchChartData();

function createChart(ctx, val, decimalPlaces = 4) {
    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Current RMS',
                data: val,
                parsing: {
                    yAxisKey: 'CurrentRMS'
                },
                tension: 0.4,

            }, {
                label: 'Voltage RMS',
                data: val,
                parsing: {
                    yAxisKey: 'VoltageRMS'
                },
                hidden: true,
                tension: 0.4,                

            }, {
                label: 'Line Frequency',
                data: val,
                parsing: {
                    yAxisKey: 'LineFrequency'
                },
                hidden: true,
                tension: 0.4,
            }, {
                label: 'Power Factor',
                data: val,
                parsing: {
                    yAxisKey: 'PowerFactor'
                },
                hidden: true,
                tension: 0.4,
            }, {
                label: 'Active Power',
                data: val,
                parsing: {
                    yAxisKey: 'ActivePower'
                },
                hidden: true,
                tension: 0.4,                

            }, {
                label: 'Reactive Power',
                data: val,
                parsing: {
                    yAxisKey: 'ReactivePower'
                },
                hidden: true,
                tension: 0.4,                

            }, {
                label: 'Apparent Power',
                data: val,
                parsing: {
                    yAxisKey: 'ApparentPower'
                },
                hidden: true,
                tension: 0.4,                
 
            }, {
                label: 'Active Energy Import',
                data: val,
                parsing: {
                    yAxisKey: 'ActiveEnergyImport'
                },
                hidden: true,
                tension: 0.4,                

            }, {
                label: 'Active Energy Export',
                data: val,
                parsing: {
                    yAxisKey: 'ActiveEnergyExport'
                },
                hidden: true,
                tension: 0.4,                

            }, {
                label: 'Reactive Energy Import',
                data: val,
                parsing: {
                    yAxisKey: 'ReactiveEnergyImport'
                },
                hidden: true,
                tension: 0.4,                
   
            }, {
                label: 'Reactive Energy Export',
                data: val,
                parsing: {
                    yAxisKey: 'ReactiveEnergyExport'
                },
                hidden: true,
                tension: 0.4,                

            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Prevent the chart from resizing based on the aspect ratio of the canvas
            parsing: {
                xAxisKey: 'time',
            },
            scales: {
                x: {
                    type: 'time',                     
                    ticks: {
                        display: true,
                        minRotation: 90,
                    }
                },
            }            
        }
    });
    return chart;
}

function updateChart(chart, val, decimalPlaces = 4) {
    // Update chart data
    chart.data.datasets[0].data =  val;
    chart.data.datasets[1].data =  val;    
    chart.data.datasets[2].data =  val;    
    chart.data.datasets[3].data =  val;    
    chart.data.datasets[4].data =  val;    
    chart.data.datasets[5].data =  val;    
    chart.data.datasets[6].data =  val;    
    chart.data.datasets[7].data =  val;    
    chart.data.datasets[8].data =  val;    
    chart.data.datasets[9].data =  val;    
    chart.data.datasets[10].data =  val;    

    chart.update('none');
}

function setMinMaxYaxis() {
    const minValue = document.getElementById("minVal").value;  
    const maxValue = document.getElementById("maxVal").value;  

    metricChart.options.scales.y.min = stringToFloatOrUndefined(minValue);
    metricChart.options.scales.y.max = stringToFloatOrUndefined(maxValue);
    metricChart.update('none');
}

function stringToFloatOrUndefined(str) {
  const n = parseFloat(str);
  return isNaN(n) ? undefined : n;
}
