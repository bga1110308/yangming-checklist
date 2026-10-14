/* 畫面程式：首頁、點班表單、點班總覽、基本量設定。資料從 store.js 來，表單內容從 forms.js 來 */
import { SHIFTS, SH, REASONS, DEFAULT_NURSES, FORMS, FM, ADD_FROM, itemKey, applyItems, hiddenItems } from './forms.js?v=20261014233017';
import { start, OWNER, saveRecord, saveBase, saveFloor, markActive, clearActive, seedDemo, resetDemo, googleLogin, logout,
  saveNurse, removeNurse, seedNurses, saveItems } from './store.js?v=20261014233017';
import { floorHTML, bindFloorDrag } from './floor.js?v=20261014233017';
import { fidFrom, startScan, stopScan, stickersHTML } from './qr.js?v=20261014233017';
import { guideHTML, GUIDE_KEY } from './guide.js?v=20261014233017';

/* ===== 圖示：直接寫在檔案裡，不靠外部 CDN，任何環境都顯示得出來 ===== */
const IC={
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L19 7"/></svg>',
  back:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  user:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  info:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  qr:'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>',
  lock:'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  warn:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>'
};

/* ===== 日期工具 ===== */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const pymd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const WD='日一二三四五六';
const md=s=>{const d=pymd(s);return `${d.getMonth()+1}/${d.getDate()}（${WD[d.getDay()]}）`;};
const hm=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function firstSunday(y,m){return 1+((7-new Date(y,m,1).getDay())%7);}
function curShift(){const h=new Date().getHours();return SHIFTS.find(s=>h>=s.start&&h<s.end);}
function slotRange(date,sid){const a=pymd(date),b=pymd(date);a.setHours(SH[sid].start);b.setHours(SH[sid].end);return [a,b];}
function dueDay(f,date){if(f.freq!=='monthly')return true;const d=pymd(date);return d.getDate()===firstSunday(d.getFullYear(),d.getMonth());}

/* ===== 資料：紀錄存在 Firebase 雲端，大家共用同一份；畫面只透過 store.js 讀寫 ===== */
const NKEY='a051-nurse', RKEY='a051-role', HKEY='a051-home';
let S={records:[],base:{},baseLog:[],nurse:null,role:'nurse',user:null,pos:{},active:{},nurses:[],items:{hide:[],add:[]}};
/* 品項清單有變動、但有人正在填表時先不套用，等表關掉再套，免得填到一半項目位置跑掉 */
let ITEMS_PENDING=false;
/* 首頁顯示方式（清單／平面圖）記在這台裝置；平面圖的編輯、放大只是這次畫面的狀態 */
let HOMEMODE='list', FLOOR={edit:false,zoom:false};
/* QR 貼紙產生一次就留著，雲端更新重畫畫面時才不會消失 */
let QRHTML='';
let LOADED=false, SEEDING=false, NSEEDING=false, baseChain=Promise.resolve();
function localGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function localSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}

/* 身分：試用版每個人都能自己切換成護理長，體驗護理長能看、能改的東西。
   正式版要改成由醫院帳號決定身分，不能自己切。 */
const isHead=()=>S.role==='head';
/* 擁有者（專案建立人）用 Google 登入後才能清掉重來，避免同學誤刪大家的試用紀錄 */
const isOwner=()=>!!(S.user&&!S.user.isAnonymous&&S.user.email===OWNER);
const TRIAL_NOTE='所有人都能點班、看點班總覽。試用版每位同學都能切換成護理長試用；正式版只有護理長和指定主管能改備品基本量、調整平面圖位置。';

function startCloud(){
  start({
    onUser:u=>{S.user=u; render();},
    onRecords:(list,fromCache)=>{
      const first=!LOADED; S.records=list; LOADED=true; refresh();
      if(first)routeFromHash();
      // 第一次上線雲端是空的，自動放示範資料，同學打開就看得到總覽的效果
      if(!list.length&&!fromCache&&!SEEDING){SEEDING=true; seedDemo(seed().records).catch(()=>{});}
    },
    onBase:v=>{S.base=Object.assign({},v.base||{}); S.baseLog=(v.log||[]).slice(); refresh();},
    onFloor:v=>{S.pos=Object.assign({},v.pos||{}); refresh();},
    onItems:v=>{S.items={hide:(v.hide||[]).slice(),add:(v.add||[]).slice()}; ITEMS_PENDING=true; refresh();},
    onActive:list=>{S.active=Object.fromEntries(list.map(a=>[a.id,a])); refresh();},
    onNurses:(list,fromCache)=>{
      S.nurses=list.sort((a,b)=>(a.at-b.at)||a.id.localeCompare(b.id)); refreshPicker(); refresh();
      // 雲端還沒有名單：放入預設的第二組名單，之後就以雲端為準
      if(!list.length&&!fromCache&&!NSEEDING){NSEEDING=true; seedNurses(DEFAULT_NURSES).catch(()=>{});}
    },
    onError:e=>{console.error(e); toast('暫時連不到雲端，請檢查網路後重新整理');}
  });
}
/* 別人送出時更新畫面；自己正在點的表、正在設定頁打字時都不重畫，免得填到一半被洗掉 */
function refresh(){
  if(TAB==='home'&&D)return;
  if(TAB==='settings'&&document.activeElement&&document.activeElement.matches('#view input'))return;
  render();
}

async function persistRecord(r){
  try{await saveRecord(r); return true;}
  catch(e){
    // 安全規則不准改已存在的紀錄，所以「權限不足」幾乎都是同一班剛被別人先送出
    toast(e&&e.code==='permission-denied'?'這一班剛剛已經有人送出了':'沒有存成功，請檢查網路再按一次');
    return false;
  }
}
function persistBase(){
  const body={base:Object.assign({},S.base),log:S.baseLog.slice(-200)};
  baseChain=baseChain.then(()=>saveBase(body)).catch(()=>toast('基本量沒有存成功，請檢查網路再改一次'));
}
function rec(fid,date,sid){return S.records.find(r=>r.f===fid&&r.d===date&&r.s===sid);}
function baseOf(fid,i,k,def){const v=S.base[`${fid}:${i}:${k}`];return v===undefined?def:v;}

/* 種子資料：從本月 1 號到現在，大部分正常，故意放幾筆異常與漏點，總覽才看得出效果 */
function seed(){
  const st={records:[],base:{},baseLog:[],nurse:null};
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  let r=7; const rnd=()=>{r=(r*9301+49297)%233280;return r/233280;};
  const skip={fridge5:true,cold3E:true};
  for(let d=1; d<=now.getDate(); d++){
    const date=ymd(new Date(y,m,d));
    FORMS.forEach(f=>{
      if(!dueDay(f,date))return;
      f.shifts.forEach(sid=>{
        const [a,b]=slotRange(date,sid); if(b>now)return;
        if(f.id==='fridge'&&d===5&&skip.fridge5)return;
        if(f.id==='cold'&&d===3&&sid==='E'&&skip.cold3E)return;
        const t=new Date(a.getTime()+(5+Math.floor(rnd()*40))*60000);
        const n=DEFAULT_NURSES[Math.floor(rnd()*DEFAULT_NURSES.length)][0];
        const rc={f:f.id,d:date,s:sid,who:n,t:hm(t),st:'ok',abn:[],n:countItems(f,sid)};
        if(f.type==='cold')rc.extra={use:f.drugs.map(()=>0),stock:f.drugs.map(coldStock)};
        if(f.type==='ctrl')rc.extra={items:f.drugs.map(g=>({i:g.i,n:g.n,in:0,use:0,stock:g.b}))};
        st.records.push(rc);
      });
    });
  }
  const pick=(fid,day,sid)=>{const l=st.records.filter(x=>x.f===fid&&(!sid||x.s===sid));return l.find(x=>pymd(x.d).getDate()===day)||l[l.length-1];};
  const mark=(x,item)=>{if(!x)return;x.st='abn';x.abn.push(item);};
  mark(pick('equip',6,'D'),{l:'Pulse Oximeter（小）',b:'4',a:'3',r:'借出',note:'12 床借用'});
  mark(pick('month',99),{l:'三層車',b:'4',a:'3',r:'送修',note:'輪子卡住，已報修'});
  mark(pick('cart',now.getDate()),{l:'手電筒 / 聚光筆燈・聚光筆燈',b:'2',a:'3',r:'多出待歸還',note:'多一支，待查是哪床留下的'});
  const c=pick('ctrl',7,'D'); if(c){c.extra={items:[{i:0,n:'Dormicum',in:1,use:1,stock:3,waste:'2.5',bed:'12',chart:'DEMO-0001'}]};}
  return st;
}
function countItems(f,sid){
  if(f.type==='count')return visItems(f,sid).length;
  if(f.type==='cold')return f.drugs.length;
  if(f.type==='check')return f.qs.length;
  return f.drugs.length;
}
function visItems(f,sid){return f.flat.filter(x=>!x.night||sid==='N');}
function partBases(f,x){return x.p.map((p,k)=>typeof p.b==='number'?baseOf(f.id,x.i,k,p.b):p.b);}
/* 用代號找品項：新增、刪除品項後，位置跟代號不一定一樣，一律用代號找 */
const itemOf=(f,i)=>f.flat.find(x=>x.i===+i);
const drugOf=(f,i)=>f.drugs.find(g=>g.i===+i);
/* 冷藏藥（10/14 同學回饋）：結存量要等於護理長設定的數量才正常，預設 1；
   基本量只是參考，使用量 0 也正常（點班前沒人用）。只有冷藏藥這樣算，其他表照原本的基本量。 */
const COLD_STOCK_DEF=1;
const coldStock=g=>baseOf('cold',g.i,'s',COLD_STOCK_DEF);
const coldBase=g=>baseOf('cold',g.i,0,g.b);
const fmtV=v=>({ok:'正常',bad:'故障',amt:'適量',low:'不足'})[v]??v;
const fmtBases=bs=>bs.map(v=>v==='ok'?'ok':v==='amt'?'適量':v).join(' / ');

