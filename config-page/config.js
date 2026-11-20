const CFG_SERVICE = 'f4e40001-7e5c-4b8a-9c1d-2a4f4c454b00';
const CFG_RX = 'f4e40002-7e5c-4b8a-9c1d-2a4f4c454b00'; // phone -> node
const CFG_TX = 'f4e40003-7e5c-4b8a-9c1d-2a4f4c454b00'; // node -> phone

const $ = (id) => document.getElementById(id);
const connEl = $('conn');
const logEl = $('log');

let device = null;
let rxChar = null;
let txChar = null;
let rxBuffer = '';
let decoder = new TextDecoder();
let encoder = new TextEncoder();

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
  for (const id of ['read', 'save', 'statusBtn', 'beaconBtn', 'sendMsg']) {
    $(id).disabled = !on;
  }
}

function setStats(id, value) {
  $(id).textContent = value ?? '-';
}

async function send(obj) {
  if (!rxChar) throw new Error('ยังไม่ได้เชื่อมต่อ');
  const data = encoder.encode(JSON.stringify(obj) + '\n');
  log('→ ' + JSON.stringify(obj));
  await rxChar.writeValue(data);
}

function applyConfig(cfg) {
  if (!cfg) return;
  if (cfg.status !== undefined) $('status').value = cfg.status;
  if (cfg.comment !== undefined) $('comment').value = cfg.comment;
  if (cfg.msgText !== undefined) $('msgText').value = cfg.msgText;
  if (cfg.callsign !== undefined) $('callsign').value = cfg.callsign;
}

function applyStatus(st) {
  if (!st) return;
  setStats('fw', `${st.version || '?'} · ${st.build || ''}`);
  if (st.radio) {
    setStats('rssi', `${st.radio.lastRssi ?? '-'} dBm / ${st.radio.lastSnr ?? '-'} dB`);
    setStats('counts', `${st.radio.txCount ?? '-'} / ${st.radio.rxCount ?? '-'}`);
  }
  if (st.sensors) {
    const s = st.sensors;
    setStats('wx', `${s.wxChip || (s.wx ? 'OK' : 'ไม่พบ')}`);
    setStats('temp', s.tempC ? `${Number(s.tempC).toFixed(1)} °C` : '-');
    setStats('hum', s.hum ? `${Number(s.hum).toFixed(1)} %` : '-');
    setStats('press', s.hPa ? `${Number(s.hPa).toFixed(1)} hPa` : '-');
    const bat = s.batPct !== undefined ? `${s.batPct}%` : '-';
    setStats('bat', s.usb ? `${bat} (USB)` : bat);
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
    device = await navigator.bluetooth.requestDevice({
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

async function saveConfig() {
  const cfg = {
    status: $('status').value,
    comment: $('comment').value,
    msgText: $('msgText').value,
  };
  const cs = $('callsign').value.trim();
  if (cs) cfg.callsign = cs;
  try {
    await send({ cmd: 'set', config: cfg });
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

async function sendMessage() {
  const to = $('msgTo').value.trim();
  const text = $('msgBody').value.trim();
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

$('connect').addEventListener('click', connect);
$('read').addEventListener('click', readAll);
$('save').addEventListener('click', saveConfig);
$('sendMsg').addEventListener('click', sendMessage);
$('beaconBtn').addEventListener('click', sendBeacon);
$('statusBtn').addEventListener('click', async () => {
  try { await send({ cmd: 'status' }); } catch (e) { setConn(e.message, 'err'); }
});
