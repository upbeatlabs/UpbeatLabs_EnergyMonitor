let currentChart; // Will hold our Chart.js instance
let voltageChart;
let powerFactorChart;
let lineFrequencyChart;
let activePowerChart;
let reactivePowerChart;
let apparentPowerChart;
let powerQuadrantChart;
let eventsChart;

// import { valueOrDefault } from './chart.js/helpers';


function fetchChartData() {
    fetch('/wattson-data')
        .then(response => response.json())
        .then(data => {
            if (!currentChart) {
                // First time: create the chart
                const ctx = document.getElementById('currentChart').getContext('2d');
                currentChart = createChart(ctx, data.energyData.currentRMS, 0.0, 15.0, 'A', 'Current RMS');
            } else {
                // Update chart data
                updateChart(currentChart, data.energyData.currentRMS, 0.0, 15.0, 'A', 'Current RMS');
            }

            if (!voltageChart) {
                // First time: create the chart
                const ctx = document.getElementById('voltageChart').getContext('2d');
                voltageChart = createChart(ctx, data.energyData.voltageRMS, 0.0, 150.0, 'V', 'Voltage RMS', 2);
            } else {
                // Update chart data
                updateChart(voltageChart, data.energyData.voltageRMS, 0.0, 150.0, 'V', 'Voltage RMS', 2);
            }            

            if (!lineFrequencyChart) {
                // First time: create the chart
                const ctx = document.getElementById('lineFrequencyChart').getContext('2d');
                lineFrequencyChart = createChart(ctx, data.energyData.lineFrequency, 0.0, 120.0, 'Hz', 'Line Frequency', 2);
            } else {
                // Update chart data
                updateChart(lineFrequencyChart, data.energyData.lineFrequency, 0.0, 120.0, 'Hz', 'Line Frequency', 2);
            }

            if (!powerFactorChart) {
                // First time: create the chart
                const ctx = document.getElementById('powerFactorChart').getContext('2d');
                powerFactorChart = createChart(ctx, data.energyData.powerFactor, 0.0, 1.0, '', 'Power Factor', 3);
            } else {
                // Update chart data
                updateChart(powerFactorChart, data.energyData.powerFactor, 0.0, 1.0, '', 'Power Factor', 3);
            }

            if (!activePowerChart) {
                // First time: create the chart
                const ctx = document.getElementById('activePowerChart').getContext('2d');
                activePowerChart = createChart(ctx, data.energyData.activePower, 0.0, 2000.0, 'W', 'Active Power', 3);
            } else {
                // Update chart data
                updateChart(activePowerChart, data.energyData.activePower, 0.0, 2000.0, 'W', 'Active Power', 3);
            }


            if (!powerQuadrantChart) {
                // First time: create the chart
                const ctx = document.getElementById('powerQuadrantChart').getContext('2d');
                powerQuadrantChart = createPQChart(ctx, data.powerQuadrant);
            } else {
                // Update chart data
                updatePQChart(powerQuadrantChart, data.powerQuadrant);
            }

            if (!eventsChart) {
                // First time: create the chart
                const ctx = document.getElementById('eventsChart').getContext('2d');
                eventsChart = createEventsChart(ctx, data.events);
            } else {
               // Update chart data
                updateEventsChart(eventsChart, data.events);
            }


            //const apspan = document.getElementById('activePower');
            //apspan.textContent = data.energyData.activePower + ' W';

            const rpspan = document.getElementById('reactivePower');
            rpspan.textContent = data.energyData.reactivePower + ' VAR';

            const appspan = document.getElementById('apparentPower');
            appspan.textContent = data.energyData.apparentPower + ' VA';

            const aeispan = document.getElementById('activeEnergyImport');
            aeispan.textContent = data.energyAccumData.activeEnergyImport + ' Wh';

            const aeespan = document.getElementById('activeEnergyExport');
            aeespan.textContent = data.energyAccumData.activeEnergyExport + ' Wh';

            const reispan = document.getElementById('reactiveEnergyImport');
            reispan.textContent = data.energyAccumData.reactiveEnergyImport + ' VARh';

            const reespan = document.getElementById('reactiveEnergyExport');
            reespan.textContent = data.energyAccumData.reactiveEnergyExport + ' VARh';

            const observationTime = document.getElementById('observationTime');
            observationTime.textContent = 'Last observed: ' + Date(data.timestamp);

            
        });
}

// Fetch data every 2 seconds
setInterval(fetchChartData, 2000);
// Initial fetch
fetchChartData();

