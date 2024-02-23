import { usb } from "usb";
import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import isDev from "electron-is-dev";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let win;

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
      preload: join(__dirname, "./renderer/preload.cjs"),
      nodeIntegration: true,
      contextIsolation: true,
    },
  });
  win.loadFile("dist/index.html");
  usb.addListener("attach", usbAttachCallback);
  usb.addListener("detach", usbDetachCallback);
  if (isDev) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    usb.removeListener("attach", usbAttachCallback);
    usb.removeListener("detach", usbDetachCallback);
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
