// ══════════════════════════════════════
// stats.js — إحصاءات وتقارير
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function initStats() {
  let transfers = [], cards = [], stock = [];

  onSnapshot(query(collection(db, 'transfers'), orderBy('createdAt', 'desc')), snap => {
    transfers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render(transfers, cards, stock);
  });
  onSnapshot(query(collection(db, 'cards'), orderBy('createdAt', 'desc')), snap => {
    cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render(transfers, cards, stock);
  });
  onSnapshot(query(collection(db, 'stock')), snap => {
    stock = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render(transfers, cards, stock);
  });
}

function render(transfers, cards, stock) {
  const allOrders = [...transfers, ...cards];
  const totalRev  = transfers.reduce((s, r) => s + (r.amount || 0), 0)
                  + cards.reduce((s, r) => s + (r.price || 0), 0);
  const totalComm = transfers.reduce((s, r) => s + (r.commission || 0), 0);

  setEl('statAllOrders',   fmt(allOrders.length));
  setEl('statPending',     fmt(allOrders.filter(r => r.status === 'pending').length));
  setEl('statDone',        fmt(allOrders.filter(r => r.status === 'done').length));
  setEl('statRevenue',     fmt(Math.round(totalRev)) + ' أوقية');
  setEl('statCommission',  fmt(Math.round(totalComm)) + ' أوقية');
  setEl('statStockTotal',  fmt(stock.length));
  setEl('statStockAvail',  fmt(stock.filter(s => s.status === 'available').length));
  setEl('statStockUsed',   fmt(stock.filter(s => s.status === 'used').length));

  // Recent activity table
  const tbody = document.getElementById('recentBody');
  if (tbody) {
    const recent = allOrders.slice(0, 10);
    tbody.innerHTML = recent.map(r => `
      <tr>
        <td><span class="ref">${r.ref || '—'}</span></td>
        <td>${r.name || r.game || '—'}</td>
        <td>${r.amount ? fmt(r.amount) + ' أوقية' : (r.price ? fmt(r.price) + ' أوقية' : '—')}</td>
        <td style="font-size:.78rem">${fmtDate(r.createdAt)}</td>
        <td><span class="status-badge status-${r.status}">${statusLabel(r.status)}</span></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">لا توجد بيانات</td></tr>`;
  }
}

function statusLabel(s) {
  return { pending: '⏳ معلق', done: '✅ مكتمل', rejected: '❌ مرفوض' }[s] || s;
}

function fmt(n)    { return Number(n).toLocaleString('ar-MA'); }
function setEl(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}