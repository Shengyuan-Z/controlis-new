const {app, BrowserWindow, ipcMain, dialog} = require("electron");
const path = require("path")
const fs = require("fs")

const { Buffer } = require('buffer');
const utils = require("./utils");

const updater = require("./updater.js")

/*
Interfaces
 */
const BLEInterface = require("./ble");
const UMIDevices = require("./UMIConfiguration")

// Windows
// Main Window
let mainWindow = undefined;
let secondaryWindow = undefined;


/*
AEMS - Data Conversions
 */
const INT24_MAX             = 0x7FFFFF;         // Maximum value for a 24-bit signed integer
const V_REF                 = 1.2;              // Replace with actual reference voltage
const CT_V_PEAK             = 0.4714;           // Replace with actual peak voltage
const CT_CURRENT_MAX        = 100;              // Replace with actual max current
const V_REF_VGAIN           = 0.3;              // Replace with actual voltage gain reference
const V_DIVIDER             = 0.2568;           // Replace with actual voltage divider ratio
const MAINS_VOLTAGE         = 240.0;            // Replace with actual mains voltage



function createWindow() {

    // Check for update after 3-seconds
    setTimeout(updater, 3000);

    mainWindow = new BrowserWindow({
        width: 1200, height: 800,
        webPreferences: {nodeIntegration: true, contextIsolation: false},
        resizable: false,
        center: true,
        show: false,
        maximizable: false,
        autoHideMenuBar: true
    });

    // Load some HTML into main Window
    mainWindow.loadFile("./index.html").catch((e) => {
        console.log(`Unable to hold file - ${e}`)
    });
    mainWindow.once('ready-to-show', mainWindow.show);

    // On closing the window
    mainWindow.on("closed", () => {
        mainWindow = null
    });

    ipcMain.on("navigateHome", () => {
        if (!mainWindow) return;
        mainWindow.loadFile("./index.html").catch((e) => {
            console.log(`Unable to load index - ${e}`);
        });
    });

    /**
     * @brief Searching for all UMI devices
     */
    ipcMain.on("searchAEMSDevices", (e, args) => {
        /*
        BLE Connection
         */
        console.log("Starting BLE Devices Scanning!")
        BLEInterface.startScanning();

        // On device discovery
        BLEInterface.discoverDevices(onDeviceDiscover);

        // Load the page to show devices
        mainWindow.loadFile("./pages/aems-index.html").catch((e) => {
            console.log(`Cannot load Operation Selection Page - ${e}`);
        })

    })

    ipcMain.on("connectToUMIDevice-BLE", (e, args) => {
        console.log(`Initiating connection to device with local name ${args.localName}`)

        // Connect to a device
        BLEInterface.connectToDevice(args.localName)
            .then(()=> {
                // Read the characteristic for connection status
                BLEInterface.readCharacteristic("1201")
                    .then((data) => {
                        let parsed_data = data.readInt32LE(0);
                        if(parsed_data === 0) {
                            mainWindow.loadFile("./pages/aems-daqInit.html").catch((e) => {
                                console.log(`Cannot load Operation Selection Page - ${e}`);
                            })
                        } else {

                            subscribeToAEMSInfo();
                            mainWindow.loadFile("./pages/aems-daqMonitor.html").catch((e) => {
                                console.log(`Cannot load Operation Selection Page - ${e}`);
                            })
                        }
                    })
                    .catch((err) => {
                        console.log(`Unable to read characteristic - ${err}`)
                    })

            })
            .catch((e) => {
                // Display error
                console.log(`Error connecting to device - ${e}`)
            });

    })

    ipcMain.on("startBLE-AEMS-DAQ", (e, args) => {

        // Start the DAQ process
        // File name
        const MAX_BUFFER_LENGTH = 20;
        let fileNameBuffer = Buffer.alloc(MAX_BUFFER_LENGTH);
        fileNameBuffer.write(args.fileName,0);
        // Fill with zeros
        for (let i = args.fileName; i < MAX_BUFFER_LENGTH; i++) {
            fileNameBuffer.writeUInt8(0, i);
        }
        BLEInterface.writeCharacteristicWithCallback("1103", fileNameBuffer, false, (err) => {
            if(err) {
                console.log(`Error writing to characteristic - ${err}`);
            } else {
                // Start the DAQ process
                let daqControl = Buffer.alloc(1);
                daqControl.writeUInt8(0x01, 0);
                BLEInterface.writeCharacteristic("1101", daqControl, false);

                // Subscribe to several Characteristics
                subscribeToAEMSInfo();
                mainWindow.loadFile("./pages/aems-daqMonitor.html").catch((e) => {
                    console.log(`Cannot load Operation Selection Page - ${e}`);
                })


            }
        })

    })

    ipcMain.on("stopAEMSbleDAQ", (e, args) => {
        BLEInterface.readCharacteristic("1201")
            .then((data) => {
                let parsed_data = data.readInt32LE(0);
                if (parsed_data === 1) {
                    let daqControl = Buffer.alloc(1);
                    daqControl.writeUInt8(0x00, 0)
                    BLEInterface.writeCharacteristic("1101", daqControl, false);

                    // Unsubscribe
                    unsubscribeToAEMSInfo();
                    dialog.showMessageBox({
                        type: "info",
                        title: "DAQ Stopped",
                        message: `Data saved!`,
                        buttons: ["Close"],
                        cancelId: 0
                    }).then(result => {
                        mainWindow.loadFile("./pages/aems-daqInit.html").catch((e) => {
                            console.log(`Cannot load Operation Selection Page - ${e}`);
                        })
                    })
                } else {
                    dialog.showMessageBox({
                        type: "warning",
                        title: "DAQ is not running",
                        message: `Please check/reset the device`,
                        buttons: ["Close"],
                        cancelId: 0
                    })
                }
            })
    })

    ipcMain.on("dataParsing", (e, args) => {

        // Open a dialog box
        let dataParsePath = dialog.showOpenDialogSync(mainWindow, {
            title: "Select save file location",
            properties: ["openDirectory", "createDirectory", "promptToCreate"],
            buttonLabel: "Select",
        });
        if(!dataParsePath) {
            return;
        }
        // Parse the data
        utils.listAndProcessFile(dataParsePath[0], mainWindow).then(() => {})

    })

    ipcMain.on("aems-dataParsing", async(event) => {
        // Open a dialog box
        const selectedPaths = dialog.showOpenDialogSync(mainWindow, {
            title: "Select BIN file(s)",
            properties: ["openFile", "multiSelections"],
            buttonLabel: "Select",
            filters: [{ name: "BIN Files", extensions: ["BIN", "bin"] }],
        });

        if (!selectedPaths || selectedPaths.length === 0) {
            event.sender.send("aems-dataParsing-error", "No .BIN file selected.");
            return;
        }

        const binFilePaths = selectedPaths.filter((p) => typeof p === "string" && p.toLowerCase().endsWith(".bin"));
        if (binFilePaths.length === 0) {
            event.sender.send("aems-dataParsing-error", "No .BIN files selected.");
            return;
        }

        let totalFiles = binFilePaths.length;
        let processedFiles = 0;

        const FRAME_BYTES = 32;
        const SPLIT_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100MB
        const MAX_PART_BYTES = 30 * 1024 * 1024; // 30MB
        const CSV_HEADER = "V1,V2,V3,C1,C2,C3\n";

        const alignDownToFrame = (bytes) => Math.floor(bytes / FRAME_BYTES) * FRAME_BYTES;

        binFilePaths.forEach((filePath) => {
            let outputCSVPath = path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)) + ".csv");

            const stats = fs.statSync(filePath);
            const fileSizeBytes = stats.size;
            const alignedMaxPartBytes = Math.max(FRAME_BYTES, alignDownToFrame(MAX_PART_BYTES));

            // Create/overwrite output once; write header once.
            fs.writeFileSync(outputCSVPath, CSV_HEADER);

            const fd = fs.openSync(filePath, "r");
            try {
                let offset = 0;
                while (offset < fileSizeBytes) {
                    let remaining = fileSizeBytes - offset;
                    let readBytesTarget;

                    if (fileSizeBytes > SPLIT_THRESHOLD_BYTES) {
                        readBytesTarget = Math.min(alignedMaxPartBytes, remaining);
                    } else {
                        // For smaller files keep legacy behavior (single pass), but still avoid reading >MAX_PART_BYTES chunks.
                        readBytesTarget = Math.min(Math.max(alignedMaxPartBytes, alignDownToFrame(remaining)), remaining);
                    }

                    // Ensure we don't end on a partial frame unless it's truly the end (we'll ignore the tail).
                    let readBytesAligned = alignDownToFrame(readBytesTarget);
                    if (readBytesAligned < FRAME_BYTES) {
                        break;
                    }

                    const buf = Buffer.allocUnsafe(readBytesAligned);
                    const bytesRead = fs.readSync(fd, buf, 0, readBytesAligned, offset);
                    if (bytesRead <= 0) break;

                    const usableBytes = alignDownToFrame(bytesRead);
                    const totalChunks = Math.floor(usableBytes / FRAME_BYTES);
                    let dataLines = [];

                    for (let i = 0; i < totalChunks; i++) {
                        let chunk = buf.slice(i * FRAME_BYTES, (i + 1) * FRAME_BYTES);
                        let values = [];

                        for (let j = 0; j < 8; j++) {
                            values.push(chunk.readInt32LE(j * 4));
                        }

                        let processedValues = [
                            parseADCVoltage(values[0]),
                            parseADCVoltage(values[1]),
                            parseADCVoltage(values[2]),
                            parseADCCurrent(values[3]),
                            parseADCCurrent(values[4]),
                            parseADCCurrent(values[5])
                        ];

                        dataLines.push(processedValues.join(","));
                    }

                    // Append without header for each part.
                    if (dataLines.length > 0) {
                        fs.appendFileSync(outputCSVPath, dataLines.join("\n") + "\n");
                    }

                    offset += usableBytes;
                }
            } finally {
                fs.closeSync(fd);
            }

            // Progress update on processed file
            processedFiles += 1;
            let progress = Math.floor((processedFiles / totalFiles) * 100);

            event.sender.send("aems-dataParsing-progress", {
                file: path.basename(filePath),
                progress: progress,
                processedFiles: processedFiles,
                totalFiles: totalFiles
            });
        });

        event.sender.send("aems-dataParsing-done", { totalFiles });
    });

    ipcMain.on("aems-calibrate", async (event) => {
        // Open a dialog box for file selection
        let fileSelection = dialog.showOpenDialogSync({
            title: "Select Calibration File",
            properties: ["openFile"],
            buttonLabel: "Select",
            filters: [{ name: "BIN Files", extensions: ["BIN"] }],
        });

        if (!fileSelection || fileSelection.length === 0) {
            event.sender.send("aems-calibrate-error", "No calibration file selected.");
            return;
        }

        let filePath = fileSelection[0];

        if (!fs.existsSync(filePath)) {
            event.sender.send("aems-calibrate-error", "Calibration file not found.");
            return;
        }

        let fileBuffer = fs.readFileSync(filePath);
        let totalChunks = Math.floor(fileBuffer.length / 32);

        if (totalChunks === 0) {
            event.sender.send("aems-calibrate-error", "No valid data in calibration file.");
            return;
        }

        let sum = [0, 0, 0, 0, 0, 0]; // Stores sum of each channel
        let count = totalChunks;

        for (let i = 0; i < totalChunks; i++) {
            let chunk = fileBuffer.slice(i * 32, (i + 1) * 32);
            let values = [];

            for (let j = 0; j < 6; j++) {
                values.push(chunk.readInt32LE(j * 4)); // Read as int32_t
            }

            // Sum values for averaging
            sum[0] += values[0]; // Channel 1
            sum[1] += values[1]; // Channel 2
            sum[2] += values[2]; // Channel 3
            sum[3] += values[3]; // Channel 4
            sum[4] += values[4]; // Channel 5
            sum[5] += values[5]; // Channel 6
        }

        // Compute average offset for each channel (keep as int32_t)
        let offsetValues = sum.map(total => Math.floor(total / count));

        console.log("Calibration Offsets (INT32_T):", offsetValues);

        // Send calibration results back to renderer process
        event.sender.send("aems-calibrate-done", {
            offsets: offsetValues
        });
    });



}

