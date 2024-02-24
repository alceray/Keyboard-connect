import { usb } from "usb";
import { app, BrowserWindow, Tray, Menu } from "electron";
import { join } from "path";
import isDev from "electron-is-dev";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let win = null;
let tray = null;

function safeSend(channel, data) {
  if (win) {
    win.webContents.send(channel, data);
  }
}

function usbAttachCallback(device) {
  console.log("Connected device");
  console.log("Vendor ID:", device.deviceDescriptor.idVendor);
  console.log("Product ID:", device.deviceDescriptor.idProduct);
  safeSend("device-attached", {
    vid: device.deviceDescriptor.idVendor,
    pid: device.deviceDescriptor.idProduct,
  });
}

function usbDetachCallback(device) {
  console.log("Disconnected device");
  console.log("Vendor ID:", device.deviceDescriptor.idVendor);
  console.log("Product ID:", device.deviceDescriptor.idProduct);
  safeSend("device-detached", {
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
  win.on('close', () => {
    win = null
  })
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("ready", () => {
  tray = new Tray("./assets/usb-cable.png");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Quit",
      type: "normal",
      click: () => {
        usb.removeListener("attach", usbAttachCallback);
        usb.removeListener("detach", usbDetachCallback);
        app.quit();
      },
    },
  ]);
  tray.setToolTip("Keyboard Connect");
  tray.setContextMenu(contextMenu);
});
