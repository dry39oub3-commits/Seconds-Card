import { supabase } from '../../js/supabase-config.js';

let allProducts    = [];
let allStocks      = [];
let filteredStocks = [];
let currentPage    = 1;
const PAGE_SIZE    = 30;
const STATS_ID     = '25d7253c-c081-4a2f-b589-adcfa900b3f0';

// ==================== إحصائيات السحابية ====================
async function saveStockStats(added, cost) {
    const today = new Date().toDateString();
    const { data: existing } = await supabase
        .from('stock_stats').select('*').eq('id', STATS_ID).single();

    const isSameDay = existing?.date === today;
    await supabase.from('stock_stats').update({
        date:       today,
        added:      isSameDay ? (existing.added || 0) + added : added,
        cost:       isSameDay ? (existing.cost  || 0) + cost  : cost,
        updated_at: new Date().toISOString()
    }).eq('id', STATS_ID);
}

async function getStockStats() {
    const today = new Date().toDateString();
    const { data } = await supabase
        .from('stock_stats').select('*').eq('id', STATS_ID).single();
    if (!data || data.date !== today) return { added: 0, cost: 0 };
    return { added: data.added || 0, cost: data.cost || 0 };
}

// =================== INIT ===================
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    await loadStocks();
    updateLastRefresh();
    updateCodeCounter();
    document.getElementById('fill-codes').addEventListener('input', updateCodeCounter);
    scheduleMidnightReset();
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
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) { showToast('خطأ في تحميل المنتجات', true); return; }
    allProducts = data || [];

    const opts = allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById('fill-product').innerHTML = '<option value="">-- اختر منتجاً --</option>' + opts;
    document.getElementById('inv-product-filter').innerHTML = '<option value="">كل المنتجات</option>' +
        allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function loadPricesForProduct() {
    const pid     = document.getElementById('fill-product').value;
    const product = allProducts.find(p => String(p.id) === String(pid));
    const priceSelect = document.getElementById('fill-price');
    const supSelect   = document.getElementById('fill-supplier');

    priceSelect.innerHTML = '<option value="">-- اختر الفئة --</option>';
    supSelect.innerHTML   = '<option value="">-- اختر المورد --</option>';
    document.getElementById('profit-card').style.display = 'none';

    if (!product) return;

    const prices = Array.isArray(product.prices) ? product.prices : Object.values(product.prices || {});
    prices.forEach((pr, i) => {
        if (pr.active !== false)
            priceSelect.innerHTML += `<option value="${i}">${pr.label} – ${pr.value} MRU</option>`;
    });

    const newPriceSelect = priceSelect.cloneNode(true);
    priceSelect.parentNode.replaceChild(newPriceSelect, priceSelect);
    document.getElementById('fill-price').addEventListener('change', () => {
        loadSuppliersForPrice();
        calcProfit();
    });
}
window.loadPricesForProduct = loadPricesForProduct;

function loadSuppliersForPrice() {
    const pid      = document.getElementById('fill-product').value;
    const product  = allProducts.find(p => String(p.id) === String(pid));
    const priceIdx = document.getElementById('fill-price').value;
    const supSelect = document.getElementById('fill-supplier');

    document.getElementById('buy-btn')?.remove();
    supSelect.innerHTML = '<option value="">-- اختر المورد --</option>';
    if (!product || priceIdx === '') return;

    const prices = Array.isArray(product.prices) ? product.prices : Object.values(product.prices || {});
    const selectedPrice = prices[priceIdx];
    if (!selectedPrice) return;

    const suppliers = selectedPrice.suppliers || [];
    suppliers.forEach((s, i) => {
        if (s.name && s.url)
            supSelect.innerHTML += `<option value="${i}">${s.name}</option>`;
    });

    const newSupSelect = supSelect.cloneNode(true);
    supSelect.parentNode.replaceChild(newSupSelect, supSelect);

    document.getElementById('fill-supplier').addEventListener('change', function () {
        document.getElementById('buy-btn')?.remove();
        const si = this.value;
        if (si === '') return;
        const supplier = suppliers[si];
        if (!supplier?.url) return;

        const btn = document.createElement('a');
        btn.id = 'buy-btn';
        btn.href = supplier.url;
        btn.target = '_blank';
        btn.rel = 'noopener noreferrer';
        btn.textContent = '🛒 شراء';
        btn.style.cssText = `
            display:inline-block; margin-top:12px; padding:10px 24px;
            background:#22c55e; color:white; border-radius:10px;
            font-size:15px; font-weight:bold; text-decoration:none; cursor:pointer;
        `;
        this.parentNode.appendChild(btn);
    });
}

