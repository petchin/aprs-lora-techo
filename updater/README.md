# Web updater (BLE OTA)

Browser-based Nordic Secure DFU updater for the T-Echo Plus.

- `npm install`
- `npm run build`
- Deploy `dist/` to `https://aprs-lora.pizones.com/update/`

It fetches `latest.json` from this repository and flashes the selected
`.zip` over Web Bluetooth. Requires Chrome/Edge (Android/desktop); iOS Safari
does not support Web Bluetooth.

Built with [web-bluetooth-dfu](https://github.com/thegecko/web-bluetooth-dfu),
JSZip and crc-32 (MIT).
