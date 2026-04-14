let noble = require("@abandonware/noble");
const GATT = require('./gatt').GATT;


const BLEInterface = {

    /**
     * @brief Autorun to parse the GATT.js file
     */
    loadGATTItems() {
        // All the items from the gatt.js file
        Object.keys(GATT).forEach(service => {
            Object.entries(GATT[service].characteristics).forEach(([chrcName, chrcUUID]) => {
                this.activeDeviceGATTItems[chrcUUID.toLowerCase()] = {
                    service: service,
                    serviceName: GATT[service].name,
                    name: chrcName,
                }
            });
        })
    },

    // The BLE device of active connection
    activeBleDevice: null,

    // List of GATT items from the GATT.js file
    activeDeviceGATTItems: {},

    // All discovered devices based device names
    discoveredBleDevices: {},

    // Start the BLE asynchronous scanning process
    startScanning() {
        noble.startScanningAsync().catch((e) => {
            console.log(`Scanning for UMI devices failed - ${e}`);
        })
    },

    // Stop the BLE asynchronous scanning process
    stopScanning() {
        noble.stopScanningAsync().catch((e) => {
            console.log(`Unable to stop Scanning, Error - ${e}`);
        })
    },

    /**
     * @brief Start the device discovery and add a callback for every device found.
     * @param discoverCallback The callback called after a device is discovered
     */
    discoverDevices(discoverCallback) {
        noble.on("discover", discoverCallback);
    },

    /**
     * @brief Initiate connect to a specific BLE device based on its name
     * @param deviceLocalName The name of the device to connect to.
     * @returns {Promise<void>} After a successful connection and all the values has been discovered.
     */
    connectToDevice(deviceLocalName) {
        return new Promise((resolve, reject) => {
            // Connect to a device
            this.discoveredBleDevices[deviceLocalName].connectAsync().then(() => {
                // Store the current active device
                this.activeBleDevice = this.discoveredBleDevices[deviceLocalName];

                // Discover all services and characteristics
                this.activeBleDevice.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
                    if (error) {
                        reject(error); // Reject the promise if there's an error
                    } else {
                        let processedCharacteristics = 0;
                        const totalCharacteristics = characteristics.length;

                        characteristics.forEach((characteristic) => {
                            if(Object.keys(this.activeDeviceGATTItems).includes(characteristic.uuid.toLowerCase())) {
                                // Save the information
                                this.activeDeviceGATTItems[characteristic.uuid.toLowerCase()]["characteristic"] = characteristic;
                            }

                            // Increment the counter
                            processedCharacteristics++;

                            // Resolve the promise if all characteristics have been processed
                            if (processedCharacteristics === totalCharacteristics) {
                                resolve();
                            }
                        });
                    }
                });
            }).catch((error) => {
                reject(error); // Reject the promise if there's an error during connection
            });
        });
    },

    /**
     * @brief Read the characteristic value. Can be called only after the device is connected
     * @param characteristicUUID The UUID of the characteristic to read from.
     * @returns {Promise<Buffer>} A buffer of data read from the characteristics. The size of the buffer depends on the size of the characteristic data on the device side.
     */
    readCharacteristic(characteristicUUID) {
        return new Promise((resolve, reject) => {
            this.activeDeviceGATTItems[characteristicUUID.toLowerCase()].characteristic.read((e, data) => {
                if (e) {
                    reject(e);
                }
                let val = Buffer.from(data);
                resolve(val);
            })
        });
    },

    /**
     * @brief Write to a characteristic.
     * @param characteristicUUID The UUID of the characteristic to write to.
     * @param buffer The buffer of data to write. Make sure the size is consistent.
     * @param acknowledge A flag to indicate if a write acknowledgement is required. NOT IMPLEMENTED
     */
    writeCharacteristic(characteristicUUID, buffer, acknowledge=false) {
        // TODO: Proper write acknowledgement not implemented
        this.activeDeviceGATTItems[characteristicUUID.toLowerCase()].characteristic.write(buffer, acknowledge);
    },

    writeCharacteristicWithCallback(characteristicUUID, buffer, acknowledge=false, callback) {
        this.activeDeviceGATTItems[characteristicUUID.toLowerCase()].characteristic.write(buffer, acknowledge, (error) => callback(error));
    },

    /**
     * @brief Subscribe to a characteristic and add a callback
     * @param characteristicUUID The UUID of characteristic for subscription
     * @param callback The 'data' callback to receive and process the data
     */
    subscribeCharacteristic(characteristicUUID, callback) {
        // Subscribe
        this.activeDeviceGATTItems[characteristicUUID.toLowerCase()].characteristic.subscribe((error) => {
            if(error) {
                console.log(`Unable to subscribe to characteristic with UUID - ${characteristicUUID.toLowerCase()}, Error - ${error}`);
            }
        });
        // Add a callback
        this.activeDeviceGATTItems[characteristicUUID.toLowerCase()].characteristic.on("data", callback);
    },

    /**
     * @brief Unsubscribe from a characteristic
     * @param characteristicUUID The UUID of characteristic to unsubscribe from.
     */
    unsubscribeCharacteristic(characteristicUUID) {
        // Unsubscribe
        this.activeDeviceGATTItems[characteristicUUID.toLowerCase()].characteristic.unsubscribe((error) => {
            if(error) {
                console.log(`Error unsubscribing characteristic with UUID - ${characteristicUUID.toLowerCase()}, Error - ${error}`);
            }
        });
    },

    nuancedSubscription(characteristicUUID, type, callback) {
        this.activeDeviceGATTItems[characteristicUUID.toLowerCase()].characteristic.on(type, callback);
    },

    reset() {

        // Remove noble from the cache - Brute force fix
        // delete require.cache[require.resolve("@abandonware/noble")];
        // noble = require("@abandonware/noble");

        // Reset all items
        this.activeBleDevice = null;
        this.activeDeviceGATTItems= {};
        this.discoveredBleDevices= {};

        // Load the basic items
        this.loadGATTItems();
    }


}

BLEInterface.loadGATTItems();

module.exports = BLEInterface;