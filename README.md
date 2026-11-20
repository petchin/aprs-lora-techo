# APRS LoRa — LilyGO T-Echo Plus (nRF52840 + SX1262 433 MHz)

Firmware, release files and BLE OTA channel for the **LilyGO T-Echo Plus**
(With BME280, China / worldwide, 433 MHz) running **APRS over LoRa**.

- Default callsign: **E23BMY-12**
- Frequency: **433.775 MHz**, SF12, BW125, CR4/5
- Hardware: nRF52840, SX1262, L76K GNSS, 1.54" 200×200 e-paper, BME280
- License: **GPL-3.0**

> This repository is the update channel used by
> <https://aprs-lora.pizones.com/update/>. The web updater reads
> [`latest.json`](latest.json) from this repo and flashes the selected `.zip`
> over **Bluetooth LE** (Web Bluetooth), so no USB cable is needed after the
> first installation.

## Downloads

| Firmware | UF2 (USB drag & drop) | DFU ZIP (Serial / BLE OTA) |
|---|---|---|
| Full (F4LEK/EA2OY base) | [Full-b115.uf2](firmware/APRS-TH-TEcho-Plus-Full-b115.uf2) | [Full-b115-dfu.zip](firmware/APRS-TH-TEcho-Plus-Full-b115-dfu.zip) |
| Minimal (ESP32APRS_LoRa port) | [Min-0.1.1.uf2](firmware/APRS-TH-TEcho-Plus-Min-0.1.1.uf2) | [Min-0.1.1-dfu.zip](firmware/APRS-TH-TEcho-Plus-Min-0.1.1-dfu.zip) |

SHA256:

```
fd8ce5333d8c4df3f774385f4a6b9bb58cd998ad8eaf1eee9c86cc276d5be890  Full-b115-dfu.zip
3b572e9feddb527bc7201992e743c8946a26c37638ec418260595004d1e30cb8  Min-0.1.1-dfu.zip
4734a0edbaca93164d8c8eee2a4c1e28b0bb08dd299ecef87b3c9f9384248575  Full-b115.uf2
5ec789c5f190e165d26873f9a15a3424e2d3433291933398e68cd8c506b489c8  Min-0.1.1.uf2
```

## Update methods

### 1. Bluetooth LE OTA (recommended after first install)

1. On the device, enter OTA mode:
   - **Full:** `Settings → BLE OTA` → confirm (press twice). The screen shows
     `BLE OTA: starting...` and reboots.
   - **Minimal:** hold the **User button** for **3 seconds** (or send `ota` over
     the USB console). The board reboots into the bootloader.
2. On a phone/computer with Bluetooth, open
   **<https://aprs-lora.pizones.com/update/>** (Chrome/Edge, Web Bluetooth).
3. Choose Full or Minimal → **Connect & Update** → select the device
   (`DfuTarg` / `NICENANO`) → wait for 100%.
4. The board reboots into the new firmware.

The web updater fetches the latest `latest.json` and the `.zip` from this
repository. It can also be used offline by downloading the `.zip` first.

Alternative apps that speak Nordic Secure DFU:

- **nRF Connect Device Manager** (Nordic Semiconductor) — Android/iOS
- **Adafruit Bluefruit Connect** — Android/iOS (nRF52 DFU)
- **nRF Toolbox** — Android/iOS

Use the `.zip` package (not `.uf2`), and set Packet Receipt Notification
(PRN) to **8 or less** if the app asks.

### 2. USB UF2 (first install / recovery)

1. Press **RESET twice** quickly → drive `NICENANO` (or `TECHOBOOT`/`NRF52`).
2. Copy the `.uf2` to the drive.
3. Wait for reboot.

### 3. USB Serial DFU

```bash
python3 -m pip install --user adafruit-nrfutil
adafruit-nrfutil dfu serial -pkg APRS-TH-TEcho-Plus-Full-b115-dfu.zip -p /dev/ttyACM0 -b 115200
```

### 4. SWD / J-Link recovery

Advanced, only if the bootloader is damaged. Erase-all and reflash
SoftDevice + bootloader + application. See the device manual.

## Important notes

- The images target **SoftDevice S140 7.x** (`softdevice_req 0x0123`).
  For an S140 6.1.1 board, build with the `techo`/`techo_plus` (v6) environment.
- Back up `CURRENT.UF2` from the DFU drive before the first flash.
- BLE OTA must be started from the device (menu/button/CLI); the normal
  application does not advertise the DFU service.
- The builds compile successfully but have not been field-tested on every
  board revision. Report issues with the board version and logs.

## Credits

This project builds on the work of the amateur radio and open-source community:

- **nakhonthai / ESP32APRS_LoRa** — original APRS over LoRa prototype and
  protocol ideas. <https://github.com/nakhonthai/ESP32APRS_LoRa>
- **F4LEK-TECHO-APRS** by remy33140 — T-Echo APRS firmware base (Full).
  <https://github.com/remy33140/F4LEK-TECHO-APRS>
- **EA2OY APRS System** (“Kacho System”) — upstream of F4LEK.
  <https://github.com/EA2OY/EA2OY-APRS-SYSTEM>
- **LilyGO** — T-Echo hardware, pinout, bootloader and examples.
  <https://github.com/Xinyuan-LilyGO/T-Echo>
- **cfr34k / t-echo-lora-aprs** — T-Echo low-power APRS reference and pinout.
  <https://github.com/cfr34k/t-echo-lora-aprs>
- **Adafruit nRF52 Arduino core / bootloader** — nRF52 support and UF2/DFU.
  <https://github.com/adafruit/Adafruit_nRF52_Arduino>
- **RadioLib**, **TinyGPSPlus**, **ArduinoJson** — radio, GNSS and config.
- **web-bluetooth-dfu** by Rob Moran (thegecko) — browser Nordic Secure DFU.
  <https://github.com/thegecko/web-bluetooth-dfu>
- **JSZip**, **crc-32** — DFU package handling in the browser.

If you redistribute binaries, keep the GPL-3.0 source available and preserve
these credits.

## Links

- Website / updater: <https://aprs-lora.pizones.com/update/>
- System + device manuals: <https://aprs-lora.pizones.com/>
- Hardware: LilyGO T-Echo Plus (BME280, 433 MHz)

---

Maintained by **E23BMY** · APRS LoRa Thailand
