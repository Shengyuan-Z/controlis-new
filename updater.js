// Electron-Updater Module
const {autoUpdater} = require('electron-updater');
const {dialog} = require("electron")

// Configure log debugging
autoUpdater.logger = require("electron-log")
autoUpdater.logger.transports.file.level = "info"

// Disable auto auto-downloading
autoUpdater.autoDownload = false

// Single export to check for and apply any available updates
module.exports = () => {

    // Check for updates
    autoUpdater.checkForUpdates()

    // Listen for update found
    autoUpdater.on("update-available", () => {
        // Prompt for download
        dialog.showMessageBox({
            type: "info",
            title: "Update available",
            message: "A new version of Atlas is available. Please update by downloading and installing the latest version from GitHub",
            buttons: ["Update", "No"]
        }).then(result => {
        })
    })

}