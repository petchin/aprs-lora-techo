const CFG_SERVICE = 'f4e40001-7e5c-4b8a-9c1d-2a4f4c454b00';
const CFG_RX = 'f4e40002-7e5c-4b8a-9c1d-2a4f4c454b00';
const CFG_TX = 'f4e40003-7e5c-4b8a-9c1d-2a4f4c454b00';

export function initConfig() {
  const $ = (id) => document.getElementById(id);
  const connEl = $('cfgConn');
  const logEl = $('cfgLog');
  if (!connEl) return;

  let rxChar = null;
  let txChar = null;
  let rxBuffer = '';
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  function log(msg) {
    const t = new Date().toLocaleTimeString();
    logEl.textContent += `[${t}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setConn(msg, cls = '') {
    connEl.textContent = msg;
    connEl.className = 'conn ' + cls;
  }

  function setEnabled(on) {
    for (const id of ['cfgRead', 'cfgSave', 'cfgStatusBtn', 'cfgBeacon', 'cfgSendMsg']) {
      const el = $(id);
      if (el) el.disabled = !on;
    }
  }

  function setStats(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? '-';
  }

  async function send(obj) {
    if (!rxChar) throw new Error('ยังไม่ได้เชื่อมต่อ');
    const data = encoder.encode(JSON.stringify(obj) + '\n');
    log('→ ' + JSON.stringify(obj));
    await rxChar.writeValue(data);
  }

  function applyConfig(cfg) {
    if (!cfg) return;
    if (cfg.status !== undefined) $('cfgStatus').value = cfg.status;
    if (cfg.comment !== undefined) $('cfgComment').value = cfg.comment;
    if (cfg.msgText !== undefined) $('cfgMsgText').value = cfg.msgText;
    if (cfg.callsign !== undefined) $('cfgCallsign').value = cfg.callsign;
    if (cfg.showRssi !== undefined) $('cfgShowRssi').checked = !!cfg.showRssi;
    if (cfg.wxSensorActive !== undefined) $('cfgWxSensor').checked = !!cfg.wxSensorActive;
    if (cfg.sendBatteryTelemetry !== undefined) $('cfgBattTelemetry').checked = !!cfg.sendBatteryTelemetry;
    if (cfg.remoteEnabled !== undefined) $('cfgRemote').checked = !!cfg.remoteEnabled;
    if (cfg.managers !== undefined) $('cfgManagers').value = cfg.managers;
    if (cfg.wxIntervalMin !== undefined) $('cfgWxInterval').value = cfg.wxIntervalMin;
    if (cfg.telemetryIntervalMin !== undefined) $('cfgTelemetryInterval').value = cfg.telemetryIntervalMin;
    if (cfg.tncProtocol !== undefined) $('cfgIgate').checked = (cfg.tncProtocol === 2);
    if (cfg.digiMode !== undefined) $('cfgDigi').checked = (cfg.digiMode > 0);
    if (cfg.digiAuto !== undefined) $('cfgDigiAuto').checked = !!cfg.digiAuto;
  }

  function batteryLabel(pct) {
    if (pct >= 75) return 'ดี (OK)';
    if (pct >= 50) return 'ปานกลาง';
    if (pct >= 25) return 'เริ่มอ่อน';
    if (pct >= 5) return 'อ่อน';
    return 'ควรชาร์จ';
  }

  function applyStatus(st) {
    if (!st) return;
    setStats('cfgFw', `${st.version || '?'} · ${st.build || ''}`);
    if (st.radio) {
      setStats('cfgRssi', `${st.radio.lastRssi ?? '-'} dBm / ${st.radio.lastSnr ?? '-'} dB`);
      setStats('cfgCounts', `${st.radio.txCount ?? '-'} / ${st.radio.rxCount ?? '-'}`);
    }
    if (st.sensors) {
      const s = st.sensors;
      setStats('cfgWx', `${s.wxChip || (s.wx ? 'OK' : 'ไม่พบ')}`);
      setStats('cfgTemp', s.tempC ? `${Number(s.tempC).toFixed(1)} °C` : '-');
      setStats('cfgHum', s.hum ? `${Number(s.hum).toFixed(1)} %` : '-');
      setStats('cfgPress', s.hPa ? `${Number(s.hPa).toFixed(1)} hPa` : '-');
      const bat = s.batPct !== undefined ? `${s.batPct}%` : '-';
      setStats('cfgBat', s.usb ? `${bat} (USB)` : bat);
      const mv = s.vbatDivV ? (Number(s.vbatDivV) * 2000).toFixed(0) : null;
      setStats('cfgBatV', mv ? `${mv} mV` : '-');
      setStats('cfgBatState', s.batPct !== undefined ? batteryLabel(Number(s.batPct)) : '-');
    }
  }

  function handleLine(line) {
    line = line.trim();
    if (!line) return;
    log('← ' + line);
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.config) applyConfig(msg.config);
    if (msg.status) applyStatus(msg.status);
    if (msg.ok === false && msg.error) setConn('อุปกรณ์ตอบกลับ: ' + msg.error, 'err');
  }

  function handleNotification(event) {
    const v = event.target.value;
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    rxBuffer += decoder.decode(bytes, { stream: true });
    let i;
    while ((i = rxBuffer.indexOf('\n')) >= 0) {
      const line = rxBuffer.slice(0, i);
      rxBuffer = rxBuffer.slice(i + 1);
      handleLine(line);
    }
  }

  async function connect() {
    if (!navigator.bluetooth) {
      setConn('เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — ใช้ Chrome/Edge (Android/คอม)', 'err');
      return;
    }
    try {
      setEnabled(false);
      setConn('กำลังเลือกอุปกรณ์…');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'T-Echo' }],
        optionalServices: [CFG_SERVICE],
      });
      device.addEventListener('gattserverdisconnected', () => {
        setConn('ขาดการเชื่อมต่อ', 'err');
        setEnabled(false);
        rxChar = txChar = null;
      });
      log('เลือกอุปกรณ์: ' + (device.name || device.id));
      setConn('กำลังเชื่อมต่อ GATT…');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(CFG_SERVICE);
      rxChar = await service.getCharacteristic(CFG_RX);
      txChar = await service.getCharacteristic(CFG_TX);
      await txChar.startNotifications();
      txChar.addEventListener('characteristicvaluechanged', handleNotification);
      setEnabled(true);
      setConn('เชื่อมต่อแล้ว: ' + (device.name || device.id), 'ok');
      await send({ cmd: 'get' });
      await sleep(300);
      await send({ cmd: 'status' });
    } catch (e) {
      setConn('เชื่อมต่อไม่สำเร็จ: ' + (e && e.message ? e.message : e), 'err');
      log('error: ' + (e && e.stack ? e.stack : e));
      setEnabled(false);
    }
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function collectConfig() {
    const cfg = {
      status: $('cfgStatus').value,
      comment: $('cfgComment').value,
      msgText: $('cfgMsgText').value,
      showRssi: $('cfgShowRssi').checked,
      wxSensorActive: $('cfgWxSensor').checked,
      sendBatteryTelemetry: $('cfgBattTelemetry').checked,
      remoteEnabled: $('cfgRemote').checked,
      managers: $('cfgManagers').value.trim(),
      tncProtocol: $('cfgIgate').checked ? 2 : 0,
      digiMode: $('cfgDigi').checked ? 2 : 0,
      digiAuto: $('cfgDigiAuto').checked,
    };
    const cs = $('cfgCallsign').value.trim();
    if (cs) cfg.callsign = cs;
    const wxInt = parseInt($('cfgWxInterval').value, 10);
    if (!isNaN(wxInt)) cfg.wxIntervalMin = wxInt;
    const telInt = parseInt($('cfgTelemetryInterval').value, 10);
    if (!isNaN(telInt)) cfg.telemetryIntervalMin = telInt;
    return cfg;
  }

  async function saveConfig() {
    try {
      await send({ cmd: 'set', config: collectConfig() });
      setConn('บันทึกแล้ว', 'ok');
    } catch (e) {
      setConn('บันทึกไม่สำเร็จ: ' + e.message, 'err');
    }
  }

  async function readAll() {
    await send({ cmd: 'get' });
    await sleep(300);
    await send({ cmd: 'status' });
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), config: collectConfig() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aprs-techo-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setConn('ดาวน์โหลด config สำรองแล้ว', 'ok');
  }

  async function importConfig(file) {
    try {
      const data = JSON.parse(await file.text());
      applyConfig(data.config || data);
      setConn('โหลด config แล้ว — กด "บันทึกการตั้งค่า" เพื่อเขียนลงเครื่อง', 'ok');
    } catch (e) {
      setConn('โหลด config ไม่สำเร็จ: ' + e.message, 'err');
    }
  }

  async function sendMessage() {
    const to = $('cfgMsgTo').value.trim();
    const text = $('cfgMsgBody').value.trim();
    if (!text) { setConn('กรุณากรอกข้อความ', 'err'); return; }
    try {
      await send({ cmd: 'msg', to, text });
      setConn('ส่งข้อความแล้ว', 'ok');
    } catch (e) {
      setConn('ส่งไม่สำเร็จ: ' + e.message, 'err');
    }
  }

  async function sendBeacon() {
    try {
      await send({ cmd: 'beacon' });
      setConn('สั่งส่ง beacon แล้ว', 'ok');
    } catch (e) {
      setConn('ส่ง beacon ไม่สำเร็จ: ' + e.message, 'err');
    }
  }

  $('cfgConnect').addEventListener('click', connect);
  $('cfgRead').addEventListener('click', readAll);
  $('cfgSave').addEventListener('click', saveConfig);
  $('cfgSendMsg').addEventListener('click', sendMessage);
  $('cfgBeacon').addEventListener('click', sendBeacon);
  $('cfgStatusBtn').addEventListener('click', async () => {
    try { await send({ cmd: 'status' }); } catch (e) { setConn(e.message, 'err'); }
  });
  $('cfgExport').addEventListener('click', exportConfig);
  $('cfgImport').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) importConfig(e.target.files[0]);
  });
  $('cfgReboot').addEventListener('click', async () => {
    if (!confirm('รีสตาร์ท T-Echo ตอนนี้หรือไม่?')) return;
    try {
      await send({ cmd: 'reboot' });
      setConn('สั่งรีสตาร์ทแล้ว — การเชื่อมต่อจะหลุด', 'ok');
    } catch (e) {
      setConn('รีสตาร์ทไม่สำเร็จ: ' + e.message, 'err');
    }
  });
}