/* ===== 每格的狀態：完成／異常／逾時未點／進行中／還沒到 ===== */
function slotStatus(f,date,sid){
  if(!dueDay(f,date))return 'na';
  const r=rec(f.id,date,sid); if(r)return r.st;
  const [a,b]=slotRange(date,sid), now=new Date();
  if(now>=b)return 'miss'; if(now>=a)return 'now'; return 'future';
}
const ST_TXT={ok:'已完成',abn:'有異常',miss:'逾時未點',now:'待點',future:'還沒到',na:''};
const ST_CELL={ok:'✓',abn:'!',miss:'未',now:'…',future:'',na:''};

/* ===== 畫面路由 ===== */
let TAB='home', D=null, O={flt:'all',sel:null}, SF='cart', RESET=false;
function render(){
  if(ITEMS_PENDING&&!D){applyItems(S.items); ITEMS_PENDING=false;}
  renderTop();
  ['home','overview','settings'].forEach(t=>document.getElementById('tab-'+t).classList.toggle('on',TAB===t));
  document.getElementById('foot').innerHTML='';
  const v=document.getElementById('view');
  if(!LOADED){v.innerHTML='<h1 class="page">本班點班</h1><p class="empty">正在載入大家的點班紀錄…</p>';return;}
  if(TAB==='home') v.innerHTML = D ? formView() : homeView();
  if(TAB==='overview') v.innerHTML=overviewView();
  if(TAB==='settings') v.innerHTML=isHead()?settingsView():lockedView('基本量設定','備品基本量和點班人員名單由護理長統一修改，改一次每一班都同步，而且留下誰改的。');
  if(TAB==='home'&&D&&!rec(D.f,D.d,D.s)) updateFoot();
}
function renderTop(){
  const now=new Date(), s=curShift();
  document.getElementById('top').innerHTML=`
    <div class="ward"><b>A051 病房</b><small class="num">${now.getFullYear()-1911}/${pad(now.getMonth()+1)}/${pad(now.getDate())}（${WD[now.getDay()]}）${hm(now)}</small></div>
    <span class="shiftchip">${s.name} <span class="num">${s.code}</span></span>
    <button class="rolechip${isHead()?' head':''}" data-act="role" aria-label="切換身分">${isHead()?'護理長':'護理師'}<small>切換</small></button>
    <button class="who${S.nurse?'':' empty'}" data-act="pick">${IC.user}${S.nurse?esc(S.nurse):'選點班人'}</button>
    <button class="helpbtn" data-act="guide-open" aria-label="使用說明">?<span>說明</span></button>`;
  // 只有基本量設定是護理長專用，護理師身分時分頁變淡提示
  document.getElementById('tab-settings').classList.toggle('locked',!isHead());
}
/* 護理師身分點到護理長功能時顯示的畫面 */
function lockedView(title,desc){
  return `<h1 class="page">${title}</h1>
    <div class="lockbox">${IC.lock}
      <h3>這是護理長的功能</h3>
      <p>${desc}</p>
      <button class="submit" data-act="role-head">切換成護理長試用</button>
      <p class="note">${TRIAL_NOTE}</p>
    </div>`;
}

/* ===== 首頁：本班要點哪幾張 ===== */
function homeSlot(f){
  const today=ymd(new Date()), cs=curShift().id;
  if(f.freq==='monthly'){
    if(dueDay(f,today))return {date:today,sid:'D'};
    return null;
  }
  return {date:today,sid:f.shifts.includes(cs)?cs:'D'};
}
function monthlyInfo(f){
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
  const thisFS=ymd(new Date(y,m,firstSunday(y,m)));
  const r=rec(f.id,thisFS,'D');
  const nx=new Date(y,m+1,firstSunday(y,m+1));
  const last=r?`本月 ${md(thisFS)} ${r.st==='abn'?'有異常':'已完成'}`:`本月 ${md(thisFS)} ${pymd(thisFS)<now?'未點':'還沒到'}`;
  return {txt:`${last}・下次 ${md(ymd(nx))}`, st:r?r.st:(pymd(thisFS)<now?'miss':'future'), date:thisFS};
}
/* 一張表「這一班」的狀態：清單和平面圖都用這個，兩邊顯示的永遠一致 */
function formNow(f){
  const sl=homeSlot(f);
  if(!sl){const mi=monthlyInfo(f);
    return {st:mi.st==='future'?'na':mi.st, sub:mi.txt, pill:mi.st==='future'?'下個月':ST_TXT[mi.st],
      attrs:`data-act="open" data-f="${f.id}" data-d="${mi.date}" data-s="D"`};}
  const st=slotStatus(f,sl.date,sl.sid), r=rec(f.id,sl.date,sl.sid);
  let sub=`${f.when}・${SH[sl.sid].name}`;
  if(r) sub=`${esc(r.who)} ${r.t} 點${r.st==='abn'?`・${r.abn.length} 項異常`:''}`;
  if(st==='future') sub+=`・${pad(SH[sl.sid].start)}:00 開始`;
  // 還沒送出、但有別人正在點：清單和平面圖都改成「某某正在點」
  const busy=r?null:busyBy(f.id,sl.date,sl.sid);
  if(busy) return {st, busy:true, sub:`${esc(busy.who)} 正在點（${busy.min?busy.min+' 分鐘前開始':'剛開始'}）`, pill:'有人在點',
    attrs:`data-act="open" data-f="${f.id}" data-d="${sl.date}" data-s="${sl.sid}"`};
  return {st, sub, pill:ST_TXT[st], attrs:`data-act="open" data-f="${f.id}" data-d="${sl.date}" data-s="${sl.sid}"`};
}
function homeView(){
  const cs=curShift(); const today=ymd(new Date());
  const pending=FORMS.filter(f=>{const sl=homeSlot(f);return sl&&['now','miss'].includes(slotStatus(f,sl.date,sl.sid));}).length;
  const missMonth=monthSlots().filter(x=>x.st==='miss').length;
  const body=HOMEMODE==='map'
    ?floorHTML({pos:S.pos,editing:FLOOR.edit,zoom:FLOOR.zoom,head:isHead(),statusOf:formNow,note:TRIAL_NOTE})
    :`<div class="list">${FORMS.map(f=>{const n=formNow(f);return frow(f,n.sub,n.busy?'busy':n.st,n.attrs,n.pill);}).join('')}</div>`;
  return `
    <h1 class="page">本班點班</h1>
    <p class="lede">${cs.name}（${cs.code}）・點一張表開始，數量正常按「全部符合」就好</p>
    <div class="demo">${IC.info}<div><b>試用版・大家共用</b>：每個人看到的是同一份紀錄，有人送出其他人馬上看得到。紀錄是示範資料，請勿輸入真實病人資料。<br>右上角可以切換「護理師／護理長」。${TRIAL_NOTE}</div></div>
    ${missMonth?`<div class="alert">${IC.warn}本月有 ${missMonth} 次逾時未點<button data-tab="overview">看總覽</button></div>`:''}
    <button class="scanbtn" data-act="scan">${IC.qr}<span><b>掃碼點班</b><small>掃點班位置上的 QR 碼，直接進那張表</small></span></button>
    <div class="slotlabel">今天 ${md(today)}<span>${pending?`還有 ${pending} 張待點`:'本班都點完了'}</span>
      <span class="seg" role="tablist" aria-label="顯示方式">
        <button class="${HOMEMODE==='list'?'on':''}" data-act="homemode" data-m="list">清單</button>
        <button class="${HOMEMODE==='map'?'on':''}" data-act="homemode" data-m="map">平面圖</button>
      </span></div>
    ${body}`;
}
function frow(f,sub,st,attrs,pillTxt){
  const markCls={ok:'st-ok',abn:'st-abn',miss:'st-miss',now:'st-now',busy:'st-busy'}[st]||'st-miss';
  return `<button class="frow" ${attrs}>
    <span class="fmark ${markCls}">${f.mark}</span>
    <span class="fbody"><b>${f.name}</b><small>${sub}</small></span>
    <span class="pill st-${st}">${pillTxt||ST_TXT[st]}</span></button>`;
}

/* ===== 點班表單 ===== */
function openForm(fid,date,sid){
  const f=FM[fid];
  leaveForm();
  D={f:fid,d:date,s:sid,x:{},flag:null};
  // 管制藥每一種各自帳：上班結存從上一筆紀錄帶過來
  if(f.type==='ctrl')f.drugs.forEach((g,k)=>{const p=prevCtrlStock(g);D.x[k]={in:0,use:0,stock:p,prev:p,bed:'',chart:'',waste:'',note:'',ok:false};});
  // 冷藏藥：使用量每班從 0 開始（點班前沒人用就是 0），結存先帶護理長設定的結存量
  if(f.type==='cold')f.drugs.forEach((g,k)=>D.x[k]={mode:null,in:0,use:0,stock:coldStock(g),r:'',note:''});
  if(!rec(fid,date,sid)) enterForm(`${fid}_${date}_${sid}`);
  TAB='home'; render(); window.scrollTo(0,0);
}

