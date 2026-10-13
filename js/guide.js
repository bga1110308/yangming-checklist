/* 使用說明：第一次打開自動跳出，按 X 關掉後，右上角「說明」可以再打開 */
export const GUIDE_KEY = 'a051-guide-v1';

const steps = [
  ['先選名字', '右上角按「選點班人」，打一個字就會跳出名字。手機會記住，下次不用再選。'],
  ['開始點班', '首頁點一張表。數量正常直接按「全部符合」；不對就按「數量不符」改數字，並選原因、寫床號或去向，才能送出。'],
  ['掃 QR 碼', '病房每個點班位置會貼一張 QR 碼。用手機相機掃，或按首頁的「掃碼點班」，會直接打開那個位置的點班表。'],
  ['平面圖', '首頁可以切換「清單／平面圖」。平面圖上每個圓圈是一個點班位置，顏色代表這一班的狀態，點圓圈就進那張表。護理長可以按「調整位置」，把圓圈拖到病房實際擺放的地方。'],
  ['看點了多少', '送出後再點那張表，會看到「這次點的數量」，每一項的基本量和實點都在上面，不符合的標紅。護理長總覽點任何一格也看得到。'],
  ['切換護理長', '右上角可以切換「護理師／護理長」。護理長可以看整個月的總覽、改備品基本量、調整平面圖、印 QR 碼貼紙。']
];

export function guideHTML(trialNote) {
  return `<div class="modal" id="guide" role="dialog" aria-modal="true" aria-labelledby="guide-t">
    <div class="modal-in">
      <button class="modal-x" data-act="guide-close" aria-label="關閉說明">×</button>
      <h2 id="guide-t">A051 無紙化點班・使用說明</h2>
      <ol class="guide">${steps.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join('')}</ol>
      <p class="guide-note">${trialNote}<br>裡面都是示範資料，請不要輸入真實病人資料。</p>
      <button class="submit wide" data-act="guide-close">開始使用</button>
    </div></div>`;
}