// =================== LOAD STOCKS ===================
async function loadStocks() {
    const { data: availableData, error: e1 } = await supabase
        .from('stocks').select('*').eq('status', 'available')
        .order('created_at', { ascending: false });

    if (e1) { showToast('خطأ في تحميل المخزون', true); return; }

    const ago24ISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: soldData } = await supabase
        .from('stocks')
        .select('id, status, sold_at, product_name, price_label, price_value, product_id')
        .eq('status', 'sold').gte('sold_at', ago24ISO);

    allStocks          = availableData || [];
    window._soldLast24 = soldData || [];
    filteredStocks     = [...allStocks];
    currentPage        = 1;
    renderInventoryTable();
    await renderStats();
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

    const errors = [];
    if (!pid)                                  { highlightError('fill-product');  errors.push('المنتج'); }
    if (pidx === '')                           { highlightError('fill-price');    errors.push('الفئة السعرية'); }
    if (!sidx && sidx !== 0)                   { highlightError('fill-supplier'); errors.push('المورد'); }
    if (!orderVal)                             { highlightError('fill-order-id'); errors.push('Order ID'); }
    if (!costVal || parseFloat(costVal) <= 0)  { highlightError('fill-cost');    errors.push('تكلفة الشراء'); }
    if (!qtyVal  || parseInt(qtyVal)   <= 0)  { highlightError('fill-qty');     errors.push('عدد الكمية'); }

    let codes = [...new Set(raw.split('\n').map(c => c.trim()).filter(c => c.length > 0))];
    if (codes.length === 0) { highlightError('fill-codes'); errors.push('الأكواد'); }

    if (errors.length > 0) { showToast(`⚠️ يرجى تعبئة: ${errors.join('، ')}`, true); return; }

    const product = allProducts.find(p => String(p.id) === String(pid));
    if (!product) { showToast('⚠️ المنتج غير موجود', true); return; }

    const prices = Array.isArray(product.prices) ? product.prices : Object.values(product.prices || {});
    const price  = prices[pidx];
    if (!price) { showToast('⚠️ الفئة السعرية غير موجودة', true); return; }

    const supplier       = sidx !== '' ? (price.suppliers?.[sidx] || null) : null;
    const costPerCardUSD = parseFloat(costVal) / parseInt(qtyVal);

    const bar  = document.getElementById('progress-bar');
    const fill = document.getElementById('progress-fill');

    const { data: existingCodes } = await supabase.from('stocks').select('code, status').in('code', codes);
    const duplicates = (existingCodes || []).filter(c => c.status === 'available' || c.status === 'sold');

    if (duplicates.length > 0) {
        const dupSet    = new Set(duplicates.map(c => c.code));
        const textarea  = document.getElementById('fill-codes');
        const lines     = textarea.value.split('\n');
        let dupDisplay  = document.getElementById('dup-codes-display');
        if (!dupDisplay) {
            dupDisplay = document.createElement('div');
            dupDisplay.id = 'dup-codes-display';
            textarea.parentNode.insertBefore(dupDisplay, textarea.nextSibling);
        }
        dupDisplay.innerHTML = `
            <div style="margin-top:10px;padding:12px;background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:8px;">
                <div style="font-size:13px;color:#ef4444;font-weight:700;margin-bottom:8px;">
                    ❌ تم إيقاف الرفع — ${duplicates.length} كود موجود مسبقاً:
                </div>
                <div style="font-family:monospace;font-size:13px;display:flex;flex-direction:column;gap:4px;">
                    ${lines.map(line => {
                        const code = line.trim();
                        if (dupSet.has(code))
                            return `<span style="background:rgba(239,68,68,0.2);color:#ef4444;padding:3px 8px;border-radius:4px;border-left:3px solid #ef4444;">⚠️ ${code} — موجود مسبقاً</span>`;
                        return `<span style="color:#22c55e;padding:3px 8px;">✅ ${code}</span>`;
                    }).filter(l => l.trim()).join('')}
                </div>
                <button onclick="document.getElementById('dup-codes-display').remove()"
                    style="margin-top:10px;padding:6px 14px;background:#334155;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;">
                    إغلاق
                </button>
            </div>`;
        showToast(`❌ يوجد ${duplicates.length} كود مكرر — تم إيقاف الرفع`, true);
        return;
    }

    if (codes.length !== parseInt(qtyVal)) {
        showToast(`❌ عدد الأكواد (${codes.length}) لا يطابق الكمية (${qtyVal})!`, true);
        highlightError('fill-codes'); highlightError('fill-qty');
        return;
    }

    const rows = codes.map(code => ({
        product_id:        pid,
        product_name:      product.name,
        price_label:       price.label,
        price_value:       price.value,
        supplier_name:     supplier ? supplier.name : null,
        order_id:          orderVal || null,
        cost_per_card_usd: costPerCardUSD,
        code,
        status:    'available',
        created_at: new Date().toISOString()
    }));

    bar.style.display = 'block';
    fill.style.width  = '10%';

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

    // ✅ حفظ الإحصائيات في السحابة
    await saveStockStats(inserted, parseFloat(costVal));

    showToast(`✅ تم رفع ${inserted} كود بنجاح!`);
    await loadStocks();
}
window.submitCodes = submitCodes;

