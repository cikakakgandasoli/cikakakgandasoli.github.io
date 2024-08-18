const chartElementTemperature = document.getElementById('chartTemperature')
const chartElementHumidity = document.getElementById('chartHumidity')
let currentTemperature = document.getElementById("currentTemperature")
let currentHumidity = document.getElementById("currentHumidity")

let temperatureDataSets = [
    {
        label: 'Temperature',
        backgroundColor: 'rgb(17,76,122)',
        borderColor: 'rgb(17,76,122)',
    },
    {
        label: 'Temperature Air In',
        backgroundColor: 'rgb(92,185,77)',
        borderColor: 'rgb(92,185,77)',
    }
]

let humidityDataSets = [
    {
        label: 'Humidity',
        backgroundColor: 'rgb(17,76,122)',
        borderColor: 'rgb(17,76,122)',
    }
]


function initChart(canvas, datasets) {
    const data = {
        // labels: labels,
        datasets: datasets,
        options: {
            maintainAspectRatio: false,
            layout: {
                padding: {
                    bottom: 36
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        display: false
                    },
                    gridLines: {
                        display: false
                    }
                },
                y: {
                    afterFit: (c) => {
                        c.width = 40;
                    }
                }
            }
        }
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';

                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }

    };

    return new Chart(canvas, config);
}

function addData(chart, label, value, typeLine) {
    chart.data.labels.push(label);

    if (chart.data.labels.length > 60) {
        chart.data.labels.shift()
    }

    chart.data.datasets.forEach((dataset) => {
        if (!typeLine) {
            dataset.data.push(value);
            if (dataset.data.length > 60) {
                dataset.data.shift()
            }
        } else {
            if(dataset.label === typeLine) {
                dataset.data.push(value);
                if (dataset.data.length > 60) {
                    dataset.data.shift()
                }
            }
        }


        // if (dataset.label === 'Temperature') {
        //     dataset.data.push(temperature);
        //     if (dataset.data.length > 60) {
        //         dataset.data.shift()
        //     }
        // } else {
        //     dataset.data.push(humidity);
        //     if (dataset.data.length > 60) {
        //         dataset.data.shift()
        //     }
        //
        // }
    });
    chart.update();
}

let chartTemperature = initChart(chartElementTemperature, temperatureDataSets)
let chartHumidity = initChart(chartElementHumidity, humidityDataSets)

// MQTT setup
const options = {
    connectTimeout: 4000,
    // Authentication
    clientId: 'dehydrator_monitoring_' + Math.random().toString(16).substr(2, 8),
    keepalive: 60,
    clean: true,
};

const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', options);

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    $('#mqtt-status').text('Connected to MQTT');

    // Subscribe to topics
    client.subscribe('gandasoli/dehydrator/temperature', { qos: 0 }, (error) => {
        if (!error) {
            console.log('Subscribed to gandasoli/dehydrator/temperature');
        }
    });
    client.subscribe('gandasoli/dehydrator/temperature/airin', { qos: 0 }, (error) => {
        if (!error) {
            console.log('Subscribed to gandasoli/dehydrator/temperature');
        }
    });
    client.subscribe('gandasoli/dehydrator/humidity', { qos: 0 }, (error) => {
        if (!error) {
            console.log('Subscribed to gandasoli/dehydrator/humidity');
        }
    });
    client.subscribe('gandasoli/dehydrator/valueControl', { qos: 0 }, (error) => {
        if (!error) {
            console.log('Subscribed to gandasoli/dehydrator/valueControl');
        }
    });
    client.subscribe('gandasoli/dehydrator/setControl', { qos: 0 }, (error) => {
        if (!error) {
            console.log('Subscribed to gandasoli/dehydrator/setControl');
        }
    });
});

client.on('message', (topic, message) => {
    console.log('Received message:', topic, message.toString());
    switch (topic) {
        case "gandasoli/dehydrator/temperature":
            currentTemperature.textContent = message.toString()
            addData(chartTemperature, new Date().toLocaleTimeString(), message.toString(), "Temperature")

            const minTemp = parseFloat($('#minimumTemperature').val());
            const maxTemp = parseFloat($('#maximumTemperature').val());

            if (message > maxTemp) {
                $('#temperatureAlert').removeClass('d-none');
                $('#temperatureWarning').addClass('d-none');
            } else if (message < minTemp) {
                $('#temperatureWarning').removeClass('d-none');
                $('#temperatureAlert').addClass('d-none');
            } else {
                $('#temperatureAlert').addClass('d-none');
                $('#temperatureWarning').addClass('d-none');
            }

            break
        case "gandasoli/dehydrator/temperature/airin":
            addData(chartTemperature, new Date().toLocaleTimeString(), message.toString(), "Temperature Air In")
            break
        case "gandasoli/dehydrator/humidity":
            currentHumidity.textContent = message.toString()
            addData(chartHumidity, new Date().toLocaleTimeString(), message.toString())
            break
        case "gandasoli/dehydrator/valueControl":
            let min = message.toString().split(',')[0]
            let max = message.toString().split(',')[1]
            $('#minimumTemperature').val(min)
            $('#maximumTemperature').val(max)
            break
        case "gandasoli/dehydrator/setControl":

            break
    }

});

publishMessage("gandasoli/dehydrator/getControl", "")

$(document).on('click', '#btnChangeControl', function (e) {
    e.preventDefault()
    publishMessage("gandasoli/dehydrator/setControl", $('#minimumTemperature').val() + "," + $('#maximumTemperature').val())
})


client.on('error', (error) => {
    console.log('Connection error:', error);
    $('#mqtt-status').text('MQTT connection error');
});

client.on('reconnect', () => {
    console.log('Reconnecting...');
    $('#mqtt-status').text('Reconnecting to MQTT...');
});

client.on('offline', () => {
    console.log('Client is offline');
    $('#mqtt-status').text('MQTT client offline');
});

function publishMessage(topic, message) {
    client.publish(topic, message, { qos: 0, retain: false }, (error) => {
        if (error) {
            console.log('Publish error:', error);
        } else {
            console.log(`Message published to ${topic}: ${message}`);
        }
    });
}

// Google Weather API setup
// setup
function setupWeatherConditions() {
    const apiKey = "FM4ENQY5K4SFUTBWU8A6N3UQH";
    const geoLocation =  '-6.853934521167643, 106.92488036255702';
    const weatherURL = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${geoLocation}/today?key=${apiKey}`;

    $.getJSON(weatherURL, (data) => {
        console.log(data);
        const temperature = data.currentConditions.temp;
        const humidity = data.currentConditions.humidity;
        // const rainWarning = data.currentConditions.condition.text.toLowerCase().includes('rain') ? 'Yes' : 'No';

        $('#temperature').text(`Temperature: ${temperature} °C`);
        $('#humidity').text(`Humidity: ${humidity} %`);
        // $('#weather-warning').text(`Rain Warning: ${rainWarning}`);

        localStorage.setItem("weather", JSON.stringify(data));
    });
}

// setupWeatherConditions();

setInterval(() => {
    // setupWeatherConditions();
}, 3600000); // 1 hour

