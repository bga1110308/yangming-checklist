/* 表單內容：六張點班表的品項與基本量，照 A051 病房 10/9 的紙本逐列抄。
   要改品項就只改這個檔，畫面程式不用動。 */

/* ===== 班別：照紙本 0-8／8-4／4-12 ===== */
export const SHIFTS=[
  {id:'N',name:'大夜',code:'0-8',start:0,end:8},
  {id:'D',name:'白班',code:'8-4',start:8,end:16},
  {id:'E',name:'小夜',code:'4-12',start:16,end:24}
];
export const SH=Object.fromEntries(SHIFTS.map(s=>[s.id,s]));
export const REASONS=['借出','送修','已用待補','遺失待查','多出待歸還','其他'];

/* 預設名單：永續課第二組組員，旁邊顯示學程年級（不放學號，避免個資外流）。
   真正用的名單存在雲端 nurses，由護理長在「基本量設定」頁增刪；
   這份只在雲端第一次還沒有名單時，自動放上去當起始名單。 */
export const DEFAULT_NURSES=[['蔡玟純','護理學系博4'],['許品婕','護理學系博1'],['羅寶珍','臨護所博3'],['李姵萱','臨護所博1'],
  ['莊宜儒','臨護所碩2'],['湯子萱','臨護所碩1'],['陳佳琪','碩專班2'],['陳雅婷','碩專班1'],
  ['邱琦雯','社區所2'],['夏瑞鄉','長照學程2'],['林慧怡','碩專班']];

/* 品項寫法：'標籤:數量|標籤:數量'；ok＝功能正常，amt＝適量 */
function it(n,spec,opt){
  const p=String(spec).split('|').map(s=>{
    const k=s.lastIndexOf(':');
    const l=k<0?'':s.slice(0,k), v=k<0?s:s.slice(k+1);
    return {l, b:(v==='ok'||v==='amt')?v:Number(v)};
  });
  return Object.assign({n,p},opt||{});
}
const DRUG={d:true};

