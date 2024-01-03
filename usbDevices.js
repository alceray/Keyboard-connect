import { getDeviceList, usb } from "usb";

// List all connected USB devices
const devices = getDeviceList();

let count = 1;
devices.forEach((device) => {
  console.log("Device ", count);
  console.log("Vendor ID:", device.deviceDescriptor.idVendor);
  console.log("Product ID:", device.deviceDescriptor.idProduct);
  ++count;
});

usb.on("attach", (device) => {
  console.log("Connected device");
  console.log("Vendor ID:", device.deviceDescriptor.idVendor);
  console.log("Product ID:", device.deviceDescriptor.idProduct);
});
usb.on("detach", (device) => {
  console.log("Disconnected device");
  console.log("Vendor ID:", device.deviceDescriptor.idVendor);
  console.log("Product ID:", device.deviceDescriptor.idProduct);
});
