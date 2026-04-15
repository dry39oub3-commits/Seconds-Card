import { supabase } from '../../js/supabase-config.js';

let allProducts = [];
let allStocks   = [];
let filteredStocks = [];
let currentPage = 1;
const PAGE_SIZE = 30;

// =================== INIT ===================
document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  await loadStocks();
  updateLastRefresh();
  updateCodeCounter();
  document.getElementById('fill-codes').addEventListener('input', updateCodeCounter);
  scheduleMidnightReset(); // [FIX 3] جدولة إعادة التعيين عند منتصف الليل
});

async function refreshAll() {
  await loadProducts();
  await loadStocks();
  updateLastRefresh();
  showToast('✅ تم التحديث');
}
window.refreshAll = refreshAll;

// =================== LOAD PRODUCTS ===================
async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');

  if (error) { showToast('خطأ في تحميل المنتجات', true); return; }
  allProducts = data || [];

  // Fill product selects
  const opts = allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('fill-product').innerHTML = '<option value="">-- اختر منتجاً --</option>' + opts;
  document.getElementById('inv-product-filter').innerHTML = '<option value="">كل المنتجات</option>' +
    allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function loadPricesForProduct() {
  const pid = document.getElementById('fill-product').value;
  const product = allProducts.find(p => String(p.id) === String(pid));
  const priceSelect = document.getElementById('fill-price');
  const supSelect   = document.getElementById('fill-supplier');

  priceSelect.innerHTML = '<option value="">-- اختر الفئة --</option>';
  supSelect.innerHTML   = '<option value="">-- اختر المورد --</option>';

  // إخفاء بطاقة الربح عند تغيير المنتج
  document.getElementById('profit-card').style.display = 'none';

  if (!product) return;

  const prices = Array.isArray(product.prices) ? product.prices : Object.values(product.prices || {});

  prices.forEach((pr, i) => {
    if (pr.active !== false) {
      priceSelect.innerHTML += `<option value="${i}">${pr.label} – ${pr.value} MRU</option>`;
    }
  });

  // remove old listener before adding new one
  const newPriceSelect = priceSelect.cloneNode(true);
  priceSelect.parentNode.replaceChild(newPriceSelect, priceSelect);

  // listener واحد فقط بعد الـ clone
  document.getElementById('fill-price').addEventListener('change', () => {
    loadSuppliersForPrice();
    calcProfit();
  });
}
window.loadPricesForProduct = loadPricesForProduct;

function loadSuppliersForPrice() {
  const pid = document.getElementById('fill-product').value;
  const product = allProducts.find(p => String(p.id) === String(pid));
  const priceIdx = document.getElementById('fill-price').value;
  const supSelect = document.getElementById('fill-supplier');

  // إزالة زر الشراء القديم إن وجد
  document.getElementById('buy-btn')?.remove();

  supSelect.innerHTML = '<option value="">-- اختر المورد --</option>';

  if (!product || priceIdx === '') return;

  const prices = Array.isArray(product.prices)
    ? product.prices
    : Object.values(product.prices || {});

  const selectedPrice = prices[priceIdx];
  if (!selectedPrice) return;

  const suppliers = selectedPrice.suppliers || [];

  suppliers.forEach((s, i) => {
    if (s.name && s.url) {
      supSelect.innerHTML += `<option value="${i}">${s.name}</option>`;
    }
  });

  // إضافة listener لظهور زر الشراء عند اختيار مورد
  const newSupSelect = supSelect.cloneNode(true);
  supSelect.parentNode.replaceChild(newSupSelect, supSelect);

  document.getElementById('fill-supplier').addEventListener('change', function () {
    // إزالة زر قديم
    document.getElementById('buy-btn')?.remove();

    const si = this.value;
    if (si === '') return;

    const supplier = suppliers[si];
    if (!supplier?.url) return;

    // إنشاء زر الشراء
    const btn = document.createElement('a');
    btn.id = 'buy-btn';
    btn.href = supplier.url;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.textContent = '🛒 شراء';
    btn.style.cssText = `
      display: inline-block;
      margin-top: 12px;
      padding: 10px 24px;
      background: #22c55e;
      color: white;
      border-radius: 10px;
      font-size: 15px;
      font-weight: bold;
      text-decoration: none;
      cursor: pointer;
    `;

    // أضف الزر بعد select المورد
    this.parentNode.appendChild(btn);
  });
}

