import JSZip from 'jszip';
import CRC32 from 'crc-32';
import SecureDfu from 'web-bluetooth-dfu';

const MANIFEST_URL = 'https://raw.githubusercontent.com/petchin/aprs-lora-techo/main/latest.json';

export function initUpdater() {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const logEl = $('log');
  const barEl = $('bar');
  const progressEl = $('progress');
  const versionEl = $('version');
  const devicesEl = $('devices');
  if (!statusEl || !devicesEl) return;

  let manifest = null;
  let busy = false;

  function setStatus(msg, cls = '') {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + cls;
  }

  function log(msg) {
    const t = new Date().toLocaleTimeString();
    logEl.textContent += `[${t}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setProgress(current, total) {
    const pct = total ? Math.round((current / total) * 100) : 0;
    barEl.style.width = pct + '%';
    progressEl.textContent = total ? `${pct}% · ${current}/${total} bytes` : '';
  }

  async function loadManifest() {
    setStatus('กำลังดึงข้อมูลเวอร์ชันจาก GitHub…');
    try {
      const r = await fetch(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      manifest = await r.json();
      versionEl.textContent = `Firmware ล่าสุด: ${manifest.version} (${manifest.released})`;
      renderDevices();
      setStatus('พร้อมอัปเดต — เลือกเวอร์ชันแล้วกด Connect & Update', 'ok');
    } catch (e) {
      setStatus('ดึง manifest ไม่ได้: ' + e.message, 'err');
      log('manifest error: ' + e.message);
    }
  }

  function renderDevices() {
    devicesEl.innerHTML = '';
    for (const key of ['full', 'min']) {
      const d = manifest[key];
      if (!d) continue;
      const card = document.createElement('div');
      card.className = 'device';
      card.innerHTML = `
        <div class="device-head">
          <strong>${d.label}</strong>
          <span class="ver">${d.version}</span>
        </div>
        <div class="device-sub">DFU .zip · SHA256 ${d.sha256.slice(0, 12)}…</div>
        <button data-key="${key}">Connect &amp; Update</button>
      `;
      card.querySelector('button').addEventListener('click', () => update(d));
      devicesEl.appendChild(card);
    }
  }

  async function fetchPackage(url) {
    log('ดาวน์โหลดแพ็กเกจ: ' + url);
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ HTTP ' + r.status);
    return await r.arrayBuffer();
  }

  async function sha256(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function parsePackage(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('ไม่พบ manifest.json ในแพ็กเกจ DFU');
    const m = JSON.parse(await manifestFile.async('string')).manifest;
    const app = m.application;
    if (!app) throw new Error('แพ็กเกจนี้ไม่มี application image');
    const init = await zip.file(app.dat_file).async('arraybuffer');
    const image = await zip.file(app.bin_file).async('arraybuffer');
    return { init, image };
  }

  async function update(deviceInfo) {
    if (busy) return;
    if (!navigator.bluetooth) {
      setStatus('เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — ใช้ Chrome/Edge บน Android หรือคอมพิวเตอร์', 'err');
      return;
    }

    busy = true;
    barEl.style.width = '0%';
    progressEl.textContent = '';
    devicesEl.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      // Web Bluetooth ต้องเรียกจาก user gesture โดยตรง: เลือกอุปกรณ์ก่อนดาวน์โหลด
      const DFU_SERVICE = '0000fe59-0000-1000-8000-00805f9b34fb';
      setStatus('เลือกอุปกรณ์ DFU ในหน้าต่าง Bluetooth…');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [DFU_SERVICE] }, { namePrefix: 'AdaDFU' }],
        optionalServices: [DFU_SERVICE],
      });
      log('เลือกอุปกรณ์: ' + (device.name || device.id));

      setStatus('ดาวน์โหลดและตรวจแพ็กเกจ…');
      const zipBuf = await fetchPackage(deviceInfo.dfu);
      const actual = await sha256(zipBuf);
      if (deviceInfo.sha256 && actual !== deviceInfo.sha256) {
        throw new Error(`SHA256 ไม่ตรง (ได้ ${actual.slice(0, 16)}…)`);
      }
      log('SHA256 ถูกต้อง: ' + actual.slice(0, 16) + '…');
      const { init, image } = await parsePackage(zipBuf);
      log(`แพ็กเกจพร้อม: init ${init.byteLength} B, image ${image.byteLength} B`);

      const dfu = new SecureDfu(CRC32.buf);
      dfu.addEventListener('log', (e) => log(e.message));
      dfu.addEventListener('progress', (e) => setProgress(e.currentBytes, e.totalBytes));

      setStatus('กำลังอัปเดต — ห้ามปิดหน้าหรือออกจากระยะ');
      await dfu.update(device, init, image);
      setProgress(1, 1);
      setStatus('อัปเดตเสร็จ! บอร์ดจะรีสตาร์ทเป็นเฟิร์มแวร์ใหม่', 'ok');
      log('อัปเดตเสร็จสมบูรณ์');
    } catch (e) {
      setStatus('ล้มเหลว: ' + (e && e.message ? e.message : e), 'err');
      log('error: ' + (e && e.stack ? e.stack : e));
    } finally {
      busy = false;
      devicesEl.querySelectorAll('button').forEach((b) => (b.disabled = false));
    }
  }

  loadManifest();
}
