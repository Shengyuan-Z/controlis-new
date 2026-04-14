const {SerialPort} = require("serialport");
const fs = require("fs");

class USBInterface {
    constructor(onDataReceivedCallback) {
        this.selectedDevices = null;

        // Allowed USB devices based on manufacturer and product IDs
        this.allowedUSBDevices = {
            "MANUFACTURER-ID": [0x0483],
            "PRODUCT-ID": [0x5740]
        };

        this.onDataReceivedCallback = onDataReceivedCallback;
        this.port = null; // Store the port reference for later use (close operation)
        this.callbackRegistered = false; // Track if the callback has been registered
    }

    listSerialPorts() {
        return SerialPort.list();
    }

    // Find the STM32 USB devices and check against allowed MANUFACTURER-ID and PRODUCT-ID
    findUSBDevices() {
        return new Promise((resolve, reject) => {
            try {
                this.listSerialPorts().then(ports => {
                    // Filter ports to find STM32 devices matching allowed USB criteria
                    const stm32Ports = ports.filter(port => {
                        const vendorIdHex = parseInt(port.vendorId, 16); // Convert vendorId from string to hexadecimal
                        const productIdHex = parseInt(port.productId, 16); // Convert productId from string to hexadecimal

                        return this.allowedUSBDevices["MANUFACTURER-ID"].includes(vendorIdHex) &&
                            this.allowedUSBDevices["PRODUCT-ID"].includes(productIdHex);
                    });

                    if (stm32Ports.length > 0) {
                        console.log('Found allowed STM32 virtual COM port(s):', stm32Ports.map(port => port.path));
                        this.selectedDevices = stm32Ports; // Save STM32 devices
                        resolve(this.selectedDevices);
                    } else {
                        console.log('No allowed STM32 virtual COM ports found.');
                        resolve([]);
                    }
                }).catch(error => {
                    reject(`Error listing serial ports: ${error}`);
                });
            } catch (error) {
                reject(`Error finding USB devices: ${error}`);
            }
        });
    }

    // Register the data callback only once
    registerDataCallback() {
        if (this.callbackRegistered || !this.port) return; // Do not register again if already registered or port is not open

        this.port.on('data', (response) => {

            // Invoke the callback with raw binary data (COBS encoded)
            if (this.onDataReceivedCallback) {
                this.onDataReceivedCallback(response);
            }
        });

        this.callbackRegistered = true; // Set the flag to true after registering the callback
    }

    // Send data to the STM32 via virtual COM port
    sendDataToSTM32(portName, data) {
        return new Promise((resolve, reject) => {
            if (!portName) {
                return reject('No valid port name provided.');
            }

            // If the port is already open, just send the data
            if (this.port && this.port.isOpen) {
                console.log(`Reusing open port ${portName}. Sending data.`);
                this.port.write(data, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    console.log('Data sent to STM32:', data);
                    resolve();
                });
                return;
            }

            this.port = new SerialPort({
                path: portName,
                baudRate: 115200, // This value doesn't matter for USB CDC
            });

            this.port.on('open', () => {
                console.log(`Port ${portName} is open.`);
                this.port.write(data, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    console.log('Data sent to STM32:', data);
                    resolve();
                });
            });

            this.port.on('error', (err) => {
                reject(`Error communicating with STM32: ${err}`);
            });
        });
    }

    // Close the port safety
    closePort() {
        if(this.port && this.port.isOpen) {
            this.port.close((err) => {
                if (err) {
                    console.error('Error closing the port:', err);
                } else {
                    console.log('Port closed successfully.');
                    this.port = null;
                    this.callbackRegistered = false;
                }
            });
        } else {
            console.log('No open port to close.');
        }
    }

    // Connect to the STM32 device and send 0x00
    connectToSTM32(path) {
        return new Promise((resolve, reject) => {
            if(path) {

                const dataToSend = Buffer.from([0x01]);
                this.sendDataToSTM32(path, dataToSend)
                    .then(() => {
                        console.log('Data successfully sent to STM32.');
                        // Register the data callback only once
                        this.registerDataCallback();
                        resolve();
                    })
                    .catch(error => {
                        reject(`Error sending data to STM32: ${error}`);
                    });

            } else {
                reject('Path for the Serial Port not provided when connectToSTM32 is called!');
            }

        });
    }
}


module.exports = USBInterface;