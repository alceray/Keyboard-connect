import React, { useEffect, useState } from "react";

export default function USBDeviceList() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    const handleDeviceAttached = (device) => {
      console.log("Device attached:", device);
      setDevices((currentDevices) => [...currentDevices, device]);
    };

    const handleDeviceDetached = (device) => {
      console.log("Device detached:", device);
      setDevices((currentDevices) =>
        currentDevices.filter(
          (d) => d.vid !== device.vid || d.pid !== device.pid
        )
      );
    };
    window.electronAPI.receiveFromMain("device-attached", handleDeviceAttached);
    window.electronAPI.receiveFromMain("device-detached", handleDeviceDetached);
    
    return () => {
      window.electronAPI.removeListener(
        "device-attached",
        handleDeviceAttached
      );
      window.electronAPI.removeListener(
        "device-detached",
        handleDeviceDetached
      );
    };
  }, []);

  return (
    <div>
      <h1>Monitor USB Keyboards</h1>
      <ul id="keyboardList">
        {devices.map((device, index) => (
            <li key={index}>Device attached - VID {device.vid}, PID {device.pid}</li>
        ))}
      </ul>
    </div>
  );
}
