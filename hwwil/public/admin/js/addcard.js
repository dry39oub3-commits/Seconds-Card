// ══════════════════════════════════════
// add-card.js — إضافة بطاقات للمخزون
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CARD_OPTIONS = {
  'Apple':       ['iTunes 10$','iTunes 25$','iTunes 50$','iTunes 100$','App Store 5$','App Store 15$'],
  'Google Play': ['Google Play 5$','Google Play 10$','Google Play 25$','Google Play 50$'],
  'Netflix':     ['Netflix 1 شهر','Netflix 3 أشهر','Netflix 6 أشهر','Netflix سنة'],
  'PlayStation': ['PSN 10$','PSN 20$','PSN 50$','PSN 100$','PS Plus شهر','PS Plus سنة'],
  'PUBG':        ['60 UC','325 UC','660 UC','1800 UC','3850 UC','8100 UC'],
  'Free Fire':   ['100 جوهرة','310 جوهرة','520 جوهرة','1060 جوهرة','2180 جوهرة'],
  'Steam':       ['Steam 5$','Steam 10$','Steam 20$','Steam 50$','Steam 100$'],
  'أخرى':        ['مخصص'],
};

let selectedCat = 'Apple';

export function initAddCard() {
  updateCardOptions();
  document.getElementById('codesArea')?.addEventListener('input', () => {
    const codes = getCodes();
    document.getElementById('codesCount').textContent = codes.length + ' كود';
    updatePreview();
  });
}

export function selectCat(el) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedCat = el.dataset.cat;
  document.getElementById('customCat').style.display = selectedCat === 'أخرى' ? 'block' : 'none';
  updateCardOptions();
}

export function updateCardOptions() {
  const opts = CARD_OPTIONS[selectedCat] || ['مخصص'];
  const sel  = document.getElementById('cardType');
  sel.innerHTML = '<option value="">— اختر نوع البطاقة —</option>'
    + opts.map(o => `<option value="${o}">${o}</option>`).join('');
  updatePreview();
}

function getCodes() {
  return (document.getElementById('codesArea')?.value || '')
    .split('\n').map(c => c.trim()).filter(c => c.length > 0);
}

function updatePreview() {
  const codes    = getCodes();
  const cardType = document.getElementById('cardType')?.value;
  const supplier = document.getElementById('supplier')?.value.trim();
  const box      = document.getElementById('previewBox');
  if (!box) return;
  if (!codes.length || !cardType) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  const preview = codes.slice(0, 3).map(c => `<div class="code-preview">${c}</div>`).join('');
  const more    = codes.length > 3 ? `<div style="font-size:.78rem;color:var(--muted);margin-top:.3rem">+${codes.length - 3} كود...</div>` : '';
  document.getElementById('previewContent').innerHTML = `
    <div style="font-size:.82rem;color:var(--mid);margin-bottom:.5rem">
      <strong>${selectedCat}</strong> — ${cardType} ${supplier ? '| المورد: ' + supplier : ''}
    </div>${preview}${more}
    <div style="margin-top:.6rem;font-size:.82rem;font-weight:800;color:var(--green)">إجمالي: ${codes.length} بطاقة</div>`;
}

export function clearCodes() {
  document.getElementById('codesArea').value = '';
  document.getElementById('codesCount').textContent = '٠ كود';
  document.getElementById('previewBox').style.display = 'none';
}

export async function saveStock() {
  const cardType = document.getElementById('cardType')?.value;
  const supplier = document.getElementById('supplier')?.value.trim();
  const codes    = getCodes();
  const cat      = selectedCat === 'أخرى'
    ? (document.getElementById('customCat')?.value.trim() || 'أخرى')
    : selectedCat;

  if (!cardType) { showToast('⚠️ اختر نوع البطاقة أولاً'); return; }
  if (!codes.length) { showToast('⚠️ أدخل كود واحد على الأقل'); return; }

  const btn = document.getElementById('saveStockBtn');
  btn.disabled = true; btn.textContent = '⏳ جاري الحفظ...';
  try {
    await Promise.all(codes.map(code =>
      addDoc(collection(db, 'stock'), {
        category: cat, cardType, value: cardType,
        supplier: supplier || 'غير محدد',
        code, status: 'available', createdAt: serverTimestamp()
      })
    ));
    showToast(`✅ تم حفظ ${codes.length} بطاقة!`);
    clearCodes();
  } catch (e) { showToast('❌ خطأ في الحفظ'); }
  btn.disabled = false; btn.textContent = '💾 حفظ البطاقات في المخزون';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Expose to window for HTML onclick
window.selectCat       = selectCat;
window.updateCardOptions = updateCardOptions;
window.clearCodes      = clearCodes;
window.saveStock       = saveStock;