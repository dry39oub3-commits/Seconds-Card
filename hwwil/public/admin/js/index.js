// ══════════════════════════════════════
// index.js — منطق الواجهة الرئيسية
// ══════════════════════════════════════
 
import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp,
         query, orderBy, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
 
const firebaseConfig = {
  apiKey:            "AIzaSyCov8KnTUdzywlejDGk74WODUEbZfx1nIc",
  authDomain:        "hawwil.firebaseapp.com",
  projectId:         "hawwil",
  storageBucket:     "hawwil.firebasestorage.app",
  messagingSenderId: "797332872661",
  appId:             "1:797332872661:web:5c1da802f0bad15332715c"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // ✅ (default) database
 
let BANKS = [];
let GAMES = [];
let selectedFrom = null;
let selectedTo   = null;
let selectedGame = null;
let selectedPkg  = null;
 
function loadContent() {
  onSnapshot(query(collection(db,'banks'), orderBy('order','asc')), snap => {
    BANKS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBanks('fromBanks', 'from');
    renderBanks('toBanks',   'to');
  }, e => {
    console.error('خطأ في تحميل البنوك:', e);
    BANKS = [];
    renderBanks('fromBanks', 'from');
    renderBanks('toBanks',   'to');
  });
 
  onSnapshot(query(collection(db,'games'), orderBy('order','asc')), snap => {
    GAMES = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGames('homeGamesGrid', 4);
    renderGames('fullGamesGrid');
  }, e => {
    console.error('خطأ في تحميل الألعاب:', e);
    GAMES = [];
    renderGames('homeGamesGrid', 4);
    renderGames('fullGamesGrid');
  });
}
 
window.showPage = function(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const map = { home:0, transfer:1, cards:2 };
  document.querySelectorAll('.nav-tab')[map[name]]?.classList.add('active');
  window.scrollTo({ top:0, behavior:'smooth' });
};
 
window.renderBanks = function(containerId, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!BANKS.length) {
    container.innerHTML = '<p style="color:var(--mid);font-size:.85rem;padding:.5rem">لا توجد بنوك متاحة حالياً</p>';
    return;
  }
  const currentSelected = type === 'from' ? selectedFrom : selectedTo;
  container.innerHTML = BANKS.map(b => `
    <button class="bank-btn${currentSelected === b.id ? ' selected' : ''}"
            id="${type}-${b.id}" onclick="selectBank('${type}','${b.id}')">
      <div class="bank-logo-wrap">
        ${b.logo
          ? `<img src="${b.logo}" alt="${b.name}" class="bank-logo-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
             <div class="bank-logo-fallback" style="display:none;background:${b.color||'#0A7C4E'}">${(b.name||'').substring(0,3)}</div>`
          : `<div class="bank-logo-fallback" style="background:${b.color||'#0A7C4E'}">${(b.name||'').substring(0,3)}</div>`
        }
      </div>
      <div class="bank-name">${b.name}</div>
    </button>`).join('');
};
 
window.selectBank = function(type, id) {
  BANKS.forEach(b => document.getElementById(type + '-' + b.id)?.classList.remove('selected'));
  document.getElementById(type + '-' + id)?.classList.add('selected');
  if (type === 'from') selectedFrom = id;
  else selectedTo = id;
};
 
window.calcAmount = function() {
  const amt  = parseFloat(document.getElementById('sendAmount').value) || 0;
  const rate = parseFloat(document.getElementById('commRate').value) / 100;
  const comm = amt * rate;
  const recv = amt - comm;
  document.getElementById('calcSent').textContent    = amt ? fmt(amt) + ' أوقية' : '—';
  document.getElementById('calcComm').textContent    = amt ? '-' + fmt(comm) + ' أوقية' : '—';
  document.getElementById('calcReceive').textContent = amt ? fmt(recv) + ' أوقية' : '—';
};
 
