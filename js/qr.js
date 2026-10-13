/* QR 碼：
   1. 每個點班位置一張 QR 貼紙，內容是網址加「#f-表單代號」，用手機相機或頁面上的掃碼鈕都能直接進那張表。
   2. 頁面上的掃碼：用手機後鏡頭，每一格畫面交給 jsQR 解碼。
   兩個外部程式庫都在需要時才載入，平常打開頁面不會變慢。 */
import { FORMS } from './forms.js?v=20261013122300';

const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const QRGEN = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const loaded = {};
function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { delete loaded[src]; fail(new Error('load')); };
    document.head.appendChild(s);
  });
  return loaded[src];
}

/* 網站本身的網址（不含 # 後面），貼紙上的 QR 都指向這裡 */
export const siteUrl = () => location.origin + location.pathname;
export const formUrl = fid => `${siteUrl()}#f-${fid}`;
/* 從掃到的文字或網址的 # 取出表單代號，不是點班 QR 就回傳 null */
export function fidFrom(text) {
  const m = String(text || '').match(/#f-([a-z]+)\b/);
  return m && FORMS.some(f => f.id === m[1]) ? m[1] : null;
}

/* ===== 掃碼 ===== */
let stream = null, timer = null;
export async function startScan(video, onFound, onError) {
  try {
    await loadScript(JSQR);
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (e) { stopScan(); onError(e && e.name === 'NotAllowedError' ? 'denied' : 'fail'); return; }
  video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play().catch(() => {});
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  // 每 0.25 秒解一次碼就夠快，也不會讓手機發燙
  timer = setInterval(() => {
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (code && code.data) onFound(code.data);
  }, 250);
}
export function stopScan() {
  clearInterval(timer); timer = null;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

/* ===== 貼紙 ===== */
export async function qrSvg(text) {
  await loadScript(QRGEN);
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}
export async function stickersHTML() {
  const cards = await Promise.all(FORMS.map(async f => `
    <div class="qrcard"><div class="qrimg">${await qrSvg(formUrl(f.id))}</div>
      <b>${f.name}</b><small>A051 病房・掃描開始點班</small></div>`));
  return cards.join('');
}
