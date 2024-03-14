import { usb, getDeviceList } from "usb";
import { app, BrowserWindow, Tray, Menu } from "electron";
import { join } from "path";
import isDev from "electron-is-dev";
import { fileURLToPath } from "url";
import { dirname } from "path";
import sqlite3 from "sqlite3";
import JSZip from "jszip";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const userDataPath = app.getPath("userData");
const dbPath = join(userDataPath, "database.db");
const downloadDatePath = join(userDataPath, "downloadDate.json");
const downloadPeriod = 1000 * 60 * 60 * 24 * 7;
let win = null;
let tray = null;

async function createWindow() {
  try {
    let downloadDate = await loadDownloadDate();
    console.log("Download date:", new Date(downloadDate));
    if (downloadDate === null || Date.now() - downloadDate > downloadPeriod) {
      const infoJsonList = await fetchInfoJsons();
      await saveDownloadDate(Date.now());
      updateAllKeyboards(infoJsonList);
    }
  } catch (error) {
    console.error("Error updating all keyboards:", error);
  }
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
  // console.log("v8 version", process.versions.v8);
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
  updateKnownUsbDevices();
});

function updateOrInsertDevice(vid, pid) {
  // Check if the device exists in all_keyboards
  const checkQuery = `SELECT name, manufacturer FROM all_keyboards WHERE vid = ? AND pid = ?`;
  db.get(checkQuery, [vid, pid], (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    // If exists in all_keyboards, update known_usb_devices with the given name and manufacturer
    if (row) {
      const upsertQuery = `
        INSERT known_usb_devices (vid, pid, name, manufacturer, is_keyboard, is_connected, last_connected)
        VALUES (?, ?, ?, ?, true, true, datetime('now'))
        ON CONFLICT(vid, pid) DO UPDATE SET
        name = excluded.name,
        manufacturer = excluded.manufacturer,
        is_connected = excluded.is_connected,
        last_connected = excluded.last_connected,
        is_keyboard = excluded.is_keyboard`;
      db.run(
        upsertQuery,
        [row.name, row.manufacturer, vid, pid],
        function (err) {
          if (err) {
            return console.error(err.message);
          }
          console.log(`Row(s) updated #1: ${this.changes}`);
        }
      );
    } else {
      // If not exists in all_keyboards, update known_usb_devices without name and manufacturer
      const upsertQuery = `
        INSERT INTO known_usb_devices (vid, pid, is_keyboard, is_connected, last_connected)
        VALUES (?, ?, false, true, datetime('now'))
        ON CONFLICT(vid, pid) DO UPDATE SET
        is_connected = excluded.is_connected,
        last_connected = excluded.last_connected,
        is_keyboard = excluded.is_keyboard`;
      db.run(upsertQuery, [vid, pid], function (err) {
        if (err) {
          return console.error(err.message);
        }
        console.log(`Row(s) updated #2: ${this.changes}`);
      });
    }
  });
}

function updateKnownUsbDevices() {
  const deviceList = getDeviceList();
  for (const device of deviceList) {
    updateOrInsertDevice(
      device.deviceDescriptor.idVendor,
      device.deviceDescriptor.idProduct
    );
  }
  console.log("Updated known usb devices table");
}

async function loadDownloadDate() {
  try {
    const downloadDate = await fs.readFile(downloadDatePath, "utf8");
    return JSON.parse(downloadDate).lastDownloadDate;
  } catch (error) {
    return null;
  }
}

async function saveDownloadDate(date) {
  await fs.writeFile(
    downloadDatePath,
    JSON.stringify({ lastDownloadDate: date }),
    "utf8",
    (error) => {
      console.error("Error saving download date:", error);
    }
  );
}

async function fetchInfoJsons() {
  const owner = "alceray";
  const repo = "keyboard-connect";
  const releaseUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const response = await fetch(releaseUrl);
  const releaseData = await response.json();
  const url = releaseData.assets[0].browser_download_url;
  const response2 = await fetch(url);
  const zipData = await response2.arrayBuffer();
  const zipFile = await JSZip.loadAsync(zipData);
  let infoJsonList = [];
  const filePromises = [];
  zipFile.forEach((relativePath, file) => {
    if (relativePath.startsWith("info") && relativePath.endsWith(".json")) {
      const promise = file.async("string").then((contents) => {
        try {
          return JSON.parse(contents);
        } catch (error) {
          console.error("Error parsing JSON file:", relativePath, error);
          return null;
        }
      });
      filePromises.push(promise);
    }
  });
  const results = await Promise.all(filePromises);
  infoJsonList = results.filter((result) => result !== null);
  return infoJsonList;
}

async function updateAllKeyboards(infoJsonList) {
  const insertStatement = `INSERT OR IGNORE INTO all_keyboards (vid, pid, name, manufacturer, json) VALUES (?, ?, ?, ?, ?)`;
  db.serialize(() => {
    const stmt = db.prepare(insertStatement);
    for (const infoJson of infoJsonList) {
      const vid = infoJson.usb.vid;
      const pid = infoJson.usb.pid;
      const keyboardName = infoJson.keyboard_name;
      if (!vid || !pid || !keyboardName) {
        continue;
      }
      const manufacturer = infoJson.manufacturer;
      const infoString = JSON.stringify(infoJson);
      stmt.run([vid, pid, keyboardName, manufacturer, infoString], (err) => {
        if (err) {
          console.log(vid, pid, keyboardName);
          console.error("Insert error:", err.message);
        }
      });
    }
    stmt.finalize();
  });
  console.log("Updated all keyboards table");
}

let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error("Error connecting to the database:", err.message);
  }
  console.log(`Connected to the database at ${dbPath}`);
  db.serialize(() => {
    db.exec(
      `
      CREATE TABLE IF NOT EXISTS all_keyboards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vid TEXT NOT NULL,
        pid TEXT NOT NULL,
        name TEXT NOT NULL,
        manufacturer TEXT,
        json TEXT,
        UNIQUE(vid, pid)
      );
      CREATE TABLE IF NOT EXISTS known_usb_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        vid TEXT NOT NULL, 
        pid TEXT NOT NULL,
        name TEXT,
        manufacturer TEXT,
        total_connected_time INTEGER NOT NULL DEFAULT 0,
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
        UNIQUE(vid, pid)
      );
      CREATE INDEX IF NOT EXISTS idx_devices_vid_pid ON known_usb_devices(vid, pid);
      CREATE INDEX IF NOT EXISTS idx_devices_is_connected ON known_usb_devices(is_connected);
      CREATE INDEX IF NOT EXISTS idx_log_vid_pid ON connection_log(vid, pid);
      CREATE INDEX IF NOT EXISTS idx_log_timestamp ON connection_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_keyboards_vid_pid ON all_keyboards(vid, pid);
    `,
      (err) => {
        if (err) {
          console.error("Error creating tables:", err.message);
        } else {
          console.log("Created tables successfully");
        }
      }
    );
  });
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
