// ══════════════════════════════════════
// orders.js — إدارة طلبات التحويل والبطاقات
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, updateDoc, orderBy, query }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allTransfers = [];
let allCards     = [];

export function initOrders() {
  // Transfers listener
  onSnapshot(query(collection(db, 'transfers'), orderBy('createdAt', 'desc')), snap => {
    allTransfers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTransfers(allTransfers);
    updateStats();
  });

  // Cards listener
  onSnapshot(query(collection(db, 'cards'), orderBy('createdAt', 'desc')), snap => {
    allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCards(allCards);
    updateStats();
  });
}

function updateStats() {
  const all     = [...allTransfers, ...allCards];
  const pending = all.filter(r => r.status === 'pending').length;
  const done    = all.filter(r => r.status === 'done').length;
  const total   = allTransfers.reduce((s, r) => s + (r.amount || 0), 0)
                + allCards.reduce((s, r) => s + (r.price || 0), 0);
  setEl('sTotal',   fmt(all.length));
  setEl('sPending', fmt(pending));
  setEl('sDone',    fmt(done));
  setEl('sAmount',  fmt(Math.round(total)));
}

function renderTransfers(data) {
  const tbody = document.getElementById('transfersBody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty"><div class="empty-icon">📭</div>لا توجد طلبات</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><span class="ref">${r.ref || '—'}</span></td>
      <td><strong>${r.name || '—'}</strong></td>
      <td dir="ltr">${r.phone || '—'}</td>
      <td><strong>${fmt(r.amount || 0)} أوقية</strong></td>
      <td style="color:#DC2626">-${fmt(r.commission || 0)}</td>
      <td style="color:var(--green);font-weight:800">${fmt(r.receive || 0)}</td>
      <td>${r.fromBank || '—'}</td>
      <td>${r.toBank || '—'}</td>
      <td dir="ltr" style="font-size:.78rem">${r.account || '—'}</td>
      <td style="font-size:.78rem">${fmtDate(r.createdAt)}</td>
      <td>
        <select class="status-select" onchange="changeStatus('transfers','${r.id}',this.value)">
          <option value="pending"  ${r.status === 'pending'  ? 'selected' : ''}>⏳ معلق</option>
          <option value="done"     ${r.status === 'done'     ? 'selected' : ''}>✅ مكتمل</option>
          <option value="rejected" ${r.status === 'rejected' ? 'selected' : ''}>❌ مرفوض</option>
        </select>
      </td>
    </tr>`).join('');
}

function renderCards(data) {
  const tbody = document.getElementById('cardsBody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="empty-icon">🎮</div>لا توجد طلبات</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><span class="ref">${r.ref || '—'}</span></td>
      <td><strong>${r.game || '—'}</strong></td>
      <td>${r.package || '—'}</td>
      <td style="color:var(--green);font-weight:800">${fmt(r.price || 0)} أوقية</td>
      <td dir="ltr">${r.playerId || '—'}</td>
      <td dir="ltr">${r.phone || '—'}</td>
      <td style="font-size:.78rem">${fmtDate(r.createdAt)}</td>
      <td>
        <select class="status-select" onchange="changeStatus('cards','${r.id}',this.value)">
          <option value="pending"  ${r.status === 'pending'  ? 'selected' : ''}>⏳ معلق</option>
          <option value="done"     ${r.status === 'done'     ? 'selected' : ''}>✅ مكتمل</option>
          <option value="rejected" ${r.status === 'rejected' ? 'selected' : ''}>❌ مرفوض</option>
        </select>
      </td>
    </tr>`).join('');
}

export async function changeStatus(col, docId, status) {
  try {
    await updateDoc(doc(db, col, docId), { status });
    const labels = { pending: 'معلق', done: 'مكتمل', rejected: 'مرفوض', available: 'متاح', used: 'مستخدم' };
    showToast(`✅ تم تغيير الحالة إلى: ${labels[status]}`);
  } catch (e) { showToast('❌ خطأ في التحديث'); }
}

export function filterOrders(type) {
  if (type === 'transfers') {
    const q = document.getElementById('searchTransfer')?.value.toLowerCase() || '';
    renderTransfers(allTransfers.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.phone || '').includes(q) ||
      (r.ref || '').toLowerCase().includes(q)
    ));
  } else {
    const q = document.getElementById('searchCards')?.value.toLowerCase() || '';
    renderCards(allCards.filter(r =>
      (r.game || '').toLowerCase().includes(q) ||
      (r.playerId || '').toLowerCase().includes(q) ||
      (r.ref || '').toLowerCase().includes(q)
    ));
  }
}

function fmt(n)    { return Number(n).toLocaleString('ar-MA'); }
function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

window.changeStatus  = changeStatus;
window.filterOrders  = filterOrders;