/* ===== 誰正在點：打開還沒送出的表就登記，每分鐘更新一次；超過 3 分鐘沒更新就當作已離開 ===== */
const BY=Math.random().toString(36).slice(2,10);   // 這個分頁的代號，用來分辨「是不是我自己」
const FRESH=3*60*1000;
let ACTIVE=null, beat=null;
function enterForm(id){
  ACTIVE=id;
  const ping=()=>markActive(id,S.nurse||'有人',BY).catch(()=>{});
  ping(); beat=setInterval(ping,60*1000);
}
function leaveForm(){
  clearInterval(beat); beat=null;
  if(ACTIVE){clearActive(ACTIVE).catch(()=>{}); ACTIVE=null;}
}
/* 別人正在點這一班的這張表就回傳 {who, min}，自己或沒人點回傳 null */
function busyBy(fid,date,sid){
  const a=S.active[`${fid}_${date}_${sid}`];
  if(!a||a.by===BY||Date.now()-a.at>FRESH)return null;
  return {who:a.who,min:Math.max(0,Math.round((Date.now()-a.at)/60000))};
}
// 關掉分頁或切到別的 App 時也要清掉，免得別人一直看到「正在點」
window.addEventListener('pagehide',leaveForm);
function prevRecs(fid){return S.records.filter(r=>r.f===fid).sort((a,b)=>(a.d+SHIFTS.findIndex(s=>s.id===a.s)).localeCompare(b.d+SHIFTS.findIndex(s=>s.id===b.s)));}
/* 管制藥紀錄的每一種藥。舊紀錄只有 Dormicum 一種、直接存在 extra 裡，這裡統一轉成清單 */
function ctrlItems(r){
  const e=r&&r.extra; if(!e)return [];
  return e.items||[Object.assign({i:0,n:'Dormicum'},e)];
}
/* 這種管制藥的上班結存：找最近一筆有記到它的紀錄；從沒記過（剛新增的藥）就用常備量 */
function prevCtrlStock(g){
  const l=prevRecs('ctrl');
  for(let k=l.length-1;k>=0;k--){const it=ctrlItems(l[k]).find(x=>x.i===g.i); if(it)return it.stock;}
  return baseOf('ctrl',g.i,0,g.b);
}

function formView(){
  const f=FM[D.f], r=rec(D.f,D.d,D.s);
  const head=`<div class="fhead"><div class="fhead-row">
      <button class="back" data-act="back" aria-label="回本班列表">${IC.back}</button>
      <h2>${f.name}</h2>
      ${!r&&f.type!=='ctrl'?`<button class="allok" data-act="allok">${IC.check}全部符合</button>`:''}
    </div>
    <div class="prog"><span>${md(D.d)} ${SH[D.s].name} <span class="num">${SH[D.s].code}</span></span>${r?'':'<div class="bar"><i id="pbar" style="width:0"></i></div><span class="num" id="ptxt"></span>'}</div></div>`;
  if(r) return head+doneView(f,r);
  const busy=busyBy(D.f,D.d,D.s);
  const warn=busy?`<div class="alert busy">${IC.warn}<span><b>${esc(busy.who)}</b> ${busy.min?busy.min+' 分鐘前':'剛剛'}開始點這張表了。請先跟對方確認，避免重複點班。</span><button data-act="back">先不點</button></div>`:'';
  const body={count:countBody,check:checkBody,cold:coldBody,ctrl:ctrlBody}[f.type](f);
  return head+warn+body;
}
function doneView(f,r){
  const list=r.abn.length?`<ul class="abnlist">${r.abn.map(abnLi).join('')}</ul>`:`<p class="empty">全部 ${r.n} 項都符合基本量。</p>`;
  let extra='';
  if(f.type==='ctrl') extra=ctrlItems(r).filter(x=>x.use).map(x=>`<p class="empty">${esc(x.n)} 本班用 ${x.use} Amp（${esc(x.bed)} 床，病歷號 ${esc(x.chart)}，餘棄 ${esc(x.waste)} mg），領入 ${x.in} Amp，結存 ${x.stock}。</p>`).join('');
  return `<div class="done-box"><h3>${r.st==='abn'?'本班已點，有異常':'本班已點完'}</h3>
    <p class="lede" style="margin:0">${esc(r.who)} 在 ${r.t} 送出${r.late?'（補點）':''}，送出後不能改，有錯要寫在下一班。</p>${list}${extra}
    ${valsTable(r,true)}</div>`;
}