window.submitTransfer = async function() {
  const name    = document.getElementById('clientName').value.trim();
  const phone   = document.getElementById('clientPhone').value.trim();
  const amount  = parseFloat(document.getElementById('sendAmount').value) || 0;
  const rate    = parseFloat(document.getElementById('commRate').value);
  const account = document.getElementById('toAccount').value.trim();
  const notes   = document.getElementById('notes').value.trim();
 
  if (!name || !phone || !amount || !selectedFrom || !selectedTo || !account) {
    showToast('⚠️ يرجى ملء جميع الحقول واختيار البنوك');
    return;
  }
  if (selectedFrom === selectedTo) {
    showToast('⚠️ بنك الإرسال والاستلام لا يمكن أن يكونا نفس البنك');
    return;
  }
 
  const comm = amount * rate / 100;
  const recv = amount - comm;
  const ref  = 'HW-' + Math.floor(Math.random() * 90000 + 10000);
 
  const btn = document.querySelector('#transferForm .submit-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ جاري الإرسال...';
 
  try {
    const fb = BANKS.find(b => b.id === selectedFrom);
    const tb = BANKS.find(b => b.id === selectedTo);
 
    await addDoc(collection(db, 'transfers'), {
      ref, name, phone, amount,
      commRate: rate, commission: comm, receive: recv,
      fromBank: fb?.name || selectedFrom,
      toBank:   tb?.name || selectedTo,
      account, notes,
      status: 'pending',
      createdAt: serverTimestamp()
    });
 
    document.getElementById('successRef').textContent     = 'رقم الطلب: #' + ref;
    document.getElementById('transferForm').style.display = 'none';
    document.getElementById('successCard').style.display  = 'block';
    showToast('✅ تم إرسال طلبك بنجاح!');
 
  } catch(e) {
    console.error(e);
    showToast('❌ خطأ في الإرسال، حاول مجدداً');
    btn.disabled    = false;
    btn.textContent = '✅ إرسال طلب التحويل';
  }
};
 
window.resetTransfer = function() {
  document.getElementById('transferForm').style.display = 'block';
  document.getElementById('successCard').style.display  = 'none';
 
  ['clientName','clientPhone','sendAmount','toAccount','notes']
    .forEach(id => document.getElementById(id).value = '');
 
  document.getElementById('calcSent').textContent    = '—';
  document.getElementById('calcComm').textContent    = '—';
  document.getElementById('calcReceive').textContent = '—';
 
  const btn = document.querySelector('#transferForm .submit-btn');
  if (btn) { btn.disabled = false; btn.textContent = '✅ إرسال طلب التحويل'; }
 
  selectedFrom = selectedTo = null;
  document.querySelectorAll('.bank-btn').forEach(b => b.classList.remove('selected'));
};
 
window.renderGames = function(containerId, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const list = limit ? GAMES.slice(0, limit) : GAMES;
 
  if (!list.length) {
    container.innerHTML = '<p style="color:var(--mid);font-size:.85rem;padding:1rem">لا توجد ألعاب متاحة حالياً</p>';
    return;
  }
 
  container.innerHTML = list.map(g => `
    <div class="game-card" onclick="openModal('${g.id}')">
      <div class="game-cover" style="background:${g.bg||'#1a1a2e'}">
        ${g.logo
          ? `<img src="${g.logo}" alt="${g.name}" class="game-cover-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'"/>
             <span style="display:none;font-size:3.5rem">${g.icon||'🎮'}</span>`
          : `<span style="font-size:3.5rem">${g.icon||'🎮'}</span>`
        }
        ${g.badge ? `<div class="game-badge">${g.badge}</div>` : ''}
      </div>
      <div class="game-body">
        <div class="game-name">${g.name}</div>
        <div class="game-desc">${g.desc||''}</div>
        <div class="packages-grid">
          ${(g.pkgs||[]).slice(0,3).map(p=>`
            <div class="pkg">
              <div class="pkg-amount">${p.amount}</div>
              <div class="pkg-price">${fmt(p.price)} أوقية</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`).join('');
};
 
window.openModal = function(gameId) {
  selectedGame = GAMES.find(g => g.id === gameId);
  selectedPkg  = null;
  if (!selectedGame) return;
 
  document.getElementById('modalTitle').textContent    = selectedGame.name;
  document.getElementById('modalGameName').textContent = selectedGame.name;
 
  const iconEl = document.getElementById('modalIcon');
  iconEl.style.background = selectedGame.bg || '#1a1a2e';
  iconEl.innerHTML = selectedGame.logo
    ? `<img src="${selectedGame.logo}" style="width:50px;height:50px;object-fit:contain;border-radius:8px"
         onerror="this.outerHTML='<span style=font-size:2.5rem>${selectedGame.icon||'🎮'}</span>'"/>`
    : `<span style="font-size:2.5rem">${selectedGame.icon||'🎮'}</span>`;
 
  document.getElementById('modalPlayerId').value    = '';
  document.getElementById('modalPhone').value       = '';
  document.getElementById('modalTotal').textContent = 'اختر باقة أولاً';
 
  document.getElementById('modalPkgs').innerHTML = (selectedGame.pkgs||[]).map((p,i) => `
    <div class="modal-pkg" onclick="selectPkg(${i})">
      <div class="modal-pkg-amount">${p.amount}</div>
      <div class="modal-pkg-price">${fmt(p.price)} أوقية</div>
    </div>`).join('');
 
  document.getElementById('modal').classList.add('open');
};
 
window.selectPkg = function(i) {
  selectedPkg = selectedGame.pkgs[i];
  document.querySelectorAll('.modal-pkg').forEach((el,idx) => el.classList.toggle('active', idx===i));
  document.getElementById('modalTotal').textContent = fmt(selectedPkg.price) + ' أوقية';
};
 
window.closeModal = function(e) {
  if (!e || e.target === document.getElementById('modal'))
    document.getElementById('modal').classList.remove('open');
};
 
window.submitCard = async function() {
  const pid   = document.getElementById('modalPlayerId').value.trim();
  const phone = document.getElementById('modalPhone').value.trim();
 
  if (!selectedPkg) { showToast('⚠️ اختر باقة أولاً'); return; }
  if (!pid)         { showToast('⚠️ أدخل معرف اللاعب'); return; }
  if (!phone)       { showToast('⚠️ أدخل رقم هاتفك'); return; }
 
  const ref = 'CRD-' + Math.floor(Math.random() * 90000 + 10000);
 
  try {
    await addDoc(collection(db,'cards'), {
      ref,
      game:      selectedGame.name,
      gameId:    selectedGame.id,
      package:   selectedPkg.amount,
      price:     selectedPkg.price,
      playerId:  pid,
      phone,
      status:    'pending',
      createdAt: serverTimestamp()
    });
  } catch(e) { console.error(e); }
 
  const msg = encodeURIComponent(
    `طلب شراء بطاقة رقمية\nرقم الطلب: #${ref}\nاللعبة: ${selectedGame.name}\nالباقة: ${selectedPkg.amount}\nالسعر: ${selectedPkg.price} أوقية\nمعرف اللاعب: ${pid}\nرقم الهاتف: ${phone}`
  );
  window.open(`https://wa.me/0022234362534?text=${msg}`, '_blank');
  document.getElementById('modal').classList.remove('open');
  showToast('✅ جاري فتح واتساب لإتمام الطلب');
};
 
function fmt(n) { return Number(n).toLocaleString('ar-MA'); }
 
window.showToast = function(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};
 
loadContent();
 