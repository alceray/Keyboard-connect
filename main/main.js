const { usb } = require("usb");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let win;
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
  usb.on("attach", (device) => {
    console.log("Connected device");
    console.log("Vendor ID:", device.deviceDescriptor.idVendor);
    console.log("Product ID:", device.deviceDescriptor.idProduct);
    win.webContents.send("device-attached", {
      vid: device.deviceDescriptor.idVendor,
      pid: device.deviceDescriptor.idProduct,
    });
  });
  usb.on("detach", (device) => {
    console.log("Disconnected device");
    console.log("Vendor ID:", device.deviceDescriptor.idVendor);
    console.log("Product ID:", device.deviceDescriptor.idProduct);
    win.webContents.send("device-detached", {
      vid: device.deviceDescriptor.idVendor,
      pid: device.deviceDescriptor.idProduct,
    });
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