// =================== LOAD STOCKS ===================
// =================== LOAD STOCKS ===================
async function loadStocks() {
  // جلب الأكواد المتاحة للجدول
  const { data: availableData, error: e1 } = await supabase
    .from('stocks')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  if (e1) { showToast('خطأ في تحميل المخزون', true); return; }

  // جلب الأكواد المباعة خلال آخر 24 ساعة للإحصاء فقط
  const ago24ISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: soldData } = await supabase
    .from('stocks')
    .select('id, status, sold_at, product_name, price_label, price_value, product_id')
    .eq('status', 'sold')
    .gte('sold_at', ago24ISO);

  allStocks      = availableData || [];
  window._soldLast24 = soldData || [];   // نحفظها منفصلة للإحصاء

  filteredStocks = [...allStocks];
  currentPage    = 1;
  renderInventoryTable();
  renderStats();
}

// =================== SUBMIT CODES ===================
async function submitCodes() {
  const pid      = document.getElementById('fill-product').value;
  const pidx     = document.getElementById('fill-price').value;
  const sidx     = document.getElementById('fill-supplier').value;
  const orderVal = document.getElementById('fill-order-id').value.trim();
  const costVal  = document.getElementById('fill-cost').value.trim();
  const qtyVal   = document.getElementById('fill-qty').value.trim();
  const raw      = document.getElementById('fill-codes').value;

  // [FIX 1] التحقق من جميع الحقول الإلزامية
  const errors = [];

  if (!pid) {
    highlightError('fill-product');
    errors.push('المنتج');
  }
  if (pidx === '') {
    highlightError('fill-price');
    errors.push('الفئة السعرية');
  }
  if (!sidx && sidx !== 0) {
    highlightError('fill-supplier');
    errors.push('المورد');
  }
  if (!orderVal) {
    highlightError('fill-order-id');
    errors.push('Order ID');
  }
  if (!costVal || parseFloat(costVal) <= 0) {
    highlightError('fill-cost');
    errors.push('تكلفة الشراء');
  }
  if (!qtyVal || parseInt(qtyVal) <= 0) {
    highlightError('fill-qty');
    errors.push('عدد الكمية');
  }

  const codes = [...new Set(
    raw.split('\n').map(c => c.trim()).filter(c => c.length > 0)
  )];

  if (codes.length === 0) {
    highlightError('fill-codes');
    errors.push('الأكواد');
  }

  if (errors.length > 0) {
    showToast(`⚠️ يرجى تعبئة: ${errors.join('، ')}`, true);
    return;
  }

  const product = allProducts.find(p => String(p.id) === String(pid));
  if (!product) { showToast('⚠️ المنتج غير موجود', true); return; }

  const prices = Array.isArray(product.prices) ? product.prices : Object.values(product.prices || {});
  const price  = prices[pidx];
  if (!price) { showToast('⚠️ الفئة السعرية غير موجودة', true); return; }

  const supplier = sidx !== '' ? (price.suppliers?.[sidx] || null) : null;

  // [FIX 2] حساب تكلفة البطاقة الواحدة بالدولار لحفظها مع كل كود
  const costPerCardUSD = parseFloat(costVal) / parseInt(qtyVal);

  const rows = codes.map(code => ({
    product_id:       pid,
    product_name:     product.name,
    price_label:      price.label,
    price_value:      price.value,
    supplier_name:    supplier ? supplier.name : null,
    order_id:         orderVal || null,
    cost_per_card_usd: costPerCardUSD,   // [FIX 2] تكلفة البطاقة الواحدة
    code:             code,
    status:           'available',
    created_at:       new Date().toISOString()
  }));

  // Progress
  const bar  = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  bar.style.display = 'block';
  fill.style.width  = '10%';

  // Batch insert (chunks of 100)
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('stocks').insert(chunk);
    if (error) {
      bar.style.display = 'none';
      showToast('خطأ في الإدراج: ' + error.message, true);
      return;
    }
    inserted += chunk.length;
    fill.style.width = Math.round((inserted / rows.length) * 100) + '%';
  }

  bar.style.display = 'none';
  fill.style.width  = '0%';
  document.getElementById('fill-codes').value = '';
  updateCodeCounter();
  showToast(`✅ تم رفع ${inserted} كود بنجاح!`);
  await loadStocks();

      const today = new Date().toDateString();
    const saved = JSON.parse(localStorage.getItem('stockStats') || '{}');

    if (saved.date !== today) {
        // يوم جديد — ابدأ من صفر
        localStorage.setItem('stockStats', JSON.stringify({
            date: today,
            added: inserted,
            cost: parseFloat(costVal)
        }));
    } else {
        // نفس اليوم — أضف للموجود
        localStorage.setItem('stockStats', JSON.stringify({
            date: today,
            added: (saved.added || 0) + inserted,
            cost: (saved.cost || 0) + parseFloat(costVal)
        }));
    }

    showToast(`✅ تم رفع ${inserted} كود بنجاح!`);
    await loadStocks();

}
window.submitCodes = submitCodes;

