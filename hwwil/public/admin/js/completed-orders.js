// ══════════════════════════════════════
// completed-orders.js — الطلبات المكتملة
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, where }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function initCompletedOrders() {
  // Completed transfers
  onSnapshot(
    query(collection(db, 'transfers'), where('status', '==', 'done'), orderBy('createdAt', 'desc')),
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCompletedTransfers(data);
    }
  );
  // Completed cards
  onSnapshot(
    query(collection(db, 'cards'), where('status', '==', 'done'), orderBy('createdAt', 'desc')),
    snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderCompletedCards(data);
    }
  );
}

function renderCompletedTransfers(data) {
  const tbody = document.getElementById('completedTransfersBody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="empty-icon">✅</div>لا توجد طلبات مكتملة</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><span class="ref">${r.ref || '—'}</span></td>
      <td><strong>${r.name || '—'}</strong></td>
      <td dir="ltr">${r.phone || '—'}</td>
      <td><strong>${fmt(r.amount || 0)} أوقية</strong></td>
      <td style="color:var(--green);font-weight:800">${fmt(r.receive || 0)} أوقية</td>
      <td>${r.fromBank || '—'} ← ${r.toBank || '—'}</td>
      <td style="font-size:.78rem">${fmtDate(r.createdAt)}</td>
      <td><span style="background:var(--green-light);color:var(--green);border-radius:99px;padding:.2rem .7rem;font-size:.78rem;font-weight:700">✅ مكتمل</span></td>
    </tr>`).join('');
}

function renderCompletedCards(data) {
  const tbody = document.getElementById('completedCardsBody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><div class="empty-icon">🎮</div>لا توجد طلبات مكتملة</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td><span class="ref">${r.ref || '—'}</span></td>
      <td><strong>${r.game || '—'}</strong></td>
      <td>${r.package || '—'}</td>
      <td style="color:var(--green);font-weight:800">${fmt(r.price || 0)} أوقية</td>
      <td style="font-size:.78rem">${fmtDate(r.createdAt)}</td>
      <td><span style="background:var(--green-light);color:var(--green);border-radius:99px;padding:.2rem .7rem;font-size:.78rem;font-weight:700">✅ مكتمل</span></td>
    </tr>`).join('');
}

function fmt(n) { return Number(n).toLocaleString('ar-MA'); }
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}