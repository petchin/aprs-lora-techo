# BLE Tools (web app)

Single page with two tabs:

- **Update firmware** — Nordic Secure DFU over Web Bluetooth (`.zip` from latest.json)
- **Config / messages** — status, comment, callsign, sensors, battery telemetry,
  RSSI toggle, remote-control ACL, config backup/import, reboot

Fetches `latest.json` from this repository. Requires Chrome/Edge
(Android/desktop); iOS Safari does not support Web Bluetooth.

Deploy `dist/` to `https://aprs-lora.pizones.com/tools/`.

Built with [web-bluetooth-dfu](https://github.com/thegecko/web-bluetooth-dfu),
JSZip and crc-32 (MIT).