// When the app is ready
app.on('ready', createWindow)

/**
 * Subscribes to multiple AEMS (Advanced Energy Management System) related characteristics via BLE interface.
 * This method is intended to register listeners for various status updates.
 *
 * @return {void} This method does not return any value.
 */
function subscribeToAEMSInfo() {
    // Subscribe to characteristics
    // TODO: Unsubscribe Later
    BLEInterface.subscribeCharacteristic("1201", statusDAQ);
    BLEInterface.subscribeCharacteristic("1202", statusV1);
    BLEInterface.subscribeCharacteristic("1203", statusV2);
    BLEInterface.subscribeCharacteristic("1204", statusv3);
    BLEInterface.subscribeCharacteristic("1205", statusI1);
    BLEInterface.subscribeCharacteristic("1206", statusI2);
    BLEInterface.subscribeCharacteristic("1207", statusI3);
    // BLEInterface.subscribeCharacteristic("1208", statusRS485);
    // BLEInterface.subscribeCharacteristic("1209", statusINTF);
}

/**
 * Unsubscribes from multiple BLE characteristics associated with AEMS information.
 *
 * This function invokes the BLEInterface to unsubscribe from a predefined set
 * of characteristics, ensuring that the device is no longer actively listening
 * to the specified BLE data streams.
 *
 * @return {void} No return value.
 */