function createChart(ctx, val, minVal, maxVal, units, description, decimalPlaces = 4) {
    let chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [(val.toFixed(decimalPlaces) - minVal).toFixed(decimalPlaces), (maxVal - val.toFixed(decimalPlaces)).toFixed(decimalPlaces)],
                backgroundColor: ['#007bff', '#e9ecef'],  // Active segment color and background color
                borderWidth: 0,
                cutout: '80%',
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Prevent the chart from resizing based on the aspect ratio of the canvas
            plugins: {
                annotation: {
                    annotations: {
                        doughnutLabel: {
                            type: 'doughnutLabel',
                            content: [
                                val.toFixed(decimalPlaces) + ' ' + units, // Show the gauge value
                                description // Optional description
                            ],
                            drawTime: 'afterDatasetsDraw',
                            position: 'center',
                            font: [{size: 30, weight: 'bold'}, {size: 16}], // Set font styles
                        }
                    }
                },
                tooltip: {
                    enabled: true
                },
                legend: {
                    display: true
                },
            }       
        }
    });
    return chart;
}

function updateChart(chart, val, minVal, maxVal, units, description, decimalPlaces = 4) {
    // Update chart data
    chart.data.datasets[0].data =  [(val.toFixed(decimalPlaces) - minVal).toFixed(decimalPlaces), (maxVal - val.toFixed(decimalPlaces)).toFixed(decimalPlaces)];
    const annotation = chart.options.plugins.annotation.annotations.doughnutLabel;
    annotation.content = ({chart}) => {
        return [
             val.toFixed(decimalPlaces) + ' ' + units,
             description 
        ];
    };
    chart.update();
}

const META = [[
  {color: 'rgb(0, 255, 0)', backgroundColor: 'rgba(0, 255, 0, 0.5)', label: 'Quadrant 3'},
  {color: 'rgb(255, 127, 0)', backgroundColor: 'rgba(255, 127, 0, 0.5)', label: 'Quadrant 4'},
], [
  {color: 'rgb(127, 255, 0)', backgroundColor: 'rgba(127, 255, 0, 0.5)', label: 'Quadrant 2'},
  {color: 'rgb(255, 0, 0)', backgroundColor: 'rgba(255, 0, 0, 0.5)', label: 'Quadrant 1'},
]];

const data = {
    datasets: [
        {
            data: [{ x: 0.5, y: 0.5, co: 'Consume, Inductive', co2: '+P, +Q'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        },
        {
            data: [{ x: -0.5, y: 0.5, co: 'Generate, Inductive', co2: '-P, +Q'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        },
        {
            data: [{ x: -0.5, y: -0.5, co: 'Generate, Capacitive', co2: '-P, -Q'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        },
        {
            data: [{ x: 0.5, y: -0.5, co: 'Consume, Capacitive', co2: '+P, -Q'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        }
    ]
};


function gradient({chart: {ctx}, element}, color, rtl = false) {
  const g = ctx.createLinearGradient(element.x, element.y, element.x2, element.y);
  g.addColorStop(rtl ? 1 : 0, color);
  g.addColorStop(rtl ? 0 : 1, 'transparent');
  return g;
}

function gridColor(context) {
  if (context.tick.value === 5) {
    return 'black';
  } else if (context.tick.value === 0 || context.tick.value === 10) {
    return 'black';
  }
  return 'transparent';
}



function createPQChart(ctx, val) {
    const annotation1 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META[1][0].backgroundColor),
        xMax: 0,
        yMin: 0,
        label: {
            content: META[1][0].label,
            position: {
                x: 'start',
                y: 'start'
            }
        }
    };

    const annotation2 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META[1][1].backgroundColor, true),
        xMin: 0,
        yMin: 0,
        label: {
            content: META[1][1].label,
            position: {
                x: 'end',
                y: 'start'
            }
        }
    };

    const annotation3 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META[0][0].backgroundColor),
        xMax: 0,
        yMax: 0,
        label: {
            content: META[0][0].label,
            position: {
                x: 'start',
                y: 'end'
            }
        }
    };

    const annotation4 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META[0][1].backgroundColor, true),
        xMin: 0,
        yMax: 0,
        label: {
            content: META[0][1].label,
            position: {
                x: 'end',
                y: 'end'
            }
        }
    };    

    
    const config = {
        type: 'scatter',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false, // Prevent the chart from resizing based on the aspect ratio of the canvas
            elements: {
                boxAnnotation: {
                    borderWidth: 0,
                    label: {
                        drawTime: 'beforeDatasetsDraw',
                        display: true,
                        font: {
                            size: 16
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Export Reactive Power',
                        font: {
                            size: 10
                        }
                    }
                },
                x2: {
                    position: 'top',
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Import Reactive Power',
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Export Active Power',
                        font: {
                            size: 10
                        }
                    }
                },
                y2: {
                    position: 'right',
                    display: true,
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Import Active Power',
                        font: {
                            size: 10
                        }
                    }                    
                }
            },
            plugins: {               
                legend: {
                    display: false, // Set to true to show the legend
                },
                annotation: {
                    common: {
                        drawTime: 'beforeDraw'
                    },
                    annotations: {
                        annotation1,
                        annotation2,
                        annotation3,
                        annotation4
                    }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: true,
                    usePointStyle: true,
                    footerAlign: 'right',
                    footerColor: 'lightGray',
                    footerMarginTop: 10,
                    callbacks: {
                        title: (items) => items[0].raw.co,
                        labelColor({raw}) {
                            const x = raw.x > 0 ? 1 : 0;
                            const y = raw.y > 0 ? 1 : 0;
                            return {
                                borderColor: META[y][x].color,
                                backgroundColor: META[y][x].backgroundColor,
                                borderWidth: 3
                            };
                        },
                        label({raw}) {
                            const x = raw.x > 0 ? 1 : 0;
                            const y = raw.y > 0 ? 1 : 0;
                            return META[y][x].label;
                        },
                        footer(items) {                         
                            return [items[0].raw.co2];
                        }
                    }
                }
            }
        }
    };

    let chart = new Chart(ctx, config);
    if (val > 0) {
        chart.data.datasets[val-1].backgroundColor = 'rgba(255,0,0,0.5)';
        chart.data.datasets[val-1].pointRadius = 16;
        
    }
    return chart;
}


