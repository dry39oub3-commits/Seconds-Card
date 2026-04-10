// ══════════════════════════════════════
// stocks.js — إدارة مخزون البطاقات
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allStock = [];

export function initStocks() {
  onSnapshot(query(collection(db, 'stock'), orderBy('createdAt', 'desc')), snap => {
    allStock = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStock();
    updateStockStats();
    updateCatFilter();
  });
}

function updateStockStats() {
  const avail = allStock.filter(s => s.status === 'available').length;
  const used  = allStock.filter(s => s.status === 'used').length;
  const cats  = new Set(allStock.map(s => s.category)).size;
  setEl('stTotal',      fmt(allStock.length));
  setEl('stAvail',      fmt(avail));
  setEl('stUsed',       fmt(used));
  setEl('stCategories', fmt(cats));
}

export function renderStock() {
  const catF    = document.getElementById('filterCat')?.value    || '';
  const statF   = document.getElementById('filterStatus')?.value || '';
  const searchF = (document.getElementById('searchStock')?.value || '').toLowerCase();
  const data    = allStock.filter(s => {
    if (catF   && s.category !== catF)  return false;
    if (statF  && s.status   !== statF) return false;
    if (searchF && !(s.code  || '').toLowerCase().includes(searchF)) return false;
    return true;
  });
  setEl('stockCount', `${fmt(data.length)} بطاقة`);
  const tbody = document.getElementById('stockBody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="empty-icon">📭</div>لا توجد بطاقات</div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(s => `
    <tr>
      <td><strong>${s.category || '—'}</strong></td>
      <td>${s.cardType || '—'}</td>
      <td>${s.value || '—'}</td>
      <td>${s.supplier || '—'}</td>
      <td><span class="code-cell" onclick="copyCode('${s.code}')" title="انقر للنسخ">${s.code || '—'}</span></td>
      <td style="font-size:.78rem">${fmtDate(s.createdAt)}</td>
      <td>
        <select class="status-select" onchange="changeStockStatus('${s.id}',this.value)">
          <option value="available" ${s.status === 'available' ? 'selected' : ''}>✅ متاح</option>
          <option value="used"      ${s.status === 'used'      ? 'selected' : ''}>📤 مستخدم</option>
        </select>
      </td>
      <td><button class="del-btn" onclick="deleteStock('${s.id}')">🗑️</button></td>
    </tr>`).join('');
}

function updateCatFilter() {
  const sel  = document.getElementById('filterCat');
  if (!sel) return;
  const cats = [...new Set(allStock.map(s => s.category).filter(Boolean))];
  const cur  = sel.value;
  sel.innerHTML = '<option value="">كل الفئات</option>'
    + cats.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${c}</option>`).join('');
}

export async function changeStockStatus(id, status) {
  try {
    await updateDoc(doc(db, 'stock', id), { status });
    showToast(status === 'available' ? '✅ متاح الآن' : '📤 تم تحديده كمستخدم');
  } catch { showToast('❌ خطأ في التحديث'); }
}

export async function deleteStock(id) {
  if (!confirm('هل أنت متأكد من حذف هذه البطاقة؟')) return;
  try { await deleteDoc(doc(db, 'stock', id)); showToast('🗑️ تم الحذف'); }
  catch { showToast('❌ خطأ في الحذف'); }
}

export function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => showToast('📋 تم نسخ الكود: ' + code));
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

window.changeStockStatus = changeStockStatus;
window.deleteStock       = deleteStock;
window.copyCode          = copyCode;
window.renderStock       = renderStock;