/* ===== 六張表，內容照 10/9 照片的紙本逐列抄 ===== */
export const FORMS=[
 {id:'cart',short:'急救車',mark:'急',name:'急救車日點班',type:'count',shifts:['D'],when:'每天 8AM',groups:[
  {pos:'桌面',items:[it('酒精棉、ACLS 紀錄單','amt'),it('電擊器（EKG 及 SpO2 導線）','數量:1|持續蓄電:ok')]},
  {pos:'側面',items:[it('彎盆 / 乾洗手液 / 尖銳物收集盒 / 平板','彎盆:1|乾洗手液:1|收集盒:1|平板:1')]},
  {pos:'背面',items:[it('急救板','1')]},
  {pos:'第一層',items:[
   it('紙膠 / 宜拉膠 / 斜紋帶 / 止血帶','紙膠:1|宜拉膠:1|斜紋帶:1|止血帶:2'),it('T-connect / Tegaderm','T-connect:3|Tegaderm:3'),
   it('留置針 18～24Fr','各號:2'),it('空針 3・5・10・20 ml','3ml:2|5ml:2|10ml:2|20ml:2'),it('3way / 18 號安全針頭','3way:2|針頭:2'),
   it('Epinephrine','20',DRUG),it('Norepinephrine（Levophed）','5',DRUG),it('Atropine','5',DRUG),it('2% Xylocaine','5',DRUG),
   it('7% Sod. Bicarbonate','10',DRUG),it('50% Vitagen（Glucose）','5',DRUG),it('2% Vitacal（Cal. Gluconate）','5',DRUG),
   it('Amiodarone','5',DRUG),it('10% MgSO4','5',DRUG),it('Dormicum（四級）','3',DRUG),it('NTG','1',DRUG),
   it('Allermin（Chlorpheniramine）','3',DRUG),it('Solu-cortef','3',DRUG)]},
  {pos:'第二層',items:[
   it('口咽組 / 鼻咽導管 7.0・7.5・8.0Fr','口咽組:1|7.0Fr:2|7.5Fr:2|8.0Fr:2'),it('壓舌板 / 感染垃圾袋 / 尿套','壓舌板:1|垃圾袋:1|尿套:1'),
   it('純氧面罩 NRM','1'),it('IV SET 微量 / 普通','微量:1|普通:1'),it('EKG 貼片 / 電擊貼片 / EKG 用紙 / 剪刀','EKG貼片:1|電擊貼片:1|EKG用紙:1|剪刀:1'),
   it('手電筒 / 聚光筆燈','手電筒:1|聚光筆燈:2|功能:ok'),it('3 號 / 4 號電池','3號:2|4號:5')]},
  {pos:'第三層',items:[
   it('麥吉爾鑷子 / 通條','鑷子:1|通條:1'),it('氧氣連接管 / 鼻導管 / 噴霧器','連接管:1|鼻導管:1|噴霧器:1'),it('喉鏡 / 葉柄','喉鏡:1|葉柄:2|功能:ok'),
   it('Cuff 測壓器 / 2 號電池 / 麥克筆','測壓器:1|2號電池:2|麥克筆:1'),it('Xylocaine jelly / spray','jelly:1|spray:1'),it('Endo 管 7.0・7.5・8.0','7.0:2|7.5:2|8.0:2'),
   it('氣切套管 7.5 / 口咬器 / 張口器 / 假牙盒','套管:1|口咬器:1|張口器:1|假牙盒:1'),it('N95 / 無菌手套 6.5・7.0・7.5','N95:2|6.5:2|7.0:2|7.5:2'),it('抽痰管','5')]},
  {pos:'其他設備',items:[it('抽吸錶 / 痰液收集瓶 / 抽吸連接管','抽吸錶:1|收集瓶:1|連接管:2'),it('檢診手套（盒）','1')]},
  {pos:'底層',items:[it('甦醒球組 BVM','1'),it('IV CAN','1'),it('Gipamine（包）','1',DRUG),it('NS / D5W 500ml','NS:1|D5W:1'),it('標準防護包','2')]}
 ]},
 {id:'equip',short:'儀器',mark:'儀',name:'三班點班',type:'count',shifts:['N','D','E'],when:'0AM／8AM／4PM',groups:[
  {pos:'儀器設備',items:[
   it('聽診器','8'),it('無菌鑷、剪、碗','鑷:2|剪:2|碗:2'),it('拍痰器 / 平板電腦','拍痰器:2|平板:2'),it('Bladder scan / 血糖機','Bladder scan:1|血糖機:1'),
   it('滑板 / PUMP','滑板:2|PUMP:2'),it('Pulse Oximeter（小）','4'),it('公務手機＋BCMA 鑰匙 / 充電器','手機:7|充電器:3'),it('耳溫槍 BCMA / 額溫槍','耳溫槍:8|額溫槍:2'),
   it('血壓計 NO.1–8','8'),it('小氧氣筒及架','3'),it('飛利浦心電圖機','1'),
   it('輪椅（有點滴架）','4',{night:true}),it('輪椅（可拆腳架）','3',{night:true}),it('高背輪椅','9',{night:true})]}
 ]},
 {id:'cold',short:'冷藏藥',mark:'冷',name:'冷藏藥品管理',type:'cold',shifts:['N','D','E'],when:'三班',drugs:[
  {n:'Humulin R',spec:'100u/10ml/vial',b:0,use:0},{n:'Insulatard',spec:'100u/10ml/vial',b:1,use:0},
  {n:'Heparin',spec:'5000u/5ml/vial',b:1,use:0},{n:'Actrapid',spec:'100u/ml',b:1,use:2}]},
 {id:'ctrl',short:'管制藥',mark:'管',name:'第 4 級管制藥品',type:'ctrl',shifts:['N','D','E'],when:'三班',drugs:[{n:'Dormicum',spec:'5mg/Amp',b:3}]},
 {id:'fridge',short:'冰箱',mark:'冰',name:'醫用冰箱查核',type:'check',shifts:['D'],when:'每天一次',qs:[
  '冰箱溫度介於 2–8°C','冰箱電源插在緊急用電插座','冰箱沒有放藥物以外的物品（檢體要放有蓋容器分隔）',
  '病人個別用藥有標示姓名及床號','已開封藥物有註明開封日期時間，並在規定時間內用完或丟棄','特殊冷藏急需藥品都在有效期限內']},
 {id:'month',short:'月點班',mark:'月',name:'病房月點班',type:'count',shifts:['D'],freq:'monthly',when:'每月第一個週日',groups:[
  {pos:'大型設備',items:[
   it('加長床墊 / CPM','加長床墊:1|CPM:1'),it('熱敷墊','有布:15|裸:5'),it('氣墊座','1'),it('脂肪墊','大:4|中:2|小:4'),
   it('抽吸表（Suction）','16'),it('NG Decompression','3'),it('Emerson Suction','3'),it('活動點滴架（1–10）','10'),it('三層車','4'),
   it('可拆式輪椅','3'),it('點滴架輪椅','4'),it('床上 / 坐式體重計','床上:1|坐式:1'),it('小推床','1'),it('牽引機','2'),
   it('氬氣 / 半導體靜脈雷射機','氬氣:2|半導體:2')]}
 ]}
];
export const FM=Object.fromEntries(FORMS.map(f=>[f.id,f]));
FORMS.forEach(f=>{ if(f.groups){ let i=0; f.flat=[]; f.groups.forEach(g=>g.items.forEach(x=>{x.i=i++; x.g=g.pos; f.flat.push(x);})); } });
/* 冷藏藥、管制藥也給固定代號，基本量、結存量設定都靠代號對到藥，刪掉前面的藥也不會對錯 */
FORMS.forEach(f=>{ if(f.drugs) f.drugs.forEach((g,i)=>{g.i=i;}); });

