const fs = require('fs');
const path = require('path');
const cobs = require('cobs'); // COBS decoder library


async function listAndProcessFile(directoryPath, mainWindow) {
    try {
        // Read and filter files
        const files = fs.readdirSync(directoryPath);
        const imuLogFiles = files.filter((file) => file.endsWith('_IMULog.dat'));

        const totalFiles = imuLogFiles.length;
        let processedFiles = 0;

        // Process files one by one
        for(const file of imuLogFiles) {
            const filePath = path.join(directoryPath, file);
            console.log(`Processing file: ${filePath}`);
            await processFile(filePath, directoryPath);

            // Update progress
            processedFiles++;
            const progress = Math.round((processedFiles / totalFiles) * 100);
            mainWindow.webContents.send('update-progress-fileParsing', { progress, processedFiles, totalFiles });

        }
        console.log("All files processed.");
    } catch (error) {
        console.error("Error reading the directory or processing files:", error);
    }
}

function processFile(filePath, directoryPath) {
    return new Promise((resolve, reject) => {

        // Open a write stream
        const fileName = path.basename(filePath, ".dat");
        const decodedDataSavePath = path.join(directoryPath, `${fileName}.csv`);
        const processedDataStream = fs.createWriteStream(decodedDataSavePath, {
            flags: "a",
            autoClose: true,
        });

        const readStream = fs.createReadStream(filePath);
        let accumulatedBuffer = [];

        readStream.on('data', (chunk) => {
            // Process each byte in the chunk
            for(let i = 0; i < chunk.length; i++) {
                const byte = chunk[i];

                if(byte === 0x00) {
                    if (accumulatedBuffer.length > 0) {
                        try {
                            // Decode the identified packet
                            const byte_packet = Buffer.from(accumulatedBuffer);
                            const decoded_packet = cobs.decode(byte_packet);
                            processDecodeData(Buffer.from(decoded_packet), processedDataStream);

                        } catch(error) {
                            console.error("Error decoding COBS or processing data:", error);
                        }

                        // Reset the buffer after decoding
                        accumulatedBuffer = [];
                    }
                } else {
                    accumulatedBuffer.push(byte);
                }
            }
        });

        readStream.on('end', () => {
            console.log(`Finished reading and decoding file: ${filePath}`);
            processedDataStream.end();
            resolve();
        });

        readStream.on('error', (err) => {
            console.error(`Error reading file: ${filePath}`, err);
            processedDataStream.end();
            reject(err);
        });
    });
}

function processDecodeData(decodedBuffer, writeStream) {
    let output = '';
    for (let i = 0; i < decodedBuffer.length; i += 12) {
        const gx = decodedBuffer.readInt16LE(i);
        const gy = decodedBuffer.readInt16LE(i + 2);
        const gz = decodedBuffer.readInt16LE(i + 4);
        const ax = decodedBuffer.readInt16LE(i + 6);
        const ay = decodedBuffer.readInt16LE(i + 8);
        const az = decodedBuffer.readInt16LE(i + 10);

        // Convert accelerometer data from raw to g units
        const ax_g = ax * 0.000488;
        const ay_g = ay * 0.000488;
        const az_g = az * 0.000488;

        // Construct the data line
        const line = `${ax_g.toFixed(4)}, ${ay_g.toFixed(4)}, ${az_g.toFixed(4)}, ${gx.toFixed(4)}, ${gy.toFixed(4)}, ${gz.toFixed(4)}\n`;

        // Append to the output
        output += line;
    }

    // Write to stream
    writeStream.write(output);
}

module.exports = {
    listAndProcessFile
};