function highlightError(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.add('error-glow');
    el.focus();
    setTimeout(() => el.classList.remove('error-glow'), 1500);
}

// =================== INVENTORY TABLE ===================
function filterInventory() {
    const q      = document.getElementById('inv-search').value.toLowerCase();
    const prodId = document.getElementById('inv-product-filter').value;
    const status = document.getElementById('inv-status-filter').value;

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
        const costDisplay = s.cost_per_card_usd != null
            ? `<span style="color:var(--warning);font-weight:600;">${parseFloat(s.cost_per_card_usd).toFixed(3)} $</span>`
            : '<span style="color:var(--text-muted)">—</span>';

        return `
        <tr>
            <td style="color:var(--text-muted)">${start + i + 1}</td>
            <td>${s.product_name || '—'}</td>
            <td>${s.price_label || '—'}</td>
            <td>${s.supplier_name || '<span style="color:var(--text-muted)">—</span>'}</td>
            <td>${s.order_id || '<span style="color:var(--text-muted)">—</span>'}</td>
            <td class="code-cell" style="text-align:center;vertical-align:middle;">
                ${s.code.length > 3 ? s.code[0] + 'x'.repeat(8) + s.code.slice(-2) : 'x'.repeat(s.code.length)}
            </td>
            <td style="text-align:center;">${costDisplay}</td>
            <td style="color:var(--text-muted);font-size:12px;">${formatDate(s.created_at)}</td>
            <td>
                ${s.notes
                    ? `<span style="display:inline-flex;align-items:center;gap:4px;
                            background:rgba(245,158,11,0.12);color:#fbbf24;
                            border:1px solid rgba(245,158,11,0.3);
                            padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;"
                            title="${s.notes}">↩️ مسترد</span>`
                    : '<span style="color:#334155;">—</span>'}
            </td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn-danger" title="حذف" onclick="deleteStock('${s.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderPagination(total);
}

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g, '-');
    const timePart = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    return `${datePart}<br>${timePart}`;
}

function renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const pg    = document.getElementById('inv-pagination');
    if (pages <= 1) { pg.innerHTML = ''; return; }

    let html = '';
    if (currentPage > 1) html += `<button class="page-btn" onclick="goPage(${currentPage-1})">‹ السابق</button>`;
    for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || Math.abs(i - currentPage) <= 1)
            html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
        else if (Math.abs(i - currentPage) === 2)
            html += `<span style="color:var(--text-muted)">…</span>`;
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
async function renderStats() {
    const total  = allStocks.length;
    const sold24 = (window._soldLast24 || []).length;

    // ✅ جلب الإحصائيات من السحابة
    const { added: addedToday, cost: costToday } = await getStockStats();
    const costTodayMRU = (costToday * 43).toFixed(0);

    document.getElementById('stat-total').textContent  = total.toLocaleString();
    document.getElementById('stat-sold24').textContent = sold24.toLocaleString();
    document.getElementById('stat-cost').textContent   = Number(costTodayMRU).toLocaleString() + ' MRU';
    document.getElementById('stat-added').textContent  = addedToday.toLocaleString();

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
            <td style="color:var(--warning)">${(r.total * r.value).toLocaleString()} MRU</td>
        </tr>`).join('');
}
window.renderStats = renderStats;