/* ===== 護理長新增／刪除品項 =====
   雲端 settings/items 存 {hide:['表單:代號'], add:[{f,i,n,g?,b?,spec?}]}。
   程式內建的品項不真的刪，只是藏起來，代號永遠不變，基本量和舊紀錄才不會對錯品項；
   新增的品項代號從 1000 開始，跟內建的分開。 */
export const ADD_FROM=1000;
const ORIG=Object.fromEntries(FORMS.map(f=>[f.id,{
  groups:f.groups&&f.groups.map(g=>({pos:g.pos,items:g.items.slice()})),
  drugs:f.drugs&&f.drugs.slice(),
  qs:f.qs&&f.qs.slice()
}]));
export const itemKey=(fid,i)=>`${fid}:${i}`;
/* 雲端品項清單一有變動就重算每張表的內容；畫面程式只看 f.flat／f.drugs／f.qs，不用知道哪些是新增的 */
export function applyItems(cfg){
  const hide=new Set((cfg&&cfg.hide)||[]), add=(cfg&&cfg.add)||[];
  FORMS.forEach(f=>{
    const o=ORIG[f.id], mine=add.filter(a=>a.f===f.id), keep=i=>!hide.has(itemKey(f.id,i));
    if(o.groups){
      f.groups=o.groups.map(g=>({pos:g.pos,items:g.items.filter(x=>keep(x.i))
        .concat(mine.filter(a=>a.g===g.pos).map(a=>it(a.n,String(a.b),{i:a.i,g:g.pos,added:true})))}));
      f.flat=f.groups.flatMap(g=>g.items);
    }
    if(o.drugs) f.drugs=o.drugs.filter(g=>keep(g.i)).concat(mine.map(a=>({n:a.n,spec:a.spec||'',b:a.b,use:0,i:a.i,added:true})));
    // 查核題目維持文字陣列（畫面程式照舊），另外用 qsI 記每題的代號給刪除用
    if(o.qs){
      const q=o.qs.map((t,i)=>[t,i]).filter(([,i])=>keep(i)).concat(mine.map(a=>[a.n,a.i]));
      f.qs=q.map(x=>x[0]); f.qsI=q.map(x=>x[1]);
    }
  });
}
/* 被藏起來的內建品項（給「復原」用） */
export function hiddenItems(fid,cfg){
  const hide=new Set((cfg&&cfg.hide)||[]), o=ORIG[fid], out=[];
  if(o.groups) o.groups.forEach(g=>g.items.forEach(x=>{if(hide.has(itemKey(fid,x.i)))out.push({i:x.i,n:x.n});}));
  if(o.drugs) o.drugs.forEach(g=>{if(hide.has(itemKey(fid,g.i)))out.push({i:g.i,n:g.n});});
  if(o.qs) o.qs.forEach((t,i)=>{if(hide.has(itemKey(fid,i)))out.push({i,n:t});});
  return out;
}
applyItems({});