function unsubscribeToAEMSInfo() {
    // Subscribe to characteristics
    // TODO: Unsubscribe Later
    BLEInterface.unsubscribeCharacteristic("1201");
    BLEInterface.unsubscribeCharacteristic("1202");
    BLEInterface.unsubscribeCharacteristic("1203");
    BLEInterface.unsubscribeCharacteristic("1204");
    BLEInterface.unsubscribeCharacteristic("1205");
    BLEInterface.unsubscribeCharacteristic("1206");
    BLEInterface.unsubscribeCharacteristic("1207");
    // BLEInterface.unsubscribeCharacteristic("1208");
    // BLEInterface.unsubscribeCharacteristic("1209");
}


/*
BLE Callbacks
 */
/**
 * Handles the discovery of a BLE device and processes it based on specific criteria.
 *
 * @param {Object} peripheral The discovered BLE peripheral object.
 * @return {void} Does not return a value.
 */
function onDeviceDiscover(peripheral) {
    // Connect based on name
    if(peripheral.advertisement.localName) {

        // Look for a pattern
        let isMatch = UMIDevices.UMIDeviceNames.some(pattern => peripheral.advertisement.localName.startsWith(pattern));

        if(isMatch && !Object.keys(BLEInterface.discoveredBleDevices).includes(peripheral.advertisement.localName)) {
            console.log("Found device " + peripheral.advertisement.localName);
            // Callbacks for connect and disconnect
            peripheral.on("connect", onUMIDeviceConnect);
            peripheral.on("disconnect", onUMIDeviceDisconnect);

            // Keep track of all detected UMI devices
            BLEInterface.discoveredBleDevices[peripheral.advertisement.localName] = peripheral;

            // Send the discovered peripheral to renderer
            mainWindow.webContents.send("UMIDevicesDiscovered", {"localName": peripheral.advertisement.localName, "randomAddress": peripheral.advertisement.txPowerLevel});

        }
    }
}