// =================== جدولة إعادة التعيين عند 00:00 ===================
function scheduleMidnightReset() {
    const now      = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const msUntilMidnight = midnight - now;

    setTimeout(async () => {
        // ✅ مسح الإحصائيات في السحابة
        await supabase.from('stock_stats').update({
            date: '', added: 0, cost: 0
        }).eq('id', STATS_ID);

        await renderStats();
        showToast('🔄 تم تحديث إحصائيات اليوم الجديد');

        setInterval(async () => {
            await supabase.from('stock_stats').update({
                date: '', added: 0, cost: 0
            }).eq('id', STATS_ID);
            await renderStats();
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
}

// =================== EXPORT CSV ===================
function exportCSV() {
    if (filteredStocks.length === 0) { showToast('لا توجد بيانات للتصدير', true); return; }
    const headers = ['#','المنتج','الفئة','المورد','Order ID','الكود','تكلفة البطاقة ($)','الحالة','التاريخ'];
    const rows = filteredStocks.map((s,i) => [
        i+1, s.product_name, s.price_label, s.supplier_name || '', s.order_id || '',
        s.code,
        s.cost_per_card_usd != null ? parseFloat(s.cost_per_card_usd).toFixed(3) : '',
        s.status,
        s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : ''
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
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
    const raw   = document.getElementById('fill-codes').value;
    const count = raw.split('\n').map(c => c.trim()).filter(c => c.length > 0).length;
    document.getElementById('fill-count').textContent = count > 0 ? `${count} كود جاهز للرفع` : '';
}

function updateLastRefresh() {
    const now     = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    document.getElementById('last-refresh').textContent = 'Dernière mise à jour: ' + timeStr;
}

function showToast(msg, isError = false) {
    const container = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className   = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity    = '0';
        t.style.transition = 'opacity 0.4s';
        setTimeout(() => t.remove(), 400);
    }, 2500);
}

window.calcProfit = function() {
    const totalCost = parseFloat(document.getElementById('fill-cost')?.value) || 0;
    const qty       = parseInt(document.getElementById('fill-qty')?.value)    || 0;
    const pid       = document.getElementById('fill-product')?.value;
    const pidx      = document.getElementById('fill-price')?.value;
    const product   = allProducts.find(p => String(p.id) === String(pid));
    const prices    = product
        ? (Array.isArray(product.prices) ? product.prices : Object.values(product.prices || {}))
        : [];
    const sellPrice = (pidx !== '' && pidx !== undefined && prices[pidx])
        ? parseFloat(prices[pidx].value) || 0 : 0;
    const card = document.getElementById('profit-card');

    if (totalCost > 0 && qty > 0 && sellPrice > 0) {
        const costPerCard   = totalCost / qty;
        const profitPerCard = sellPrice - (costPerCard * 43);
        const profitTotal   = profitPerCard * qty;
        const isProfit      = profitPerCard >= 0;
        const color         = isProfit ? 'var(--success)' : 'var(--danger)';

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