/* 平面圖：病房平面圖上放六張點班表的圖示，點圖示進那張表；護理長可以拖動圖示到實際位置。
   位置用「佔圖片寬高的百分比」存，所以手機、電腦、放大縮小都對得上同一個點。 */
import { FORMS } from './forms.js';

/* 預設位置：大致放在護理站周圍，護理長再拖到實際擺放的地方 */
export const FLOOR_DEFAULT = {
  cart:   { x: 61, y: 33 },
  equip:  { x: 41, y: 40 },
  fridge: { x: 45, y: 49 },
  cold:   { x: 51, y: 55 },
  ctrl:   { x: 56, y: 44 },
  month:  { x: 74, y: 57 }
};
const posOf = (pos, id) => (pos && pos[id]) || FLOOR_DEFAULT[id];
const clamp = v => Math.max(2, Math.min(98, v));

/* 畫整個平面圖區塊。statusOf(f) 回傳這一班的狀態（跟清單共用同一個函式） */
export function floorHTML({ pos, editing, zoom, head, statusOf, note }) {
  const marks = FORMS.map(f => {
    const p = posOf(pos, f.id), n = statusOf(f);
    // 編輯中只能拖、不能點進表單；平常點了就跟清單一樣開那張表
    const act = editing ? `data-fid="${f.id}"` : n.attrs;
    return `<button class="fmk st-${n.busy ? 'busy' : n.st}${editing ? ' drag' : ''}" style="left:${p.x}%;top:${p.y}%" ${act}
      aria-label="${f.name}：${n.pill || ''}">
      <span class="dot">${f.mark}</span><span class="lab">${f.short}</span></button>`;
  }).join('');
  const tools = head
    ? (editing
      ? `<div class="floorbar editing"><span>拖動圖示到實際擺放的位置，放開就會儲存，大家看到的位置會一起更新。</span>
           <button data-act="floor-reset">恢復預設位置</button><button class="primary" data-act="floor-edit">完成</button></div>`
      : `<div class="floorbar"><span>點圖示直接進那張點班表。</span><button data-act="floor-edit">調整位置</button></div>`)
    : `<div class="floorbar"><span>點圖示直接進那張點班表。護理長可以調整圖示位置。</span></div>`;
  return `${tools}
    <div class="floorwrap">
      <div class="floormap${zoom ? ' zoom' : ''}" id="floormap">
        <img src="img/a051-floor.jpg" alt="A051 病房消防暨緊急逃生平面圖" draggable="false">
        ${marks}
      </div>
    </div>
    <div class="floorfoot">
      <div class="legend fl-legend"><span><i class="lg-now"></i>待點</span><span><i class="lg-ok"></i>已完成</span><span><i class="lg-busy"></i>有人在點</span><span><i class="lg-abn"></i>有異常</span><span><i class="lg-miss"></i>逾時未點／還沒到</span></div>
      <button class="linkbtn" data-act="floor-zoom">${zoom ? '縮小' : '放大'}</button>
    </div>
    ${head && editing ? `<p class="floornote">${note}</p>` : ''}`;
}

/* 拖動：只綁一次在 document 上。拖的過程只移動畫面上的圖示，放開才呼叫 onDrop 存檔，避免一直寫雲端 */
export function bindFloorDrag(onDrop) {
  let cur = null;
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.fmk.drag'); if (!el) return;
    e.preventDefault();
    cur = { el, map: el.closest('.floormap'), id: el.dataset.fid };
    el.setPointerCapture(e.pointerId); el.classList.add('moving');
  });
  document.addEventListener('pointermove', e => {
    if (!cur) return;
    const r = cur.map.getBoundingClientRect();
    cur.x = clamp((e.clientX - r.left) / r.width * 100);
    cur.y = clamp((e.clientY - r.top) / r.height * 100);
    cur.el.style.left = cur.x + '%'; cur.el.style.top = cur.y + '%';
  });
  const end = () => {
    if (!cur) return;
    const { el, id, x, y } = cur; cur = null; el.classList.remove('moving');
    if (x !== undefined) onDrop(id, Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}
