let metricChart;

class PeriodicRunner {
    constructor(fn, intervalMs) {
      this.fn = fn;
      this.intervalMs = intervalMs;
      this.inProgress = false;
      this.pending = false;
      this.stopped = false;
      this._timer = null;
    }
  
    async _run() {
      if (this.inProgress) {
        this.pending = true; // Queue another run if called during execution
        return;
      }
      this.inProgress = true;
      try {
        await this.fn();
      } finally {
        this.inProgress = false;
        if (this.pending) {
          this.pending = false;
          // Run immediately if a call was requested while busy
          this._run();
        } else if (!this.stopped) {
          // Schedule next periodic run
          this._timer = setTimeout(() => this._run(), this.intervalMs);
        }
      }
    }
  
    start() {
      if (this.stopped) {
        this.stopped = false;
        this._run();
      } else if (!this._timer) {
        this._run();
      }
    }
  
    stop() {
      this.stopped = true;
      clearTimeout(this._timer);
      this._timer = null;
    }
  
    triggerNow() {
      this.pending = true;
      this._run();
    }
  
    setIntervalMs(newIntervalMs) {
      this.intervalMs = newIntervalMs;
      // If running, restart the timer with the new interval
      if (!this.stopped) {
        clearTimeout(this._timer);
        this._timer = null;
        if (!this.inProgress) {
          this._run();
        }
        // If inProgress, next schedule will use new interval
      }
    }
}

async function fetchChartData(duration, aggregateWindow) {
    const urlParams = new URLSearchParams({
        duration: duration,
        aggregateWindow: aggregateWindow,
    });

    const response = await fetch('/query-all-data?' + urlParams.toString())
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
}

async function renderChart() {
    toggleSpinner(true);
    var e = document.getElementById("durationSelect");
    var value = e.value;
    const dictionary = JSON.parse(value);

    const data = await fetchChartData(dictionary["duration"], dictionary["aggregateWindow"]);

    if (!metricChart) {
        // First time: create the chart
        const ctx = document.getElementById('metricChart').getContext('2d');
        metricChart = createChart(ctx, data);
    } else {
        // Update chart data
        updateChart(metricChart, data);
    }
    toggleSpinner(false);
}

const runner = new PeriodicRunner(renderChart, 5000); // 5 seconds
runner.start();

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
            plugins: {
                decimation: {
                    enabled: true,
                    algorithm: 'min-max',
                  },
              },
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

function toggleSpinner(show) {
    const spinner = document.getElementById('mySpinner');
    spinner.style.display = show ? 'inline-flex' : 'none';
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

document.getElementById('durationSelect').addEventListener('change', function(event) {
    const selectedValue = event.target.value;
    const dictionary = JSON.parse(selectedValue);
    switch (dictionary["aggregateWindow"]) {
        case "10s":
          runner.setIntervalMs(5000);
          document.getElementById("refreshInterval").innerHTML = "Refreshing every 5s ";
          break;
        case "20s":
            runner.setIntervalMs(10000);
            document.getElementById("refreshInterval").innerHTML = "Refreshing every 10s ";

            break;
        case "30s":
            runner.setIntervalMs(15000);
            document.getElementById("refreshInterval").innerHTML = "Refreshing every 15s ";

            break;
        case "60s":
        case "1m":
            runner.setIntervalMs(30000);
            document.getElementById("refreshInterval").innerHTML = "Refreshing every 30s ";

            break; 
        case "2m":
            runner.setIntervalMs(60000);
            document.getElementById("refreshInterval").innerHTML = "Refreshing every 60s ";

            break;                       
        case "5m":
            runner.setIntervalMs(150000);
            document.getElementById("refreshInterval").innerHTML = "Refreshing every 2.5m ";

            break;  
        case "10m":
            runner.setIntervalMs(300000);
            document.getElementById("refreshInterval").innerHTML = "Refreshing every 5m ";

            break;              
        default:
          // Code to execute if no case matches
      }
    runner.triggerNow();
  });