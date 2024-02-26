import { usb } from "usb";
import { app, BrowserWindow, Tray, Menu } from "electron";
import { join } from "path";
import isDev from "electron-is-dev";
import { fileURLToPath } from "url";
import { dirname } from "path";
import sqlite3 from "sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let win = null;
let tray = null;
const dbPath = join(app.getPath("userData"), "database.db");

let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error("Error connecting to the database:", err.message);
  }
  console.log(`Connected to the database at ${dbPath}`);
  db.exec(
    `CREATE TABLE IF NOT EXISTS known_usb_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      vid TEXT NOT NULL, 
      pid TEXT NOT NULL,
      name TEXT,
      manufacturer TEXT,
      is_connected BOOLEAN NOT NULL DEFAULT 0,
      last_connected DATETIME,
      last_disconnected DATETIME,
      is_keyboard BOOLEAN NOT NULL DEFAULT 0,
      UNIQUE(vid, pid)
    );
    CREATE TABLE IF NOT EXISTS connection_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vid TEXT NOT NULL,
      pid TEXT NOT NULL,
      connected BOOLEAN NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vid, pid) REFERENCES known_usb_devices(vid, pid)
    );
    CREATE TABLE IF NOT EXISTS all_keyboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vid TEXT NOT NULL,
      pid TEXT NOT NULL,
      name TEXT NOT NULL,
      json TEXT,
      FOREIGN KEY(vid, pid) REFERENCES known_usb_devices(vid, pid)
    );
    CREATE INDEX IF NOT EXISTS idx_devices_vid_pid ON known_usb_devices(vid, pid);
    CREATE INDEX IF NOT EXISTS idx_devices_is_connected ON known_usb_devices(is_connected);
    CREATE INDEX IF NOT EXISTS idx_log_vid_pid ON connection_log(vid, pid);
    CREATE INDEX IF NOT EXISTS idx_log_timestamp ON connection_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_keyboards_vid_pid ON all_keyboards(vid, pid);`,
    (err) => {
      if (err) {
        return console.error("Error creating the table:", err.message);
      }
    }
  );
});

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
  win.on("close", () => {
    win = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {});

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
