// ══════════════════════════════════════
// dashboard-main.js — نقطة الدخول للوحة الأدمن
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, updateDoc, setDoc,
         orderBy, query, addDoc, deleteDoc, serverTimestamp, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initOrders, filterOrders, changeStatus } from './orders.js';
import { initStocks, renderStock }                from './stocks.js';
import { initAddCard, selectCat, updateCardOptions, clearCodes, saveStock } from './add-card.js';

// ══ AUTH ══
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'hawwil2026';

window.doLogin = function() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value.trim();
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('app').classList.add('show');
    initAll();
  } else {
    document.getElementById('loginErr').style.display = 'block';
  }
};

window.doLogout = function() {
  document.getElementById('loginWrap').style.display = 'flex';
  document.getElementById('app').classList.remove('show');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginWrap').style.display !== 'none')
    window.doLogin();
});


function initAll() {
  initOrders();
  initStocks();
  initAddCard();
  initContentManagement();
}

// ══ TABS ══
window.switchTab = function(tab) {
  const tabs = ['transfers', 'cards', 'stock', 'content'];
  tabs.forEach((t, i) => {
    document.querySelectorAll('.tab')[i]?.classList.toggle('active', t === tab);
    const el = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
};

// ══ STOCK MODAL ══
window.openStockModal = function() {
  document.getElementById('stockModal').classList.add('open');
  clearCodes();
  updateCardOptions();
};

window.closeStockModal = function(e) {
  if (!e || e.target === document.getElementById('stockModal'))
    document.getElementById('stockModal').classList.remove('open');
};

// ══ CONTENT MANAGEMENT ══
let allBanks = [], allGames = [], editingBankId = null, editingGameId = null;
let gamePkgs = [];

function initContentManagement() {
  onSnapshot(query(collection(db, 'banks'), orderBy('order', 'asc')), snap => {
    allBanks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBanksTable();
  });
  onSnapshot(query(collection(db, 'games'), orderBy('order', 'asc')), snap => {
    allGames = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGamesTable();
  });
}

function renderBanksTable() {
  const tbody = document.getElementById('banksBody');
  if (!tbody) return;
  tbody.innerHTML = allBanks.map(b => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.7rem">
          <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:${b.color||'#888'};display:flex;align-items:center;justify-content:center">
            ${b.logo ? `<img src="${b.logo}" style="width:36px;height:36px;object-fit:contain" onerror="this.parentElement.innerHTML='<span style=color:#fff;font-weight:800;font-size:.75rem>${(b.name||'').substring(0,3)}</span>'">` : `<span style="color:#fff;font-weight:800;font-size:.75rem">${(b.name||'').substring(0,3)}</span>`}
          </div>
          <strong>${b.name}</strong>
        </div>
      </td>
      <td><span style="font-size:.75rem;color:var(--muted)">${b.logo ? b.logo.substring(0,40)+'...' : 'لا يوجد'}</span></td>
      <td><div style="width:24px;height:24px;border-radius:50%;background:${b.color||'#888'}"></div></td>
      <td>${b.order || 0}</td>
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="stock-btn" style="font-size:.75rem;padding:.3rem .7rem" onclick="openEditBank('${b.id}')">✏️</button>
          <button class="del-btn" onclick="deleteBank('${b.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function renderGamesTable() {
  const tbody = document.getElementById('gamesBody');
  if (!tbody) return;
  tbody.innerHTML = allGames.map(g => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.7rem">
          <div style="width:44px;height:44px;border-radius:10px;background:${g.bg||'#1a1a2e'};display:flex;align-items:center;justify-content:center">
            ${g.logo ? `<img src="${g.logo}" style="width:38px;height:38px;object-fit:contain" onerror="this.parentElement.innerHTML='<span style=font-size:1.4rem>${g.icon||'🎮'}</span>'">` : `<span style="font-size:1.4rem">${g.icon||'🎮'}</span>`}
          </div>
          <div><div style="font-weight:800">${g.name}</div><div style="font-size:.75rem;color:var(--muted)">${g.desc||''}</div></div>
        </div>
      </td>
      <td>${g.badge||'—'}</td>
      <td>${(g.pkgs||[]).length} باقة</td>
      <td>${g.order||0}</td>
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="stock-btn" style="font-size:.75rem;padding:.3rem .7rem" onclick="openEditGame('${g.id}')">✏️</button>
          <button class="del-btn" onclick="deleteGame('${g.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

// Bank CRUD
window.openAddBank = function() {
  editingBankId = null;
  document.getElementById('bankModalTitle').textContent = '➕ إضافة بنك';
  ['bankName','bankLogo','bankId'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('bankColor').value = '#0A7C4E';
  document.getElementById('bankOrder').value = allBanks.length;
  updateBankPreview();
  document.getElementById('bankModal').classList.add('open');
};
window.openEditBank = function(id) {
  const b = allBanks.find(x => x.id === id); if (!b) return;
  editingBankId = id;
  document.getElementById('bankModalTitle').textContent = '✏️ تعديل البنك';
  document.getElementById('bankName').value  = b.name  || '';
  document.getElementById('bankLogo').value  = b.logo  || '';
  document.getElementById('bankColor').value = b.color || '#0A7C4E';
  document.getElementById('bankOrder').value = b.order || 0;
  document.getElementById('bankId').value    = b.id    || '';
  updateBankPreview();
  document.getElementById('bankModal').classList.add('open');
};
window.closeBankModal = function(e) {
  if (!e || e.target === document.getElementById('bankModal'))
    document.getElementById('bankModal').classList.remove('open');
};
window.updateBankPreview = function() {
  const logo = document.getElementById('bankLogo').value.trim();
  const color= document.getElementById('bankColor').value;
  const name = document.getElementById('bankName').value.trim();
  const prev = document.getElementById('bankPreview');
  prev.style.background = color;
  prev.innerHTML = logo
    ? `<img src="${logo}" style="width:40px;height:40px;object-fit:contain" onerror="this.parentElement.innerHTML='<span style=color:#fff;font-weight:900>${name.substring(0,3)}</span>'">`
    : `<span style="color:#fff;font-weight:900;font-size:.9rem">${name.substring(0,3)||'؟'}</span>`;
};
window.saveBank = async function() {
  const name  = document.getElementById('bankName').value.trim();
  const logo  = document.getElementById('bankLogo').value.trim();
  const color = document.getElementById('bankColor').value;
  const order = parseInt(document.getElementById('bankOrder').value) || 0;
  const bid   = document.getElementById('bankId').value.trim() || name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  if (!name) { showToast('⚠️ أدخل اسم البنك'); return; }
  const btn = document.getElementById('saveBankBtn');
  btn.disabled = true; btn.textContent = '⏳...';
  try {
    if (editingBankId) await updateDoc(doc(db,'banks',editingBankId),{name,logo,color,order});
    else await setDoc(doc(db,'banks',bid),{name,logo,color,order,createdAt:serverTimestamp()});
    showToast('✅ تم حفظ البنك');
    document.getElementById('bankModal').classList.remove('open');
  } catch(e) { showToast('❌ ' + e.message); }
  btn.disabled = false; btn.textContent = '💾 حفظ البنك';
};
window.deleteBank = async function(id) {
  if (!confirm('حذف هذا البنك؟')) return;
  try { await deleteDoc(doc(db,'banks',id)); showToast('🗑️ تم الحذف'); }
  catch { showToast('❌ خطأ'); }
};

// Game CRUD
window.openAddGame = function() {
  editingGameId = null; gamePkgs = [];
  document.getElementById('gameModalTitle').textContent = '➕ إضافة لعبة';
  ['gameName','gameIcon','gameLogo','gameDesc','gameBadge','gameId'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('gameIcon').value = '🎮';
  document.getElementById('gameBg').value   = '#1A1A2E';
  document.getElementById('gameOrder').value = allGames.length;
  renderPkgsEditor(); updateGamePreview();
  document.getElementById('gameModal').classList.add('open');
};
window.openEditGame = function(id) {
  const g = allGames.find(x => x.id === id); if (!g) return;
  editingGameId = id; gamePkgs = JSON.parse(JSON.stringify(g.pkgs||[]));
  document.getElementById('gameModalTitle').textContent = '✏️ تعديل اللعبة';
  document.getElementById('gameName').value  = g.name  || '';
  document.getElementById('gameIcon').value  = g.icon  || '🎮';
  document.getElementById('gameLogo').value  = g.logo  || '';
  document.getElementById('gameBg').value    = g.bg    || '#1A1A2E';
  document.getElementById('gameDesc').value  = g.desc  || '';
  document.getElementById('gameBadge').value = g.badge || '';
  document.getElementById('gameOrder').value = g.order || 0;
  document.getElementById('gameId').value    = g.id    || '';
  renderPkgsEditor(); updateGamePreview();
  document.getElementById('gameModal').classList.add('open');
};
window.closeGameModal = function(e) {
  if (!e || e.target === document.getElementById('gameModal'))
    document.getElementById('gameModal').classList.remove('open');
};
window.updateGamePreview = function() {
  const logo = document.getElementById('gameLogo').value.trim();
  const bg   = document.getElementById('gameBg').value;
  const icon = document.getElementById('gameIcon').value;
  const prev = document.getElementById('gamePreview');
  prev.style.background = bg;
  prev.innerHTML = logo
    ? `<img src="${logo}" style="width:48px;height:48px;object-fit:contain;border-radius:8px" onerror="this.outerHTML='<span style=font-size:2rem>${icon}</span>'">`
    : `<span style="font-size:2rem">${icon||'🎮'}</span>`;
};
function renderPkgsEditor() {
  const cont = document.getElementById('pkgsEditor'); if (!cont) return;
  cont.innerHTML = gamePkgs.map((p,i)=>`
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem">
      <input class="finput" style="flex:1" value="${p.amount||''}" oninput="updatePkg(${i},'amount',this.value)" placeholder="مثال: 60 UC"/>
      <input class="finput" style="width:110px" type="number" value="${p.price||''}" oninput="updatePkg(${i},'price',this.value)" placeholder="السعر"/>
      <button onclick="removePkg(${i})" style="background:var(--red-light);color:var(--red);border:none;border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button>
    </div>`).join('')
    + `<button onclick="addPkg()" class="stock-btn" style="font-size:.82rem;padding:.4rem .9rem;margin-top:.3rem">➕ إضافة باقة</button>`;
}
window.addPkg    = function() { gamePkgs.push({amount:'',price:0}); renderPkgsEditor(); };
window.removePkg = function(i) { gamePkgs.splice(i,1); renderPkgsEditor(); };
window.updatePkg = function(i,f,v) { gamePkgs[i][f] = f==='price'?parseFloat(v)||0:v; };
window.saveGame  = async function() {
  const name  = document.getElementById('gameName').value.trim();
  const icon  = document.getElementById('gameIcon').value.trim();
  const logo  = document.getElementById('gameLogo').value.trim();
  const bg    = document.getElementById('gameBg').value;
  const desc  = document.getElementById('gameDesc').value.trim();
  const badge = document.getElementById('gameBadge').value.trim();
  const order = parseInt(document.getElementById('gameOrder').value)||0;
  const gid   = document.getElementById('gameId').value.trim()||name.toLowerCase().replace(/\s+/g,'-').replace(/[^\w-]/g,'').substring(0,20);
  if (!name) { showToast('⚠️ أدخل اسم اللعبة'); return; }
  const pkgs = gamePkgs.filter(p=>p.amount&&p.price>0);
  const btn  = document.getElementById('saveGameBtn');
  btn.disabled=true; btn.textContent='⏳...';
  try {
    const data={name,icon,logo,bg,desc,badge,order,pkgs};
    if(editingGameId) await updateDoc(doc(db,'games',editingGameId),data);
    else await setDoc(doc(db,'games',gid),{...data,createdAt:serverTimestamp()});
    showToast('✅ تم حفظ اللعبة');
    document.getElementById('gameModal').classList.remove('open');
  } catch(e) { showToast('❌ '+e.message); }
  btn.disabled=false; btn.textContent='💾 حفظ اللعبة';
};
window.deleteGame = async function(id) {
  if (!confirm('حذف هذه اللعبة؟')) return;
  try { await deleteDoc(doc(db,'games',id)); showToast('🗑️ تم الحذف'); }
  catch { showToast('❌ خطأ'); }
};

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

window.filterTable = (type) => filterOrders(type);