/* ===== 每一項點了多少：送出時整張表都存下來，事後可以完整回看 ===== */
/* 一列＝一個要點的數字：g 位置、l 品項、b 基本量、a 實點、x 補充說明 */
function buildVals(f){
  const out=[];
  if(f.type==='count') visItems(f,D.s).forEach(x=>{
    const bs=partBases(f,x), v=D.x[x.i].v;
    x.p.forEach((p,k)=>out.push({g:x.g,l:x.n+(p.l?'・'+p.l:''),b:String(fmtV(bs[k])),a:String(fmtV(v[k]))}));
  });
  if(f.type==='check') f.qs.forEach((q,i)=>out.push({l:q,b:'符合',a:D.x[i].v?'符合':'不符合'}));
  if(f.type==='cold') f.drugs.forEach((g,k)=>{const dx=D.x[k];
    out.push({l:g.n+' 結存',b:String(coldStock(g)),a:String(dx.stock),x:`基本 ${coldBase(g)}・領入 ${dx.in}・使用量 ${dx.use}`});});
  if(f.type==='ctrl') f.drugs.forEach((g,k)=>{const x=D.x[k];
    out.push({l:g.n+' 結存',b:String(x.prev+x.in-x.use),a:String(x.stock),x:`上班結存 ${x.prev}・領入 ${x.in}・消耗 ${x.use}`});});
  return out;
}
/* 舊紀錄沒有存每一項：用「基本量＋當時記下的異常」反推，正常的項目實點就是基本量 */
function valsOf(r){
  if(r.vals)return r.vals;
  const f=FM[r.f], ab=Object.fromEntries((r.abn||[]).map(a=>[a.l,a.a]));
  const out=[];
  if(f.type==='count') visItems(f,r.s).forEach(x=>partBases(f,x).forEach((b,k)=>{
    const l=x.n+(x.p[k].l?'・'+x.p[k].l:''), bb=String(fmtV(b));
    out.push({g:x.g,l,b:bb,a:ab[l]??bb});
  }));
  if(f.type==='check') f.qs.forEach(q=>out.push({l:q,b:'符合',a:ab[q]??'符合'}));
  // 舊紀錄的冷藏藥照當時內建順序存，代號就是位置；新增的藥一定有 vals，不會走到這裡
  if(f.type==='cold'&&r.extra) f.drugs.filter(g=>g.i<ADD_FROM&&r.extra.stock[g.i]!==undefined).forEach(g=>
    out.push({l:g.n+' 結存',b:String(coldStock(g)),a:String(r.extra.stock[g.i]),x:`使用量 ${r.extra.use[g.i]}`}));
  if(f.type==='ctrl') ctrlItems(r).forEach(x=>{const g=drugOf(f,x.i);
    out.push({l:x.n+' 結存',b:String(g?baseOf('ctrl',g.i,0,g.b):x.stock),a:String(x.stock),x:`領入 ${x.in}・消耗 ${x.use}`});});
  return out;
}
/* 像紙本一樣的「品項｜基本量｜實點」表，不符合的列標紅；open＝一打開就展開 */
function valsTable(r,open){
  const rows=valsOf(r); if(!rows.length)return '';
  let lastG='';
  const body=rows.map(v=>{
    const g=v.g&&v.g!==lastG?`<tr class="vg"><td colspan="3">${esc(v.g)}</td></tr>`:''; if(v.g)lastG=v.g;
    const bad=v.a!==v.b;
    return `${g}<tr class="${bad?'bad':''}"><td>${esc(v.l)}${v.x?`<small>${esc(v.x)}</small>`:''}</td><td class="num">${esc(v.b)}</td><td class="num">${esc(v.a)}</td></tr>`;
  }).join('');
  return `<details class="vals"${open?' open':''}><summary>這次點的數量（${rows.length} 項）</summary>
    <div class="valswrap"><table><thead><tr><th>品項</th><th>基本量</th><th>實點</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
}
function abnLi(a){return `<li><b>${esc(a.l)}</b>　基本 <span class="num">${esc(a.b)}</span> → 實點 <span class="num">${esc(a.a)}</span>${a.r||a.note?`<small>${esc(a.r)}${a.r&&a.note?'・':''}${esc(a.note)}</small>`:''}</li>`;}

/* --- 計數型（急救車、儀器、月點班） --- */
function countBody(f){
  const vis=visItems(f,D.s);
  return f.groups.map(g=>{
    const items=vis.filter(x=>x.g===g.pos); if(!items.length)return '';
    return `<section class="grp"><h3>${g.pos}<span>${items.length} 項</span></h3><div class="items">${items.map(x=>itemHTML(f,x)).join('')}</div></section>`;
  }).join('');
}
function isAbnCount(f,x,dx){const bs=partBases(f,x);return dx.v.some((v,k)=>v!==bs[k]);}
function itemHTML(f,x){
  const dx=D.x[x.i]||{}, bs=partBases(f,x), abn=dx.mode&&isAbnCount(f,x,dx);
  const cls=['item']; if(dx.mode)cls.push(abn?'is-bad':'is-ok'); if(D.flag===x.i)cls.push('is-flag');
  let h=`<div class="${cls.join(' ')}" data-item="${x.i}">
    <div class="irow"><div class="iname${x.d?' drug':''}">${esc(x.n)}${x.night?'<span class="tag">大夜點</span>':''}</div><div class="ibase num">${fmtBases(bs)}</div></div>
    <div class="iact"><button class="b-ok${dx.mode==='ok'?' on':''}" data-act="ok" data-i="${x.i}">${IC.check}符合</button>
    <button class="b-edit${dx.mode==='edit'?' on':''}" data-act="edit" data-i="${x.i}">數量不符</button></div>`;
  if(dx.mode==='edit'){
    h+=`<div class="parts">${x.p.map((p,k)=>partHTML(x.i,k,p,bs[k],dx.v[k])).join('')}</div>`;
    h+=abn?reasonHTML(x.i,dx):`<div class="hint">數量跟基本量一樣，會算符合</div>`;
  }
  return h+'</div>';
}
function partHTML(i,k,p,b,v){
  const lab=`<label><span>${esc(p.l||'數量')}</span><span class="num">基本 ${b==='ok'?'ok':b==='amt'?'適量':b}</span></label>`;
  if(b==='ok'||b==='amt'){
    const [g,bad]=b==='ok'?['ok','bad']:['amt','low'];
    return `<div class="part">${lab}<div class="tog">
      <button class="${v===g?'on':''}" data-act="tog" data-i="${i}" data-k="${k}" data-v="${g}">${fmtV(g)}</button>
      <button class="${v===bad?'on bad':''}" data-act="tog" data-i="${i}" data-k="${k}" data-v="${bad}">${fmtV(bad)}</button></div></div>`;
  }
  return `<div class="part">${lab}${stepper(i,k,v,v!==b)}</div>`;
}
function stepper(i,k,v,diff){
  return `<div class="step"><button data-act="step" data-i="${i}" data-k="${k}" data-dir="-1" aria-label="減一">−</button>
    <span class="num${diff?' diff':''}">${v}</span>
    <button data-act="step" data-i="${i}" data-k="${k}" data-dir="1" aria-label="加一">＋</button></div>`;
}
function reasonHTML(i,dx){
  return `<div class="reason"><div class="lab">原因（必填）</div>
    <div class="chips">${REASONS.map(r=>`<button class="${dx.r===r?'on':''}" data-act="reason" data-i="${i}" data-r="${r}">${r}</button>`).join('')}</div>
    <input class="field" id="note-${D.f}-${i}" data-in="note" data-i="${i}" value="${esc(dx.note)}" placeholder="床號或去向，例：12 床借用、已報修"></div>`;
}

/* --- 查核型（冰箱） --- */
function checkBody(f){
  return `<section class="grp"><h3>查核項目<span>${f.qs.length} 題</span></h3><div class="items">${f.qs.map((q,i)=>checkHTML(q,i)).join('')}</div></section>`;
}
function checkHTML(q,i){
  const dx=D.x[i]||{};
  const cls=['item']; if(dx.v===true)cls.push('is-ok'); if(dx.v===false)cls.push('is-bad'); if(D.flag===i)cls.push('is-flag');
  return `<div class="${cls.join(' ')}" data-item="${i}"><div class="irow"><div class="iname">${i+1}. ${esc(q)}</div></div>
    <div class="iact"><button class="b-ok${dx.v===true?' on':''}" data-act="chk" data-i="${i}" data-v="1">${IC.check}符合</button>
    <button class="b-no${dx.v===false?' on':''}" data-act="chk" data-i="${i}" data-v="0">不符合</button></div>
    ${dx.v===false?`<div class="reason"><div class="lab">怎麼處理（必填）</div><input class="field" id="note-fridge-${i}" data-in="note" data-i="${i}" value="${esc(dx.note)}" placeholder="例：溫度 9°C，已通知工務、藥品移到備用冰箱"></div>`:''}</div>`;
}

/* --- 冷藏藥品 --- */
function coldBody(f){
  return `<section class="grp"><h3>冷藏藥品<span>使用量 0 也正常・結存量要等於設定量</span></h3><div class="items">${f.drugs.map((g,i)=>coldHTML(f,g,i)).join('')}</div></section>`;
}
/* i 是這張表裡的位置（D.x 用位置存），g.i 是藥的固定代號（設定用代號存） */
function coldHTML(f,g,i){
  const dx=D.x[i], s=coldStock(g), abn=dx.mode&&dx.stock!==s;
  const cls=['item']; if(dx.mode)cls.push(abn?'is-bad':'is-ok'); if(D.flag===i)cls.push('is-flag');
  let h=`<div class="${cls.join(' ')}" data-item="${i}">
    <div class="irow"><div class="iname drug">${esc(g.n)} <span class="num" style="font-weight:400;color:var(--muted);font-size:12.5px">${esc(g.spec)}</span></div><div class="ibase num">結存要 ${s}</div></div>
    <div class="iact"><button class="b-ok${dx.mode==='ok'?' on':''}" data-act="ok" data-i="${i}">${IC.check}沒人用，數量對</button>
    <button class="b-edit${dx.mode==='edit'?' on':''}" data-act="edit" data-i="${i}">填使用量／結存</button></div>`;
  if(dx.mode==='edit'){
    h+=`<div class="parts">
      <div class="part"><label><span>領入</span></label>${stepper(i,'in',dx.in,false)}</div>
      <div class="part"><label><span>使用量</span><span class="num">0 也正常</span></label>${stepper(i,'use',dx.use,false)}</div>
      <div class="part"><label><span>結存量</span><span class="num">要 ${s}</span></label>${stepper(i,'stock',dx.stock,dx.stock!==s)}</div></div>`;
    h+=abn?reasonHTML(i,dx):`<div class="hint">結存量跟設定一樣，會算符合</div>`;
  } else if(dx.mode==='ok'){
    h+=`<div class="hint">使用量 ${dx.use}・結存量 ${dx.stock}</div>`;
  }
  return h+'</div>';
}

/* --- 管制藥品：每一種藥各一張卡、各自算帳 --- */
function ctrlBody(f){
  if(!f.drugs.length)return '<p class="empty">管制藥清單是空的，請護理長到基本量設定新增。</p>';
  return `<div class="cards">${f.drugs.map((g,k)=>ctrlCard(f,g,k)).join('')}</div>`;
}
function ctrlCard(f,g,k){
  const dx=D.x[k], b=baseOf('ctrl',g.i,0,g.b), expect=dx.prev+dx.in-dx.use;
  const bad=dx.stock!==expect, low=dx.stock!==b;
  const cls=['dcard']; if(dx.ok)cls.push(bad||low?'is-bad':'is-ok'); if(D.flag===k)cls.push('is-flag');
  return `<div class="${cls.join(' ')}" data-item="${k}">
    <h4>${esc(g.n)} <small class="num">${esc(g.spec)}・常備 ${b} Amp</small></h4>
    <div class="calc">
      <div><small>上班結存</small><b>${dx.prev}</b></div>
      <div><small>＋領入</small><b>${dx.in}</b></div>
      <div><small>－消耗</small><b>${dx.use}</b></div>
      <div class="${bad?'bad':''}"><small>應有</small><b>${expect}</b></div>
    </div>
    <div class="parts">
      <div class="part"><label><span>領入（Amp）</span></label>${stepper(k,'in',dx.in,false)}</div>
      <div class="part"><label><span>消耗（Amp）</span></label>${stepper(k,'use',dx.use,false)}</div>
      <div class="part"><label><span>實際清點結存</span><span class="num">應有 ${expect}</span></label>${stepper(k,'stock',dx.stock,bad)}</div>
    </div>
    ${dx.use>0?`<div class="row2">
      <input class="field" id="c-bed-${k}" data-in="bed" data-i="${k}" value="${esc(dx.bed)}" placeholder="床號（必填）">
      <input class="field" id="c-chart-${k}" data-in="chart" data-i="${k}" value="${esc(dx.chart)}" placeholder="病歷號（必填）">
      <input class="field" id="c-waste-${k}" data-in="waste" data-i="${k}" value="${esc(dx.waste)}" placeholder="餘棄量 mg（必填）" inputmode="decimal"></div>
      <div class="privacy">試用版請填假資料，例：床號 12、病歷號 DEMO-0001</div>`:''}
    ${bad?`<div class="reason"><div class="lab">結存跟帳對不上：應有 ${expect}，實點 ${dx.stock}。請重新清點，或寫說明（必填）</div>
      <input class="field" id="c-note-${k}" data-in="note" data-i="${k}" value="${esc(dx.note)}" placeholder="例：已重新清點，已通報護理長"></div>`:''}
    ${!bad&&low?`<div class="hint" style="color:var(--warn)">結存 ${dx.stock}，低於常備 ${b}，送出後會列為「已用待補」</div>`:''}
    <div class="iact"><button class="b-ok${dx.ok?' on':''}" data-act="cfm" data-i="${k}">${IC.check}${dx.ok?'已清點確認':'我已清點，數量如上'}</button></div>
  </div>`;
}

/* ===== 驗證：哪些還沒點、哪些沒寫原因 ===== */
function validate(){
  const f=FM[D.f]; let total=0, done=0; const miss=[], need=[];
  if(f.type==='count') visItems(f,D.s).forEach(x=>{
    total++; const dx=D.x[x.i]; if(!dx||!dx.mode){miss.push(x.i);return;} done++;
    if(isAbnCount(f,x,dx)&&(!dx.r||!dx.note.trim()))need.push(x.i);
  });
  if(f.type==='check') f.qs.forEach((q,i)=>{
    total++; const dx=D.x[i]; if(!dx||dx.v===undefined){miss.push(i);return;} done++;
    if(dx.v===false&&!(dx.note||'').trim())need.push(i);
  });
  if(f.type==='cold') f.drugs.forEach((g,i)=>{
    total++; const dx=D.x[i]; if(!dx.mode){miss.push(i);return;} done++;
    if(dx.stock!==coldStock(g)&&(!dx.r||!dx.note.trim()))need.push(i);
  });
  if(f.type==='ctrl') f.drugs.forEach((g,k)=>{
    total++; const dx=D.x[k]; if(dx.ok)done++; else miss.push(k);
    const expect=dx.prev+dx.in-dx.use;
    const noPatient=dx.use>0&&(!dx.bed.trim()||!dx.chart.trim()||!dx.waste.trim());
    const noNote=dx.stock!==expect&&!dx.note.trim();
    if(noPatient||noNote)need.push(k);
  });
  return {total,done,miss,need};
}
function updateFoot(){
  const v=validate();
  const pb=document.getElementById('pbar'), pt=document.getElementById('ptxt');
  if(pb)pb.style.width=(v.total?v.done/v.total*100:0)+'%';
  if(pt)pt.textContent=`${v.done}/${v.total}`;
  let msg=v.miss.length?`還有 ${v.miss.length} 項沒點`:'';
  if(v.need.length)msg+=(msg?'、':'')+`${v.need.length} 項要寫原因`;
  document.getElementById('foot').innerHTML=`<div class="foot"><div class="foot-in">
    <span class="msg${msg?' bad':''}">${msg||'都點完了，可以送出'}</span>
    <button class="submit" data-act="submit">送出</button></div></div>`;
}
function rerenderItem(i){
  const f=FM[D.f], el=document.querySelector(`[data-item="${i}"]`); if(!el)return;
  let h;
  if(f.type==='count')h=itemHTML(f,itemOf(f,i));
  if(f.type==='check')h=checkHTML(f.qs[i],i);
  if(f.type==='cold')h=coldHTML(f,f.drugs[i],i);
  if(f.type==='ctrl')h=ctrlCard(f,f.drugs[i],i);
  el.outerHTML=h; updateFoot();
}

/* ===== 送出 ===== */
async function submitForm(){
  if(!S.nurse){openPicker(submitForm);return;}
  const v=validate();
  if(v.miss.length||v.need.length){
    const first=(v.miss.length?v.miss:v.need)[0]; D.flag=first; rerenderItem(first);
    const el=document.querySelector(`[data-item="${first}"]`); if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
    toast(v.miss.length?`還有 ${v.miss.length} 項沒點，紅框是第一項`:'異常項目要選原因、寫床號或去向');
    return;
  }
  const f=FM[D.f], now=new Date();
  const r={f:D.f,d:D.d,s:D.s,who:S.nurse,t:hm(now),abn:buildAbn(f),n:v.total,vals:buildVals(f)};
  if(slotRange(D.d,D.s)[1]<now)r.late=true;
  if(f.type==='cold')r.extra={use:f.drugs.map((g,i)=>D.x[i].use),stock:f.drugs.map((g,i)=>D.x[i].stock)};
  // 管制藥每種藥一筆，記代號和名字，之後藥被刪掉、改名，舊紀錄還看得懂
  if(f.type==='ctrl')r.extra={items:f.drugs.map((g,k)=>{const x=D.x[k];return {i:g.i,n:g.n,in:x.in,use:x.use,stock:x.stock,bed:x.bed,chart:x.chart,waste:x.waste};})};
  r.st=r.abn.length?'abn':'ok';
  if(rec(r.f,r.d,r.s)){toast('這一班剛剛已經有人送出了，請回列表看');D=null;render();return;}
  const keep=D; S.records.push(r); D=null; render(); window.scrollTo(0,0);
  const ok=await persistRecord(r);
  if(!ok){S.records=S.records.filter(x=>x!==r); D=keep; render(); return;}
  leaveForm();
  toast(`已送出：${f.name}（${SH[r.s].name}）${r.abn.length?`，${r.abn.length} 項異常已通知護理長`:''}`);
}
function buildAbn(f){
  const out=[];
  if(f.type==='count') visItems(f,D.s).forEach(x=>{
    const dx=D.x[x.i]; if(dx.mode!=='edit')return; const bs=partBases(f,x);
    x.p.forEach((p,k)=>{ if(dx.v[k]!==bs[k]) out.push({l:x.n+(p.l?'・'+p.l:''),b:String(fmtV(bs[k])),a:String(fmtV(dx.v[k])),r:dx.r,note:dx.note.trim()}); });
  });
  if(f.type==='check') f.qs.forEach((q,i)=>{const dx=D.x[i]; if(dx.v===false)out.push({l:q,b:'符合',a:'不符合',r:'',note:dx.note.trim()});});
  if(f.type==='cold') f.drugs.forEach((g,i)=>{const dx=D.x[i], s=coldStock(g); if(dx.stock!==s)out.push({l:g.n+' 結存',b:String(s),a:String(dx.stock),r:dx.r,note:dx.note.trim()});});
  if(f.type==='ctrl') f.drugs.forEach((g,k)=>{
    const x=D.x[k], b=baseOf('ctrl',g.i,0,g.b), expect=x.prev+x.in-x.use;
    if(x.stock!==expect) out.push({l:`${g.n} 結存與帳不符`,b:String(expect),a:String(x.stock),r:'',note:x.note.trim()});
    else if(x.stock!==b) out.push({l:`${g.n} 低於常備量`,b:String(b),a:String(x.stock),r:'已用待補',note:x.use?`本班用 ${x.use} Amp（${x.bed} 床）`:''});
  });
  return out;
}

/* ===== 點班總覽（所有人都能看）：跟紙本一樣的月格子 ===== */
function monthDays(){const n=new Date();const last=new Date(n.getFullYear(),n.getMonth()+1,0).getDate();return Array.from({length:last},(_,i)=>ymd(new Date(n.getFullYear(),n.getMonth(),i+1)));}
function monthSlots(fid){
  const out=[];
  monthDays().forEach(d=>FORMS.forEach(f=>{ if(fid&&f.id!==fid)return; f.shifts.forEach(s=>{const st=slotStatus(f,d,s); if(st!=='na')out.push({f:f.id,d,s,st});}); }));
  return out;
}
function worst(list){for(const s of ['miss','abn','now','ok','future'])if(list.includes(s))return s;return 'na';}
function overviewView(){
  const fid=O.flt==='all'?null:O.flt, sl=monthSlots(fid);
  const cnt=s=>sl.filter(x=>x.st===s).length;
  const due=cnt('ok')+cnt('abn')+cnt('miss');
  const n=new Date();
  const chips=`<div class="fchips"><button class="${O.flt==='all'?'on':''}" data-act="flt" data-f="all">全部表單</button>${FORMS.map(f=>`<button class="${O.flt===f.id?'on':''}" data-act="flt" data-f="${f.id}">${f.short}</button>`).join('')}</div>`;
  return `<h1 class="page">${n.getFullYear()-1911} 年 ${n.getMonth()+1} 月 點班總覽</h1>
    <p class="lede">綠色正常、紅色異常、灰色沒人點。點格子看是誰點的、哪裡不對。</p>
    <div class="stats">
      <div class="stat ok"><small>完成率</small><b>${due?Math.round((cnt('ok')+cnt('abn'))/due*100):0}%</b></div>
      <div class="stat"><small>已點</small><b>${cnt('ok')+cnt('abn')}</b></div>
      <div class="stat bad"><small>異常</small><b>${cnt('abn')}</b></div>
      <div class="stat miss"><small>逾時未點</small><b>${cnt('miss')}</b></div>
    </div>
    ${chips}
    <div class="legend"><span><i class="st-ok"></i>✓ 正常</span><span><i class="st-abn"></i>! 異常</span><span><i class="st-miss"></i>未 沒人點</span><span><i class="st-now"></i>… 本班進行中</span></div>
    <div class="gridwrap">${gridHTML(fid)}</div>
    ${O.sel?detailPanel():''}
    <div class="sec">本月異常紀錄</div>
    ${abnRecords(fid)}`;
}
function gridHTML(fid){
  const cols=fid?FM[fid].shifts.map(s=>({f:fid,s,h:`${SH[s].name}<br><span class="num">${SH[s].code}</span>`})):FORMS.map(f=>({f:f.id,h:f.short}));
  const today=ymd(new Date());
  const days=fid&&FM[fid].freq==='monthly'?monthDays().filter(d=>dueDay(FM[fid],d)):monthDays();
  const rows=days.map(d=>{
    const dt=pymd(d), cls=[dt.getDay()===0?'sun':'', d===today?'today':'', d>today?'fut':''].join(' ');
    const tds=cols.map(c=>{
      const f=FM[c.f];
      const st=c.s?slotStatus(f,d,c.s):worst(f.shifts.map(s=>slotStatus(f,d,s)));
      const sel=O.sel&&O.sel.d===d&&O.sel.f===c.f&&(!c.s||O.sel.s===c.s);
      const clickable=!['na','future'].includes(st);
      return `<td><button class="cell st-${st}${sel?' sel':''}" ${clickable?`data-act="cell" data-d="${d}" data-f="${c.f}" data-s="${c.s||''}"`:'tabindex="-1"'} aria-label="${d} ${f.name} ${ST_TXT[st]}">${ST_CELL[st]}</button></td>`;
    }).join('');
    return `<tr class="${cls}"><td class="d">${dt.getMonth()+1}/${pad(dt.getDate())}<em>${WD[dt.getDay()]}</em></td>${tds}</tr>`;
  }).join('');
  return `<table class="grid"><thead><tr><th style="text-align:left;padding-left:10px">日期</th>${cols.map(c=>`<th>${c.h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}
function detailPanel(){
  const {d,f:fid}=O.sel, f=FM[fid];
  const shifts=O.sel.s?[O.sel.s]:f.shifts;
  const parts=shifts.filter(s=>dueDay(f,d)).map(s=>{
    const r=rec(fid,d,s), st=slotStatus(f,d,s);
    if(!r) return `<div class="dcard"><h4>${SH[s].name} <small>${ST_TXT[st]}</small></h4>${st==='miss'?'<p class="empty">這班沒有人點班，系統已在班別結束時通知護理長。</p>':''}</div>`;
    return `<div class="dcard ${r.st==='abn'?'is-bad':'is-ok'}"><h4>${SH[s].name} <small>${esc(r.who)}・${r.t}${r.late?'・補點':''}</small></h4>
      ${r.abn.length?`<ul class="abnlist">${r.abn.map(abnLi).join('')}</ul>`:`<p class="empty">全部 ${r.n} 項符合。</p>`}
      ${valsTable(r,false)}</div>`;
  }).join('');
  return `<div class="panel"><h3>${md(d)}　${f.name}</h3><div class="cards" style="margin-top:6px">${parts}</div></div>`;
}
function abnRecords(fid){
  const days=monthDays();
  const list=S.records.filter(r=>r.st==='abn'&&days.includes(r.d)&&(!fid||r.f===fid)).sort((a,b)=>b.d.localeCompare(a.d));
  if(!list.length)return '<p class="empty">本月沒有異常。</p>';
  return `<div class="cards" style="margin-top:0">${list.map(r=>`<div class="dcard is-bad"><h4>${md(r.d)} ${FM[r.f].name}<small>${SH[r.s].name}・${esc(r.who)} ${r.t}</small></h4><ul class="abnlist">${r.abn.map(abnLi).join('')}</ul></div>`).join('')}</div>`;
}

/* ===== 基本量設定：改一次，所有班別同步 ===== */
function settingsView(){
  const opts=FORMS;
  const f=FM[SF];
  const spec=s=>s?` <span class="num" style="color:var(--muted);font-size:12.5px">${esc(s)}</span>`:'';
  let rows='';
  if(f.type==='count') rows=f.flat.map(x=>setRow(f,x.i,esc(x.n)+(x.night?'<span class="tag">大夜點</span>':'')+(x.added?'<span class="tag">新增</span>':''),
    x.p.map((p,k)=>setInput(f.id,x.i,k,p)).join(''))).join('');
  if(f.type==='cold') rows=f.drugs.map(g=>setRow(f,g.i,esc(g.n)+spec(g.spec),
    setInput('cold',g.i,0,{l:'基本量',b:g.b})+setInput('cold',g.i,'s',{l:'結存量（正常數量）',b:COLD_STOCK_DEF}))).join('');
  if(f.type==='ctrl') rows=f.drugs.map(g=>setRow(f,g.i,esc(g.n)+spec(g.spec),setInput('ctrl',g.i,0,{l:'常備量',b:g.b}))).join('');
  if(f.type==='check') rows=f.qs.map((q,k)=>setRow(f,f.qsI[k],`${k+1}. ${esc(q)}`,'')).join('');
  const log=S.baseLog.length?`<ul class="log">${S.baseLog.slice().reverse().map(logLi).join('')}</ul>`:'<p class="empty">還沒有人改過基本量。</p>';
  return `<h1 class="page">基本量設定</h1>
    <p class="lede">紙本改基本量要拿紅筆劃，表頭沒改下個月照樣印錯。這裡由護理長改一次，之後每一班都用新數字，而且留下誰改的。</p>
    <div class="adminbar ok">${IC.check}<span>你現在是<b>護理長</b>身分，可以修改備品數量。${TRIAL_NOTE}</span></div>
    <div class="fchips">${opts.map(o=>`<button class="${SF===o.id?'on':''}" data-act="sform" data-f="${o.id}">${o.short}</button>`).join('')}</div>
    ${f.type==='cold'?`<p class="note setnote">冷藏藥點班時，<b>結存量要等於這裡設定的「結存量（正常數量）」</b>才算正常，預設 1；使用量 0 也正常。</p>`:''}
    ${itemAddHTML(f)}
    <div class="setlist">${rows||'<p class="empty">這張表目前沒有品項。</p>'}</div>
    ${hiddenHTML(f)}
    <div class="sec">修改紀錄</div>${log}
    ${nursesSetHTML()}
    <div class="sec">點班位置 QR 碼貼紙</div>
    <p class="lede">每個點班位置一張，印出來貼在急救車、冰箱、儀器櫃上。手機一掃就打開那張表，點班人會自動帶入。</p>
    <div class="rowflex"><button class="submit" data-act="qr-show">顯示 QR 貼紙</button><button class="danger" style="border-color:var(--line);color:var(--ink)" data-act="qr-print">列印</button></div>
    <div class="qrsheet" id="qrsheet">${QRHTML}</div>
    ${ownerView()}`;
}
/* ===== 品項新增／刪除（護理長）：存雲端 settings/items，大家的點班表馬上同步 ===== */
const IMAX=40;
let IDEL=null;   // 按過一次「刪除」、等待確認的品項（表單:代號）
/* 設定頁每一列：左邊名稱、右邊刪除鈕，下面是數量欄 */
function setRow(f,i,nameHTML,parts){
  const key=itemKey(f.id,i);
  const del=IDEL===key
    ?`<span class="idelc"><button class="nyes" data-act="item-del-yes" data-f="${f.id}" data-i="${i}">確定刪除</button><button class="nno" data-act="item-del-no">取消</button></span>`
    :`<button class="idel" data-act="item-del" data-f="${f.id}" data-i="${i}">刪除</button>`;
  return `<div class="setrow"><div class="nm nmrow"><span>${nameHTML}</span>${del}</div>${parts?`<div class="setparts">${parts}</div>`:''}</div>`;
}
/* 新增品項的那一列：每種表要填的欄位不同 */
function itemAddHTML(f){
  const inp=(id,ph,extra)=>`<input class="field" id="${id}" placeholder="${ph}" autocomplete="off" ${extra||''}>`;
  // 數字格有預設值，提示字會被蓋掉，所以外面包一個標題
  const num=(id,ph,v)=>`<label class="ianum" for="${id}"><span>${ph}</span><input class="field" id="${id}" type="number" min="0" inputmode="numeric" value="${v}"></label>`;
  let fields='';
  if(f.type==='count') fields=`<select class="field" id="ia-g" aria-label="位置">${f.groups.map(g=>`<option>${esc(g.pos)}</option>`).join('')}</select>`
    +inp('ia-n','品項名稱（必填）',`maxlength="${IMAX}"`)+num('ia-b','基本量',1);
  if(f.type==='cold') fields=inp('ia-n','藥名（必填）',`maxlength="${IMAX}"`)+inp('ia-spec','規格，例：100u/ml','maxlength="30"')
    +num('ia-b','基本量',1)+num('ia-s','結存量（正常數量）',COLD_STOCK_DEF);
  if(f.type==='ctrl') fields=inp('ia-n','藥名（必填）',`maxlength="${IMAX}"`)+inp('ia-spec','規格，例：5mg/Amp','maxlength="30"')+num('ia-b','常備量',1);
  if(f.type==='check') fields=inp('ia-n','查核題目（必填）',`maxlength="${IMAX*2}"`);
  return `<div class="iadd"><div class="iadd-t">新增${f.type==='check'?'題目':f.type==='count'?'品項':'藥品'}到「${f.name}」</div>
    <div class="iadd-f">${fields}<button class="submit" data-act="item-add">新增</button></div></div>`;
}
/* 刪掉的內建品項列在最下面，按「復原」就回來 */
function hiddenHTML(f){
  const list=hiddenItems(f.id,S.items); if(!list.length)return '';
  return `<div class="hiddenlist"><b>已刪除的品項</b>${list.map(x=>`<span>${esc(x.n)}<button class="linkbtn" data-act="item-restore" data-f="${f.id}" data-i="${x.i}">復原</button></span>`).join('')}</div>`;
}
function itemNames(f){return f.type==='count'?f.flat.map(x=>x.n):f.type==='check'?f.qs.slice():f.drugs.map(g=>g.n);}
function itemCount(f){return itemNames(f).length;}
/* 修改紀錄：數量改了寫「從幾改成幾」，新增刪除寫動作 */
function logLi(l){
  if(l.act)return `<li>${l.t}　${esc(l.who)} ${esc(l.act)} <b>${esc(l.l)}</b></li>`;
  return `<li>${l.t}　${esc(l.who)} 把 <b>${esc(l.l)}</b> 從 <span class="num">${l.from}</span> 改成 <span class="num">${l.to}</span></li>`;
}
function logItem(f,act,name){
  S.baseLog.push({t:`${md(ymd(new Date()))} ${hm(new Date())}`,who:(S.nurse||'未選名字')+'（護理長）',l:`${f.short}・${name}`,act});
  persistBase();
}
/* 存品項清單：先存雲端，成功才改畫面，失敗不會留下看似成功的假畫面 */
async function commitItems(cfg,ok){
  try{await saveItems(cfg); S.items=cfg; ITEMS_PENDING=true; IDEL=null; render(); ok();}
  catch(e){toast('沒有存成功，請檢查網路再按一次');}
}
function addItem(){
  if(!isHead()){toast('只有護理長能新增品項');return;}
  const f=FM[SF], val=id=>{const el=document.getElementById(id);return el?el.value.trim():'';};
  const num=(id,def)=>{const v=val(id);return v===''?def:Math.max(0,parseInt(v,10)||0);};
  const n=val('ia-n');
  if(!n){toast('名稱不能空白');return;}
  if(itemNames(f).includes(n)){toast(`「${n}」已經在這張表裡了`);return;}
  const i=Math.max(ADD_FROM-1,...S.items.add.map(a=>a.i))+1;
  const a={f:f.id,i,n:n.slice(0,f.type==='check'?IMAX*2:IMAX)};
  if(f.type==='count'){a.g=val('ia-g'); a.b=num('ia-b',1);}
  if(f.type==='cold'||f.type==='ctrl'){a.spec=val('ia-spec').slice(0,30); a.b=num('ia-b',1);}
  // 冷藏藥的結存量不是 1 才另外存，跟一般基本量放在一起
  if(f.type==='cold'){const s=num('ia-s',COLD_STOCK_DEF); if(s!==COLD_STOCK_DEF)S.base[`cold:${i}:s`]=s;}
  commitItems({hide:S.items.hide.slice(),add:S.items.add.concat(a)},()=>{logItem(f,'新增',a.n); toast(`已新增：${a.n}`);});
}
function delItem(fid,i){
  const f=FM[fid], key=itemKey(fid,i);
  if(itemCount(f)<=1){toast('每張表至少要留一項');IDEL=null;render();return;}
  const name=f.type==='count'?itemOf(f,i).n:f.type==='check'?f.qs[f.qsI.indexOf(+i)]:drugOf(f,i).n;
  const cfg=+i>=ADD_FROM
    ?{hide:S.items.hide.slice(),add:S.items.add.filter(a=>!(a.f===fid&&a.i===+i))}
    :{hide:S.items.hide.concat(key),add:S.items.add.slice()};
  commitItems(cfg,()=>{logItem(f,'刪除',name); toast(`已刪除：${name}（以前的點班紀錄會保留）`);});
}
function restoreItem(fid,i){
  const f=FM[fid], key=itemKey(fid,i), x=hiddenItems(fid,S.items).find(v=>v.i===+i);
  commitItems({hide:S.items.hide.filter(k=>k!==key),add:S.items.add.slice()},()=>{logItem(f,'復原',x?x.n:''); toast(`已復原：${x?x.n:''}`);});
}

/* ===== 點班人員名單（護理長）：新增、改名、移除，存雲端，大家的「選點班人」馬上同步 ===== */
const NMAX=20;
let NDEL=null;   // 按過一次「移除」、等待確認的那一位
/* 雲端名單還沒載入時先用預設名單，選名字的畫面才不會是空的 */
function nurseList(){return S.nurses.length?S.nurses:DEFAULT_NURSES.map(([n,t],i)=>({id:'',n,t,at:i}));}
function nursesSetHTML(){
  const rows=S.nurses.map(x=>`<div class="nrow">
      <input class="field" value="${esc(x.n)}" maxlength="${NMAX}" data-nid="${x.id}" data-k="n" aria-label="名字">
      <input class="field" value="${esc(x.t)}" maxlength="${NMAX}" data-nid="${x.id}" data-k="t" placeholder="職稱或單位" aria-label="職稱或單位">
      ${NDEL===x.id
        ?`<button class="nyes" data-act="nurse-del-yes" data-id="${x.id}">確定移除</button><button class="nno" data-act="nurse-del-no">取消</button>`
        :`<button class="ndel" data-act="nurse-del" data-id="${x.id}">移除</button>`}
    </div>`).join('');
  return `<div class="sec">點班人員名單<span class="seccount">${S.nurses.length} 人</span></div>
    <p class="lede">這份名單就是大家按「選點班人」時跳出來的名字，改了所有手機馬上同步。改名不會改到以前的點班紀錄。名字最多 ${NMAX} 字。</p>
    <div class="nadd">
      <input class="field" id="na-n" maxlength="${NMAX}" placeholder="名字（必填）" autocomplete="off">
      <input class="field" id="na-t" maxlength="${NMAX}" placeholder="職稱或單位，例：碩專班1" autocomplete="off">
      <button class="submit" data-act="nurse-add">新增</button>
    </div>
    <div class="nset">${rows||'<p class="empty">名單載入中…</p>'}</div>`;
}
/* 名字的共同檢查：新增和改名都走這裡，規則只寫一份 */
function nurseNameError(n,selfId){
  if(!n)return '名字不能空白';
  if(n.length>NMAX)return `名字最多 ${NMAX} 字`;
  if(S.nurses.some(x=>x.n===n&&x.id!==selfId))return `名單裡已經有「${n}」`;
  return '';
}
async function addNurse(){
  if(!isHead()){toast('只有護理長能改點班人員');return;}
  const n=document.getElementById('na-n').value.trim(), t=document.getElementById('na-t').value.trim().slice(0,NMAX);
  const err=nurseNameError(n,null); if(err){toast(err);document.getElementById('na-n').focus();return;}
  const at=Math.max(Date.now(),...S.nurses.map(x=>x.at+1));
  try{await saveNurse(null,{n,t,at}); render(); toast(`已新增點班人員：${n}`); setTimeout(()=>{const el=document.getElementById('na-n');if(el)el.focus();},50);}
  catch(e){toast('沒有存成功，請檢查網路再按一次');}
}
async function editNurse(el){
  const x=S.nurses.find(v=>v.id===el.dataset.nid); if(!x)return;
  if(!isHead()){toast('只有護理長能改點班人員');render();return;}
  const k=el.dataset.k, v=el.value.trim().slice(0,NMAX);
  if(v===x[k])return;
  if(k==='n'){const err=nurseNameError(v,x.id); if(err){toast(err);render();return;}}
  try{await saveNurse(x.id,Object.assign({},x,{[k]:v})); toast(k==='n'?`已改名：${x.n} → ${v}`:`已更新：${x.n}`);}
  catch(e){toast('沒有存成功，請檢查網路再改一次');render();}
}
async function delNurse(id){
  const x=S.nurses.find(v=>v.id===id); NDEL=null; if(!x){render();return;}
  if(S.nurses.length<=1){toast('至少要留一位點班人員');render();return;}
  try{await removeNurse(id); render(); toast(`已移除：${x.n}（以前的點班紀錄會保留）`);}
  catch(e){toast('沒有移除成功，請檢查網路再試');render();}
}

/* 頁尾的擁有者區：只有專案擁有者用 Google 登入後能清掉重來，同學切成護理長也看不到這顆按鈕 */
function ownerView(){
  const u=S.user;
  if(!isOwner()){
    const who=u&&!u.isAnonymous?`<b>${esc(u.email)}</b> 不是專案擁有者。<button class="linkbtn" data-act="logout">登出</button>`:`專案擁有者登入後可以清掉試用紀錄重來。<button class="linkbtn" data-act="login">擁有者登入</button>`;
    return `<p class="ownerline">${who}</p>`;
  }
  return `<div class="sec">試用資料（擁有者）</div>
    <p class="ownerline">已用 <b>${esc(u.email)}</b> 登入。<button class="linkbtn" data-act="logout">登出</button></p>
    ${RESET?`<div class="confirm">確定清掉雲端上所有人的點班紀錄和基本量修改，回到示範資料？這個動作不能復原。<button class="yes" data-act="reset-yes">確定清掉</button><button class="no" data-act="reset-no">取消</button></div>`
      :`<button class="danger" data-act="reset">清掉重來，放回示範資料</button>`}`;
}
function setInput(fid,i,k,p){
  if(typeof p.b!=='number')return `<label>${esc(p.l||'')} <span class="num">${p.b==='ok'?'功能 ok':'適量'}</span></label>`;
  const v=baseOf(fid,i,k,p.b), ch=v!==p.b;
  return `<label for="b-${fid}-${i}-${k}">${esc(p.l||'數量')}<input id="b-${fid}-${i}-${k}" class="${ch?'changed':''}" type="number" min="0" inputmode="numeric" value="${v}" data-base="${fid}:${i}:${k}" data-def="${p.b}"></label>`;
}
function changeBase(el){
  if(!isHead()){toast('只有護理長能改基本量，請先切換成護理長');render();return;}
  const key=el.dataset.base, [fid,i,k]=key.split(':'), def=Number(el.dataset.def);
  // 代號、欄位照字串用（冷藏藥結存量的欄位是 's'），跟 baseOf 組出來的鍵一模一樣
  const to=Math.max(0,parseInt(el.value,10)||0), from=baseOf(fid,i,k,def);
  if(to===from)return;
  if(to===def)delete S.base[key]; else S.base[key]=to;
  const f=FM[fid], x=f.type==='count'?itemOf(f,i):null, g=x?null:drugOf(f,i);
  let l=x?x.n+(x.p[k].l?'・'+x.p[k].l:''):g?g.n+(f.type==='cold'?(k==='s'?'・結存量':'・基本量'):'・常備量'):'';
  S.baseLog.push({t:`${md(ymd(new Date()))} ${hm(new Date())}`,who:(S.nurse||'未選名字')+'（護理長）',l:`${f.short}・${l}`,from,to});
  persistBase(); render(); toast(`已更新基本量：${l} → ${to}`);
}

/* ===== 用表單代號直接打開「這一班」的那張表：QR 碼、掃碼、網址 #f-cart 都走這裡 ===== */
function goForm(fid){
  const f=FM[fid]; if(!f)return;
  const sl=homeSlot(f)||{date:monthlyInfo(f).date,sid:'D'};
  TAB='home'; FLOOR.edit=false;
  ACT.open({dataset:{f:fid,d:sl.date,s:sl.sid}});
}
/* 網址帶 #f-代號（貼紙 QR）：資料載入後開表，再把網址的 # 清掉，避免重新整理又跳一次 */
function routeFromHash(){
  const fid=fidFrom(location.hash); if(!fid||!LOADED)return;
  history.replaceState(null,'',location.pathname+location.search);
  goForm(fid);
}
window.addEventListener('hashchange',routeFromHash);

/* ===== 頁面上的掃碼鈕 ===== */
function openScanner(){
  const box=document.getElementById('scanner'); box.hidden=false;
  document.getElementById('scanmsg').textContent='把 QR 碼放進框框裡';
  startScan(document.getElementById('scanvideo'),text=>{
    const fid=fidFrom(text);
    if(!fid){document.getElementById('scanmsg').textContent='這不是點班位置的 QR 碼，請換一張';return;}
    closeScanner(); goForm(fid); toast(`已打開：${FM[fid].name}`);
  },err=>{
    document.getElementById('scanmsg').textContent=err==='denied'
      ?'沒有相機權限。請到瀏覽器設定允許這個網站使用相機，或直接用手機相機掃 QR 碼。'
      :'打不開相機。可以直接用手機內建的相機掃 QR 碼，一樣會進到點班表。';
  });
}
function closeScanner(){stopScan(); document.getElementById('scanner').hidden=true;}

/* ===== 使用說明 ===== */
function showGuide(){document.getElementById('guidebox').innerHTML=guideHTML(TRIAL_NOTE);}

/* ===== 切換身分：記在這台裝置，下次打開還是同一個身分 ===== */
function setRole(r){
  S.role=r; localSet(RKEY,r); D=null; render();
  toast(r==='head'?'已切換成護理長，可以改基本量、點班人員、平面圖位置':'已切換成護理師');
}

/* ===== 選點班人：打一個字就跳出符合的人 ===== */
let pickThen=null;
function openPicker(then){pickThen=then||null;const sh=document.getElementById('sheet');sh.hidden=false;const q=document.getElementById('nq');q.value='';renderNurses('');setTimeout(()=>q.focus(),50);}
function closePicker(){document.getElementById('sheet').hidden=true;pickThen=null;}
function renderNurses(q){
  q=q.trim();
  const hl=s=>q?esc(s).split(esc(q)).join(`<mark>${esc(q)}</mark>`):esc(s);
  const list=nurseList().filter(x=>!q||x.n.includes(q)||x.t.toLowerCase().includes(q.toLowerCase()));
  document.getElementById('nlist').innerHTML=list.length?list.map(x=>`<button data-nurse="${esc(x.n)}"><span>${hl(x.n)}</span><small>${hl(x.t)}</small></button>`).join(''):'<p class="empty">找不到，換個字試試</p>';
}
/* 選名字的視窗開著時名單有變動，照目前打的字重新列 */
function refreshPicker(){if(!document.getElementById('sheet').hidden)renderNurses(document.getElementById('nq').value);}

/* ===== 小提示 ===== */
let toastT;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600);}

/* ===== 點擊處理：全部集中在這裡 ===== */
const ACT={
  open:b=>{ const go=()=>openForm(b.dataset.f,b.dataset.d,b.dataset.s); const f=FM[b.dataset.f];
    if(!rec(f.id,b.dataset.d,b.dataset.s)&&slotStatus(f,b.dataset.d,b.dataset.s)==='future'){toast(`${f.name} 還沒到點班時間`);return;}
    S.nurse||rec(f.id,b.dataset.d,b.dataset.s)?go():openPicker(go); },
  back:()=>{leaveForm();D=null;render();},
  pick:()=>openPicker(()=>render()),
  ok:b=>{const f=FM[D.f],i=+b.dataset.i; D.flag=null;
    if(f.type==='count'){D.x[i]={mode:'ok',v:partBases(f,itemOf(f,i)),r:'',note:''};}
    if(f.type==='cold'){const dx=D.x[i];dx.mode='ok';dx.in=0;dx.use=0;dx.stock=coldStock(f.drugs[i]);dx.r='';dx.note='';}
    rerenderItem(i);},
  edit:b=>{const f=FM[D.f],i=+b.dataset.i; D.flag=null;
    if(f.type==='count'){const cur=D.x[i];D.x[i]={mode:'edit',v:cur&&cur.v?cur.v.slice():partBases(f,itemOf(f,i)),r:cur?cur.r:'',note:cur?cur.note:''};}
    if(f.type==='cold')D.x[i].mode='edit';
    rerenderItem(i);},
  step:b=>{const f=FM[D.f],i=+b.dataset.i,k=b.dataset.k,dir=+b.dataset.dir;
    if(f.type==='count'){const a=D.x[i].v;a[k]=Math.max(0,a[k]+dir);}
    else{const dx=D.x[i];dx[k]=Math.max(0,dx[k]+dir); if(f.type==='ctrl')dx.ok=false;}
    rerenderItem(i);},
  tog:b=>{D.x[+b.dataset.i].v[+b.dataset.k]=b.dataset.v;rerenderItem(+b.dataset.i);},
  reason:b=>{const dx=D.x[+b.dataset.i];dx.r=dx.r===b.dataset.r?'':b.dataset.r;rerenderItem(+b.dataset.i);},
  chk:b=>{const i=+b.dataset.i;D.flag=null;D.x[i]={v:b.dataset.v==='1',note:(D.x[i]||{}).note||''};rerenderItem(i);},
  cfm:b=>{const k=+b.dataset.i;D.x[k].ok=!D.x[k].ok;D.flag=null;rerenderItem(k);},
  allok:()=>{const f=FM[D.f];D.flag=null;
    if(f.type==='count')visItems(f,D.s).forEach(x=>{if(!D.x[x.i]||!D.x[x.i].mode)D.x[x.i]={mode:'ok',v:partBases(f,x),r:'',note:''};});
    if(f.type==='check')f.qs.forEach((q,i)=>{if(!D.x[i]||D.x[i].v===undefined)D.x[i]={v:true,note:''};});
    if(f.type==='cold')f.drugs.forEach((g,i)=>{const dx=D.x[i];if(!dx.mode){dx.mode='ok';dx.in=0;dx.use=0;dx.stock=coldStock(g);}});
    render(); toast('沒點過的項目都設成符合，有不對的再個別改');},
  submit:()=>submitForm(),
  flt:b=>{O.flt=b.dataset.f;O.sel=null;render();},
  cell:b=>{ if(O.flt==='all'){O.flt=b.dataset.f;O.sel={d:b.dataset.d,f:b.dataset.f,s:null};}
    else O.sel={d:b.dataset.d,f:b.dataset.f,s:b.dataset.s||null};
    render(); const p=document.querySelector('.panel'); if(p)p.scrollIntoView({behavior:'smooth',block:'nearest'}); },
  sform:b=>{SF=b.dataset.f;IDEL=null;render();},
  reset:()=>{RESET=true;render();},
  'reset-no':()=>{RESET=false;render();},
  'reset-yes':async()=>{RESET=false;render();toast('正在清掉重來…');
    try{await resetDemo(seed().records);toast('已放回示範資料');}catch(e){toast('沒有成功，只有專案擁有者能清資料');}},
  login:async()=>{try{await googleLogin();}catch(e){if(e&&e.code!=='auth/popup-closed-by-user')toast('登入沒有完成，請再試一次');}},
  logout:async()=>{await logout();toast('已登出');},
  scan:()=>openScanner(),
  'scan-close':()=>closeScanner(),
  'guide-open':()=>showGuide(),
  'guide-close':()=>{document.getElementById('guidebox').innerHTML='';localSet(GUIDE_KEY,'1');},
  'qr-show':async()=>{toast('產生 QR 碼中…');
    try{QRHTML=await stickersHTML();render();}catch(e){toast('QR 碼產生失敗，請檢查網路再試');}},
  'qr-print':async()=>{if(!QRHTML){try{QRHTML=await stickersHTML();render();}catch(e){toast('QR 碼產生失敗');return;}}
    document.body.classList.add('printing-qr');window.print();document.body.classList.remove('printing-qr');},
  homemode:b=>{HOMEMODE=b.dataset.m; localSet(HKEY,HOMEMODE); FLOOR.edit=false; render();},
  'floor-edit':()=>{if(!isHead()){toast('只有護理長能調整位置');return;} FLOOR.edit=!FLOOR.edit; render();
    if(!FLOOR.edit)toast('位置已儲存');},
  'floor-zoom':()=>{FLOOR.zoom=!FLOOR.zoom; render();},
  'floor-reset':()=>{S.pos={}; render(); saveFloor({}).then(()=>toast('已恢復預設位置')).catch(()=>toast('沒有存成功，請檢查網路'));},
  'item-add':()=>addItem(),
  'item-del':b=>{if(!isHead()){toast('只有護理長能刪除品項');return;} IDEL=itemKey(b.dataset.f,b.dataset.i);render();},
  'item-del-no':()=>{IDEL=null;render();},
  'item-del-yes':b=>delItem(b.dataset.f,b.dataset.i),
  'item-restore':b=>{if(!isHead()){toast('只有護理長能復原品項');return;} restoreItem(b.dataset.f,b.dataset.i);},
  'nurse-add':()=>addNurse(),
  'nurse-del':b=>{NDEL=b.dataset.id;render();},
  'nurse-del-no':()=>{NDEL=null;render();},
  'nurse-del-yes':b=>delNurse(b.dataset.id),
  role:()=>setRole(isHead()?'nurse':'head'),
  'role-head':()=>setRole('head')
};
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-tab]');
  if(tab){TAB=tab.dataset.tab;if(TAB!=='home'){leaveForm();D=null;}O.sel=null;render();window.scrollTo(0,0);return;}
  const nb=e.target.closest('[data-nurse]');
  if(nb){S.nurse=nb.dataset.nurse;localSet(NKEY,S.nurse);const t=pickThen;closePicker();renderTop();toast(`點班人：${S.nurse}`);if(t)t();return;}
  if(e.target.id==='nclose'||e.target.id==='sheet'){closePicker();return;}
  const b=e.target.closest('[data-act]'); if(b&&ACT[b.dataset.act])ACT[b.dataset.act](b);
});
document.addEventListener('input',e=>{
  if(e.target.id==='nq'){renderNurses(e.target.value);return;}
  const k=e.target.dataset.in; if(!k||!D)return;
  D.x[+e.target.dataset.i][k]=e.target.value; updateFoot();
});
document.addEventListener('change',e=>{
  if(e.target.dataset.base)changeBase(e.target);
  if(e.target.dataset.nid)editNurse(e.target);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!document.getElementById('sheet').hidden)closePicker();
  if(e.key==='Escape'&&document.getElementById('guide'))ACT['guide-close']();
  if(e.key==='Escape'&&!document.getElementById('scanner').hidden)closeScanner();
  if(e.key==='Enter'&&e.target.id==='nq'){const f=document.querySelector('#nlist [data-nurse]');if(f)f.click();}
  if(e.key==='Enter'&&(e.target.id==='na-n'||e.target.id==='na-t'))addNurse();
  if(e.key==='Enter'&&/^ia-/.test(e.target.id))addItem();
  if(e.key==='Enter'&&e.target.dataset.nid)e.target.blur();
});

/* 點班人是「這支手機是誰在用」，只記在這台裝置 */
S.nurse=localGet(NKEY); S.role=localGet(RKEY)==='head'?'head':'nurse'; HOMEMODE=localGet(HKEY)==='map'?'map':'list';
/* 放開圖示時存雲端：只送這一個圖示的新位置，其他圖示照原本的 */
bindFloorDrag((id,x,y)=>{
  S.pos=Object.assign({},S.pos,{[id]:{x,y}});
  saveFloor(S.pos).catch(()=>toast('位置沒有存成功，請檢查網路'));
});
render(); startCloud();
/* 第一次打開跳使用說明；從 QR 貼紙掃進來的人直接點班，不擋說明 */
if(!localGet(GUIDE_KEY)&&!fidFrom(location.hash))showGuide();
setInterval(()=>{if(!LOADED)return; renderTop(); if(TAB==='home'&&!D)render();},60000);
