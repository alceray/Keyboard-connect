const { usb } = require("usb");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let win;
let usbMonitoringEnabled = false;

function usbAttachCallback(device) {
  console.log("Connected device");
  console.log("Vendor ID:", device.deviceDescriptor.idVendor);
  console.log("Product ID:", device.deviceDescriptor.idProduct);
  win.webContents.send("device-attached", {
    vid: device.deviceDescriptor.idVendor,
    pid: device.deviceDescriptor.idProduct,
  });
}

function usbDetachCallback(device) {
  console.log("Disconnected device");
  console.log("Vendor ID:", device.deviceDescriptor.idVendor);
  console.log("Product ID:", device.deviceDescriptor.idProduct);
  win.webContents.send("device-detached", {
    vid: device.deviceDescriptor.idVendor,
    pid: device.deviceDescriptor.idProduct,
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "../renderer/preload.js"),
      nodeIntegration: true,
      contextIsolation: true,
    },
  });
  win.loadFile("renderer/index.html");
  ipcMain.on("usb-monitor-toggle", () => {
    usbMonitoringEnabled = !usbMonitoringEnabled;
    if (usbMonitoringEnabled) {
      usb.addListener("attach", usbAttachCallback);
      usb.addListener("detach", usbDetachCallback);
    } else {
      usb.removeListener("attach", usbAttachCallback);
      usb.removeListener("detach", usbDetachCallback);
    }
  });

  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