// [FIX 1] دالة مساعدة لإظهار تأثير الخطأ على الحقل
function highlightError(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('error-glow');
  el.focus();
  setTimeout(() => el.classList.remove('error-glow'), 1500);
}

// =================== INVENTORY TABLE ===================
function filterInventory() {
  const q       = document.getElementById('inv-search').value.toLowerCase();
  const prodId  = document.getElementById('inv-product-filter').value;
  const status  = document.getElementById('inv-status-filter').value;

  filteredStocks = allStocks.filter(s => {
    const matchQ    = !q || (s.code || '').toLowerCase().includes(q) || (s.order_id || '').toLowerCase().includes(q);
    const matchProd = !prodId || String(s.product_id) === String(prodId);
    const matchSt   = !status || s.status === status;
    return matchQ && matchProd && matchSt;
  });

  currentPage = 1;
  renderInventoryTable();
}
window.filterInventory = filterInventory;

function renderInventoryTable() {
  const tbody = document.getElementById('inv-tbody');
  const total = filteredStocks.length;

  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-box-open"></i>لا توجد أكواد</div></td></tr>`;
    document.getElementById('inv-pagination').innerHTML = '';
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = filteredStocks.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = paged.map((s, i) => {
    // [FIX 2] عرض تكلفة البطاقة الواحدة
    const costDisplay = s.cost_per_card_usd != null
      ? `<span style="color:var(--warning); font-weight:600;">${parseFloat(s.cost_per_card_usd).toFixed(3)} $</span>`
      : '<span style="color:var(--text-muted)">—</span>';

    return `
      <tr>
        <td style="color:var(--text-muted)">${start + i + 1}</td>
        <td>${s.product_name || '—'}</td>
        <td>${s.price_label || '—'}</td>
        <td>${s.supplier_name || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${s.order_id || '<span style="color:var(--text-muted)">—</span>'}</td>
        <td class="code-cell" title="${s.code}" style="text-align: center; vertical-align: middle;">
            ${s.code.length > 3 
              ? s.code[0] + 'x'.repeat(8) + s.code.slice(-2) 
              : s.code}
        </td>
        <td style="text-align:center;">${costDisplay}</td>
        <td style="color:var(--text-muted); font-size:12px;">${formatDate(s.created_at)}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn-danger" title="حذف" onclick="deleteStock('${s.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(total);
}

function statusBadge(status) {
  if (status === 'sold')     return '<span class="badge badge-sold">مباع</span>';
  if (status === 'reserved') return '<span class="badge badge-reserved">محجوز</span>';
  return '<span class="badge badge-active">متاح</span>';
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);

  const datePart = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');

  const timePart = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${datePart}<br>${timePart}`;
}

function renderPagination(total) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const pg = document.getElementById('inv-pagination');
  if (pages <= 1) { pg.innerHTML = ''; return; }

  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" onclick="goPage(${currentPage-1})">‹ السابق</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - currentPage) <= 1) {
      html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += `<span style="color:var(--text-muted)">…</span>`;
    }
  }
  if (currentPage < pages) html += `<button class="page-btn" onclick="goPage(${currentPage+1})">التالي ›</button>`;
  pg.innerHTML = html;
}

