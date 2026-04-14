const {ipcRenderer, dialog} = require("electron");

function goHome() {
    ipcRenderer.send("navigateHome");
}


/*
Discovered Devices
 */
// Identified BLE Devices (AEMS BLE scan UI)
let UMIDiscoveredDevices = []


/*
Page Specific Functions
 */
ipcRenderer.on("UMIDevicesDiscovered", (e, args) => {
    // Append to the list of discovered devices
    UMIDiscoveredDevices.push(args);

    // Call create SVGs based on what is available
    UMIDiscoveredDevices.forEach((device, index) => {
        let svg = document.getElementById(device.localName)
        if(svg === null){
            addRandomSvg(device.localName);
        }
    })
})

function searchAEMSDevices() {
    ipcRenderer.send("searchAEMSDevices");
}


/**
 * Processes and validates the DAQ (Data Acquisition) configuration provided through the user interface.
 * If validation is successful, the configuration is sent via `ipcRenderer` to initiate DAQ operation.
 *
 * @return {void} Returns nothing. Alerts the user in case of invalid inputs or sends the valid configuration.
 */
function processDAQConfiguration() {
    const fileName = document.getElementById("saveFileName").value;
    const numChannels = parseInt(document.getElementById("numChannels").value, 10);
    const samplingRate = parseInt(document.getElementById("samplingRate").value, 10);
    const daqDuration = parseInt(document.getElementById("daqDuration").value, 10);

    // Validation
    if (!fileName.endsWith(".bin")) {
        alert("Save File Name must end with .bin");
        return;
    }

    if (fileName.length > 20) {
        alert("The file name is too large.");
        return;
    }

    if (isNaN(numChannels) || numChannels < 1 || numChannels > 8) {
        alert("Number of channels must be between 1 and 8");
        return;
    }

    if (isNaN(samplingRate) || samplingRate < 100 || samplingRate > 32000) {
        alert("Sampling rate must be between 100 Hz and 32000 Hz");
        return;
    }

    if (isNaN(daqDuration) || daqDuration > 3600) {
        alert("DAQ duration must be at most 3600 seconds");
        return;
    }

    // Sending configuration via ipcRenderer
    ipcRenderer.send("startBLE-AEMS-DAQ", {
        fileName: fileName,
        numChannels: numChannels,
        samplingRate: samplingRate,
        daqDuration: daqDuration
    });
}

ipcRenderer.on("statusUpdated", (e, args) => {

    console.log(args);

    for (const key in args) {
        if (args.hasOwnProperty(key)) {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = `${key.replace("status", "").replace(/([A-Z])/g, ' $1').trim()}: ${args[key]} ${key.includes("V") ? "V" : "A"}`;
            }
        }
    }
});

function stopAEMSbleDAQ(){
    ipcRenderer.send("stopAEMSbleDAQ");
}

/**
 * Adds a randomly positioned SVG element to the document and customizes it with the given device name.
 *
 * @param {string} deviceName - The name of the device, which is used to customize the SVG's ID, gradient, and text.
 * @return {void} This method does not return a value.
 */
function addRandomSvg(deviceName) {
    // Fetch the SVG content
    fetch('../images/ed.svg')
        .then(response => response.text())
        .then(svgContent => {
            // Create SVG element
            let svg = new DOMParser().parseFromString(svgContent, 'image/svg+xml').documentElement;

            // Set random position for SVG
            svg.setAttribute('x', getRandomNumber(0, window.innerWidth - 200));
            svg.setAttribute('y', getRandomNumber(window.innerHeight / 2, window.innerHeight - 200));
            svg.setAttribute("id", deviceName);
            // Update ID of auraGradient
            let auraGradient = svg.querySelector('#auraGradient');
            if (auraGradient) {
                auraGradient.setAttribute("id", deviceName + "_auraGradient");
            }
            // Update fill color of circle
            let circle = svg.querySelector('circle');
            if (circle) {
                circle.setAttribute("fill", "url" + "(#" + deviceName + "_auraGradient)");
            }

            // Update text content
            let textElement = svg.querySelector( 'text');
            if (textElement) {
                let [firstLine, secondLine] = deviceName.split('-');

                // Clear existing text
                textElement.innerHTML = '';

                // Create first tspan
                let tspan1 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                tspan1.setAttribute("x", textElement.getAttribute("x")); // Align with text X position
                tspan1.setAttribute("dy", "0"); // No offset for first line
                tspan1.textContent = firstLine;

                // Create second tspan
                let tspan2 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
                tspan2.setAttribute("x", textElement.getAttribute("x")); // Keep X alignment
                tspan2.setAttribute("dy", "1.2em"); // Move second line below
                tspan2.textContent = secondLine;

                // Append tspan elements
                textElement.appendChild(tspan1);
                textElement.appendChild(tspan2);
            }

            // Add listeners
            svg.addEventListener('click', () => {
                handleDeviceSelection(deviceName);
            });
            // Add event listeners for hover
            svg.addEventListener('mouseover', function() {
                handleHover(svg);
            });
            svg.addEventListener('mouseout', function() {
                handleMouseOut(svg);
            });

            // Add SVG to the document body
            document.body.appendChild(svg);

        })
        .catch(error => console.error('Error loading SVG:', error));
}