/**
 * Handles the connection event to a UMI device. This method executes actions
 * required upon successfully establishing a connection with the device, such as
 * stopping the scanning process.
 *
 * @return {void} No value is returned by this method.
 */
function onUMIDeviceConnect(){
    console.log("Connection to Device Established!");
    // Stop the Scanning process
    BLEInterface.stopScanning();

}

/**
 * Handles the disconnection event of the UMI Device.
 * This method resets the BLE interface, notifies the user about the disconnection,
 * and prompts to search for the device again. It then relaunches the application
 * for scanning.
 *
 * @return {void} This function does not return any value.
 */
function onUMIDeviceDisconnect() {

    // Reset the BLE Interface
    BLEInterface.reset();

    dialog.showMessageBox({
        type: "info",
        title: "UMI Device Disconnected!",
        message: `Lost connection with the UMI Device. Please Reconnect!`,
        buttons: ["Search"],
        cancelId: 0
    }).then(result => {

        // // Relaunch the app for new scanning
        // app.relaunch()
        // app.exit(0)

        // Go to the starting page
        mainWindow.loadFile("./index.html").catch((e) => {
            console.log(`Unable to load the index page, Error - ${e}`);
        })
    })

}

function statusDAQ(data, isNotification) {
    let parsed_data = data.readUInt32LE(0);
    mainWindow.webContents.send("statusUpdated", {
        "statusDAQ": parsed_data
    });
}

