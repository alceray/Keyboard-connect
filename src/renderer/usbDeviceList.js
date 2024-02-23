window.electronAPI.receiveFromMain("device-attached", (device) => {
  const list = document.getElementById("keyboardList");
  const item = document.createElement("li");
  item.textContent = `Device attached - VID ${device.vid}, PID ${device.pid}`;
  list.appendChild(item);
  console.log(device);
});

window.electronAPI.receiveFromMain("device-detached", (device) => {
  const list = document.getElementById("keyboardList");
  const item = document.createElement("li");
  item.textContent = `Device detached - VID ${device.vid}, PID ${device.pid}`;
  list.appendChild(item);
  console.log(device);
});

const toggleButton = document.getElementById("usb-monitor-toggle");
toggleButton.addEventListener("click", () => {
  console.log("click");
  window.electronAPI.sendToMain("usb-monitor-toggle", {});
});