function updatePQChart(chart, val) {
    chart.data.datasets[0].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[1].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[2].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[3].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[0].pointRadius = 10;
    chart.data.datasets[1].pointRadius = 10;
    chart.data.datasets[2].pointRadius = 10;
    chart.data.datasets[3].pointRadius = 10;

    if (val > 0) {
        chart.data.datasets[val-1].backgroundColor = 'rgba(255,0,0,0.5)';
        chart.data.datasets[val-1].pointRadius = 16;        
    }
    chart.update();
}

// [blue '#36a2eb', red '#ff6384', orange '#ff9f40', yellow '#ffcd56', teal green '#4bc0c0', purple '#9966ff', gray '#c9cbcf']

const META_EVENT = [[
  {color: '#4bc0c0', backgroundColor: '#4bc0c0', label: 'Voltage Sag'},
  {color: '#36a2eb', backgroundColor: '#36a2eb', label: 'Voltage Surge'},
], [
  {color: '#ffcd56', backgroundColor: '#ffcd56', label: 'Over Power'},
  {color: '#ff6384', backgroundColor: '#ff6384', label: 'Over Current'},
]];

const data_event = {
    datasets: [
        {
            data: [{ x: 0.5, y: 0.5, co: 'Over Current', co2: '> 0.18 A'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        },
        {
            data: [{ x: -0.5, y: 0.5, co: 'Over Power', co2: '> 16 W'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        },
        {
            data: [{ x: -0.5, y: -0.5, co: 'Voltage Sag', co2: '< 80 V'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        },
        {
            data: [{ x: 0.5, y: -0.5, co: 'Voltage Surge', co2: '> 130 V'}],
            pointRadius: 10,
            backgroundColor: 'rgba(54,161,235,0.5)'
        }
    ]
};

function createEventsChart(ctx, val) {
    const annotation1 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META_EVENT[1][0].backgroundColor),
        xMax: 0,
        yMin: 0,
        label: {
            content: META_EVENT[1][0].label,
            position: {
                x: 'start',
                y: 'start'
            }
        }
    };

    const annotation2 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META_EVENT[1][1].backgroundColor, true),
        xMin: 0,
        yMin: 0,
        label: {
            content: META_EVENT[1][1].label,
            position: {
                x: 'end',
                y: 'start'
            }
        }
    };

    const annotation3 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META_EVENT[0][0].backgroundColor),
        xMax: 0,
        yMax: 0,
        label: {
            content: META_EVENT[0][0].label,
            position: {
                x: 'start',
                y: 'end'
            }
        }
    };

    const annotation4 = {
        type: 'box',
        backgroundColor: (ctx) => gradient(ctx, META_EVENT[0][1].backgroundColor, true),
        xMin: 0,
        yMax: 0,
        label: {
            content: META_EVENT[0][1].label,
            position: {
                x: 'end',
                y: 'end'
            }
        }
    };    

    
    const config = {
        type: 'scatter',
        data: data_event,
        options: {
            responsive: true,
            maintainAspectRatio: false, // Prevent the chart from resizing based on the aspect ratio of the canvas
            elements: {
                boxAnnotation: {
                    borderWidth: 0,
                    label: {
                        drawTime: 'beforeDatasetsDraw',
                        display: true,
                        font: {
                            size: 16
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '',
                        font: {
                            size: 10
                        }
                    }
                },
                x2: {
                    position: 'top',
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '',
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '',
                        font: {
                            size: 10
                        }
                    }
                },
                y2: {
                    position: 'right',
                    display: true,
                    beginAtZero: true,
                    max: 1,
                    min: -1,
                    grid: {
                        drawTicks: false,
                        color: gridColor
                    },
                    ticks: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '',
                        font: {
                            size: 10
                        }
                    }                    
                }
            },
            plugins: {               
                legend: {
                    display: false, // Set to true to show the legend
                },
                annotation: {
                    common: {
                        drawTime: 'beforeDraw'
                    },
                    annotations: {
                        annotation1,
                        annotation2,
                        annotation3,
                        annotation4
                    }
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: true,
                    usePointStyle: true,
                    footerAlign: 'right',
                    footerColor: 'lightGray',
                    footerMarginTop: 10,
                    callbacks: {
                        title: (items) => items[0].raw.co,
                        labelColor({raw}) {
                            const x = raw.x > 0 ? 1 : 0;
                            const y = raw.y > 0 ? 1 : 0;
                            return {
                                borderColor: META_EVENT[y][x].color,
                                backgroundColor: META_EVENT[y][x].backgroundColor,
                                borderWidth: 3
                            };
                        },
                        label({raw}) {
                            const x = raw.x > 0 ? 1 : 0;
                            const y = raw.y > 0 ? 1 : 0;
                            return META_EVENT[y][x].label;
                        },
                        footer(items) {                         
                            return [items[0].raw.co2];
                        }
                    }
                }
            }
        }
    };

    let chart = new Chart(ctx, config);
    
    for (const item of val) {
        switch (item) {
        case 'Over Current':
            chart.data.datasets[0].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[0].pointRadius = 16;
            break;
        case 'Over Power':
            chart.data.datasets[1].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[1].pointRadius = 16;
            break;
        case 'Voltage Surge':
            chart.data.datasets[2].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[2].pointRadius = 16;
            break;
        case 'Voltage Sag':
            chart.data.datasets[3].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[3].pointRadius = 16;
            break;
        default:
            // Statements executed when none of the cases match the value of the expression
            break;
        }        
    }
    //if (val > 0) {
    //    chart.data.datasets[val-1].backgroundColor = 'rgba(255,0,0,0.5)';
    //    chart.data.datasets[val-1].pointRadius = 16;
    //    
    // }

    
    return chart;
}