function statusV1(data, isNotification) {
    let parsed_data = Math.round(data.readFloatLE(0) * 1000) / 1000;
    mainWindow.webContents.send("statusUpdated", {
        "statusV1": parsed_data
    });
}

function statusV2(data, isNotification) {
    let parsed_data = Math.round(data.readFloatLE(0) * 1000) / 1000;
    mainWindow.webContents.send("statusUpdated", {
        "statusV2": parsed_data
    });
}

function statusv3(data, isNotification) {
    let parsed_data = Math.round(data.readFloatLE(0) * 1000) / 1000;
    mainWindow.webContents.send("statusUpdated", {
        "statusV3": parsed_data
    });
}

function statusI1(data, isNotification) {
    let parsed_data = Math.round(data.readFloatLE(0) * 1000) / 1000;
    mainWindow.webContents.send("statusUpdated", {
        "statusI1": parsed_data
    });
}

function statusI2(data, isNotification) {
    let parsed_data = Math.round(data.readFloatLE(0) * 1000) / 1000;
    mainWindow.webContents.send("statusUpdated", {
        "statusI2": parsed_data
    });
}

function statusI3(data, isNotification) {
    let parsed_data = Math.round(data.readFloatLE(0) * 1000) / 1000;
    mainWindow.webContents.send("statusUpdated", {
        "statusI3": parsed_data
    });
}

function parseADCVoltage(adc_value) {
    // Ensure adc_value is within the 24-bit signed range
    if (adc_value > INT24_MAX) {
        adc_value = INT24_MAX;
    } else if (adc_value < -INT24_MAX) {
        adc_value = -INT24_MAX;
    }

    // Convert ADC value to measured voltage at ADC input
    let v_adc = (adc_value / INT24_MAX) * V_REF_VGAIN;
    // Convert ADC to mains voltage
    let v_mains = (v_adc / V_DIVIDER) * (MAINS_VOLTAGE * 1.414);

    return v_mains;
}


function parseADCCurrent(adc_value) {
    // Ensure adc_value is within the 24-bit signed range
    if (adc_value > INT24_MAX) {
        adc_value = INT24_MAX;
    } else if (adc_value < -INT24_MAX) {
        adc_value = -INT24_MAX;
    }

    // Convert ADC Value to Voltage
    let v_out = (adc_value / INT24_MAX) * V_REF;
    // Reverse the op-amp gain
    let v_ct = v_out * (CT_V_PEAK / V_REF);
    // Convert and get current
    let current = (v_ct / CT_V_PEAK) * CT_CURRENT_MAX;

    return current;
}