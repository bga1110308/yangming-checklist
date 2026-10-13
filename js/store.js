/* 雲端資料層：所有跟 Firebase 打交道的程式都在這個檔，畫面程式（app.js）不直接碰 Firebase。
   這樣以後要換資料庫（例如改接醫院系統），只要換掉這一個檔。 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, onSnapshot, setDoc, getDocs, writeBatch }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* 這組設定是公開的（Firebase 網頁版本來就放在前端），真正的權限由雲端的安全規則把關 */
const CONFIG = {
  apiKey: 'AIzaSyD1TZI_nFtMhh8B_ALfSXmYuO41ZSf6HUU',
  authDomain: 'yangming-checklist.firebaseapp.com',
  projectId: 'yangming-checklist',
  storageBucket: 'yangming-checklist.firebasestorage.app',
  messagingSenderId: '413723114059',
  appId: '1:413723114059:web:abba20b3c387a1e7bcebce'
};
/* 專案擁有者：用來核對資料、清掉重來的帳號（安全規則裡寫同一個信箱） */
export const OWNER = 'cicely.hi@gmail.com';

const app = initializeApp(CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
let subscribed = false;

/* 開頁就自動匿名登入，組員不用帳號；只有擁有者另外用 Google 登入 */
export function start(h) {
  onAuthStateChanged(auth, user => {
    if (!user) { signInAnonymously(auth).catch(h.onError); return; }
    h.onUser(user);
    if (!subscribed) { subscribed = true; subscribe(h); }
  });
}
function subscribe(h) {
  // 第二個參數告訴畫面「這份是不是雲端確認過的」，空的而且確認過才代表真的沒資料
  onSnapshot(collection(db, 'records'), s => h.onRecords(s.docs.map(d => d.data()), s.metadata.fromCache), h.onError);
  onSnapshot(doc(db, 'settings', 'base'), s => h.onBase(s.exists() ? s.data() : {}), h.onError);
}

export const googleLogin = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = () => signOut(auth);

/* Firestore 不收 undefined，先轉一次 JSON 把空欄位拿掉 */
const clean = o => JSON.parse(JSON.stringify(o));
export const recId = r => `${r.f}_${r.d}_${r.s}`;
export const saveRecord = r => setDoc(doc(db, 'records', recId(r)), clean(r));
export const saveBase = body => setDoc(doc(db, 'settings', 'base'), clean(body));

/* 雲端完全沒紀錄時放進示範資料。整批一次寫入：如果別人剛好同時放好了，這批會被安全規則擋下，不會重複 */
export async function seedDemo(seedRecords) {
  const batch = writeBatch(db);
  seedRecords.forEach(r => batch.set(doc(db, 'records', recId(r)), clean(r)));
  await batch.commit();
}

/* 擁有者用：清空所有點班紀錄和基本量，再放回示範資料。一批最多 400 筆，避免超過雲端上限 */
export async function resetDemo(seedRecords) {
  const old = await getDocs(collection(db, 'records'));
  const ops = old.docs.map(d => b => b.delete(d.ref));
  seedRecords.forEach(r => ops.push(b => b.set(doc(db, 'records', recId(r)), clean(r))));
  ops.push(b => b.set(doc(db, 'settings', 'base'), { base: {}, log: [] }));
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(op => op(batch));
    await batch.commit();
  }
}
