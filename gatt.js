// BLE Services and Characteristics
const GATT = {
    "1100": {
        name: "daqControl",
        characteristics: {
            control_daq: "1101",
            control_rs485: "1102",
            control_filename: "1103"
        }
    },

    "1200": {
        name: "statusUpdate",
        characteristics: {
            daq: "1201",
            vph1: "1202",
            vph2: "1203",
            vph3: "1204",
            iph1: "1205",
            iph2: "1206",
            iph3: "1207",
            rs485: "1208",
            int: "1209"
        }
    }

}

module.exports = {
    GATT: GATT,
}