function goPage(n) { currentPage = n; renderInventoryTable(); window.scrollTo(0,0); }
window.goPage = goPage;

// =================== DELETE ===================
async function deleteStock(id) {
  if (!confirm('حذف هذا الكود نهائياً؟')) return;
  const { error } = await supabase.from('stocks').delete().eq('id', id);
  if (error) showToast('خطأ: ' + error.message, true);
  else { showToast('🗑️ تم الحذف'); await loadStocks(); }
}
window.deleteStock = deleteStock;

// =================== STATS ===================
function renderStats() {
    const now   = new Date();
    const today = now.toDateString();

    const total  = allStocks.length;
    // ✅ الآن من البيانات المجلوبة منفصلاً
    const sold24 = (window._soldLast24 || []).length;

    // ✅ اقرأ من localStorage بدل حساب من الجدول
    const saved = JSON.parse(localStorage.getItem('stockStats') || '{}');
    const isSameDay = saved.date === today;

    const addedToday = isSameDay ? (saved.added || 0) : 0;
    const costToday  = isSameDay ? (saved.cost || 0) : 0;

    // تحويل التكلفة من $ إلى MRU
    const costTodayMRU = (costToday * 43).toFixed(0);

    document.getElementById('stat-total').textContent  = total.toLocaleString();
    document.getElementById('stat-sold24').textContent = sold24.toLocaleString();
    document.getElementById('stat-cost').textContent   = Number(costTodayMRU).toLocaleString() + ' MRU';
    document.getElementById('stat-added').textContent  = addedToday.toLocaleString();

  // Per product
  const map = {};
  allStocks.forEach(s => {
    const key = `${s.product_id}||${s.price_label}`;
    if (!map[key]) map[key] = { name: s.product_name, label: s.price_label, value: s.price_value || 0, total:0, available:0, sold:0, reserved:0 };
    map[key].total++;
    map[key][s.status] = (map[key][s.status] || 0) + 1;
  });

  const tbody = document.getElementById('stats-tbody');
  const rows  = Object.values(map);
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-chart-bar"></i>لا توجد بيانات</div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.label}</td>
      <td><strong>${r.total}</strong></td>
      <td style="color:var(--success)">${r.available || 0}</td>
      <td style="color:var(--danger)">${r.sold || 0}</td>
      <td style="color:var(--warning)">${r.reserved || 0}</td>
      <td style="color:var(--warning)">${(r.total * r.value).toLocaleString()} MRU</td>
    </tr>
  `).join('');
}
window.renderStats = renderStats;

// =================== [FIX 3] جدولة إعادة التعيين التلقائي عند 00:00 ===================
function scheduleMidnightReset() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const msUntilMidnight = midnight - now;

    setTimeout(() => {
        // ✅ مسح إحصائيات اليوم عند منتصف الليل
        localStorage.removeItem('stockStats');
        renderStats();
        showToast('🔄 تم تحديث إحصائيات اليوم الجديد');

        setInterval(() => {
            localStorage.removeItem('stockStats');
            renderStats();
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
}

// =================== EXPORT CSV ===================
function exportCSV() {
  if (filteredStocks.length === 0) { showToast('لا توجد بيانات للتصدير', true); return; }
  // [FIX 2] إضافة عمود تكلفة البطاقة في التصدير
  const headers = ['#','المنتج','الفئة','المورد','Order ID','الكود','تكلفة البطاقة ($)','الحالة','التاريخ'];
  const rows = filteredStocks.map((s,i) => [
    i+1, s.product_name, s.price_label, s.supplier_name || '', s.order_id || '',
    s.code,
    s.cost_per_card_usd != null ? parseFloat(s.cost_per_card_usd).toFixed(3) : '',
    s.status,
    s.created_at ? new Date(s.created_at).toLocaleString('ar-SA') : ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'stocks.csv'; a.click();
  URL.revokeObjectURL(url);
}
window.exportCSV = exportCSV;

// =================== HELPERS ===================
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.currentTarget.classList.add('active');
  if (name === 'stats') renderStats();
}
window.switchTab = switchTab;

function updateCodeCounter() {
  const raw = document.getElementById('fill-codes').value;
  const count = raw.split('\n').map(c => c.trim()).filter(c => c.length > 0).length;
  document.getElementById('fill-count').textContent = count > 0 ? `${count} كود جاهز للرفع` : '';
}

function updateLastRefresh() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  document.getElementById('last-refresh').textContent = 'Dernière mise à jour: ' + timeStr;
}

function showToast(msg, isError = false) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.4s';
    setTimeout(() => t.remove(), 400);
  }, 2500);
}

window.calcProfit = function() {
  const totalCost = parseFloat(document.getElementById('fill-cost')?.value) || 0;
  const qty       = parseInt(document.getElementById('fill-qty')?.value)    || 0;

  const pid     = document.getElementById('fill-product')?.value;
  const pidx    = document.getElementById('fill-price')?.value;
  const product = allProducts.find(p => String(p.id) === String(pid));

  const prices = product
    ? (Array.isArray(product.prices) ? product.prices : Object.values(product.prices || {}))
    : [];

  const sellPrice = (pidx !== '' && pidx !== undefined && prices[pidx])
    ? parseFloat(prices[pidx].value) || 0
    : 0;

  const card = document.getElementById('profit-card');

  if (totalCost > 0 && qty > 0 && sellPrice > 0) {
    const costPerCard   = totalCost / qty;
    const profitPerCard = sellPrice - (costPerCard * 43);
    const profitTotal   = profitPerCard * qty;

    const isProfit = profitPerCard >= 0;
    const color    = isProfit ? 'var(--success)' : 'var(--danger)';

    card.style.display     = 'block';
    card.style.borderColor = color;

    document.getElementById('cost-per-card-usd').textContent = costPerCard.toFixed(2) + ' $';
    document.getElementById('cost-per-card-mru').textContent = (costPerCard * 43).toFixed(2) + ' MRU';

    document.getElementById('profit-per-card-mru').textContent = profitPerCard.toFixed(2) + ' MRU';
    document.getElementById('profit-per-card-mru').style.color = color;
    document.getElementById('profit-per-card-usd').textContent = (profitPerCard / 43).toFixed(2) + ' $';
    document.getElementById('profit-per-card-usd').style.color = color;

    document.getElementById('profit-total-mru').textContent = profitTotal.toFixed(2) + ' MRU';
    document.getElementById('profit-total-mru').style.color = profitTotal >= 0 ? 'var(--accent)' : 'var(--danger)';
    document.getElementById('profit-total-usd').textContent = (profitTotal / 43).toFixed(2) + ' $';
    document.getElementById('profit-total-usd').style.color = profitTotal >= 0 ? 'var(--accent)' : 'var(--danger)';

    document.getElementById('cost-total').textContent = totalCost.toFixed(2) + ' $';
  } else {
    card.style.display = 'none';
  }
};