function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function handleDeviceSelection(deviceId) {

    // Overlay connection indication
    document.getElementById('connectingOverlay').style.display = 'block';
    // Block all inputs
    document.body.style.pointerEvents = 'none';

    ipcRenderer.send("connectToUMIDevice-BLE", {"type": "BLE", "localName": deviceId});
}

function handleHover(svg) {
    // Change mouse pointer
    svg.style.cursor = "pointer";

    // Highlight SVG
    svg.style.filter = "brightness(120%)";
    svg.classList.add('throb');
}

function handleMouseOut(svg) {
    // Restore mouse pointer
    svg.style.cursor = "auto";

    // Remove highlight
    svg.style.filter = "brightness(100%)";
    svg.classList.remove('throb');
}


function aemsDataParsing(){
    // Show the modal when processing starts
    let modal = new bootstrap.Modal(document.getElementById("fileParsingProgressModal"));
    modal.show();

    // Reset progress bar and text
    document.getElementById("progress-bar").style.width = "0%";
    document.getElementById("progress-bar").innerText = "0%";
    document.getElementById("progress-text").innerText = "Processed 0 of 0 files (0%)";


    ipcRenderer.send("aems-dataParsing");
}
// Listen for progress updates from the main process
ipcRenderer.on("aems-dataParsing-progress", (event, data) => {
    let progressBar = document.getElementById("progress-bar");
    let progressText = document.getElementById("progress-text");

    // Update progress bar width and text
    progressBar.style.width = `${data.progress}%`;
    progressBar.innerText = `${data.progress}%`;

    // Update progress text
    progressText.innerText = `Processed ${data.processedFiles} of ${data.totalFiles} files (${data.progress}%)`;
});
// Listen for when processing is complete
ipcRenderer.on("aems-dataParsing-done", (event, data) => {
    let progressBar = document.getElementById("progress-bar");
    let progressText = document.getElementById("progress-text");

    progressText.innerText = `Finished processing all ${data.totalFiles} files`;
    progressBar.style.width = "100%";
    progressBar.innerText = "100%";

    // Auto-close modal after completion
    setTimeout(() => {
        let modalElement = document.getElementById("fileParsingProgressModal");
        let modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) modal.hide();
    }, 3000);
});
// Listen for errors
ipcRenderer.on("aems-dataParsing-error", (event, message) => {
    alert(`Error: ${message}`);
});


function startCalibration() {
    ipcRenderer.send("aems-calibrate");
}
// Listen for calibration results
ipcRenderer.on("aems-calibrate-done", (event, data) => {
    let offsetValues = data.offsets;

    // Update modal content dynamically
    document.getElementById("calibration-results").innerHTML = `
        <p><strong>Channel 1:</strong> ${offsetValues[0]}</p>
        <p><strong>Channel 2:</strong> ${offsetValues[1]}</p>
        <p><strong>Channel 3:</strong> ${offsetValues[2]}</p>
        <p><strong>Channel 4:</strong> ${offsetValues[3]}</p>
        <p><strong>Channel 5:</strong> ${offsetValues[4]}</p>
        <p><strong>Channel 6:</strong> ${offsetValues[5]}</p>
    `;

    // Show the calibration results modal
    let modal = new bootstrap.Modal(document.getElementById("calibrationModal"));
    modal.show();
});
// Listen for calibration errors
ipcRenderer.on("aems-calibrate-error", (event, message) => {
    alert(`Calibration Error: ${message}`);
});


/*
Live Plots
 */
ipcRenderer.on('receiveAEMSData', (e, data) => {
    let data_update = {
        y: [
            [data.x], // Wrap x in an array
            [data.y], // Wrap y in an array
            [data.z]  // Wrap z in an array
        ]
    }
    console.log(data);
    // Update Plotly traces for X, Y, and Z axes
    Plotly.extendTraces("current3phPlot", data_update, [0, 1, 2]);

    // Check if the data length exceeds the threshold (24000) and trim the excess
    const maxLength = 3000;
    const trimAmount = 1500;

    // Trim old data from the plot to avoid memory issues
    const traces = current3phPlot.data;
    if (traces[0]["y"].length > maxLength) {
        // Trim the X, Y, and Z data points
        for (let i = 0; i < 3; i++) {
            traces[i]["y"].splice(0, trimAmount);
        }
    }
});