function updateEventsChart(chart, val) {
    chart.data.datasets[0].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[1].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[2].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[3].backgroundColor = 'rgba(54,161,235,0.5)';
    chart.data.datasets[0].pointRadius = 10;
    chart.data.datasets[1].pointRadius = 10;
    chart.data.datasets[2].pointRadius = 10;
    chart.data.datasets[3].pointRadius = 10;

    for (const item of val) {
        switch (item) {
        case 'Over Current':
            chart.data.datasets[0].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[0].pointRadius = 16;
            break;
        case 'Over Power':
            chart.data.datasets[1].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[1].pointRadius = 16;
            break;
        case 'Voltage Surge':
            chart.data.datasets[2].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[2].pointRadius = 16;
            break;
        case 'Voltage Sag':
            chart.data.datasets[3].backgroundColor = 'rgba(255,0,0,0.5)';
            chart.data.datasets[3].pointRadius = 16;
            break;
        default:
            // Statements executed when none of the cases match the value of the expression
            break;
        }        
    }
    chart.update();
}


let myChart = null;


async function fetchMetricChartData(val) {
    const response = await fetch('/query-data?' + new URLSearchParams({
        metric: val,
    }).toString())
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
}

async function renderChart(val) {
    try {
        const data = await fetchMetricChartData(val);
        const ctx = document.getElementById('myChart').getContext('2d');

        // Destroy previous chart instance if exists
        if (myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: val,
                    data: data,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                parsing: {
                    xAxisKey: 'time',
                    yAxisKey: 'value'
                },
                scales: {
                    x: {
                        type: 'time',                     
                        ticks: {                           
                            display: true,
                            minRotation: 90                                 
                        }
                    }                  
                }
            }
        });
    } catch (err) {
        // Optional: Show error in modal
        document.querySelector('.modal-body').innerHTML = '<div class="alert alert-danger w-100 text-center">Error loading chart data.<br>' + err.message + '</div>';
    }
}

// Render chart after modal is fully shown
document.getElementById('chartModal').addEventListener('shown.bs.modal', function (event) {
  // Get the button that triggered the modal
  const link = event.relatedTarget;
  // Get the metric from data-metric-id attribute
  const metric = link ? link.getAttribute('data-metric-id') : null;
  // Call your chart rendering function with userId
  renderChart(metric);
});

// Optional: Destroy chart when modal is closed to free memory
document.getElementById('chartModal').addEventListener('hidden.bs.modal', function () {
    if (myChart) {
        myChart.destroy();
        myChart = null;
    }
    // Reset modal body in case an error was shown previously
    document.querySelector('.modal-body').innerHTML = '<canvas id="myChart"></canvas>';
});

