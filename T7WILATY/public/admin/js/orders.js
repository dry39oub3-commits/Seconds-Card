import { supabase } from '../../js/supabase-config.js';

const USD_TO_MRU = 43;

// ==================== Pagination ====================
let currentPage = 1;
const PAGE_SIZE = 10;
let allGrouped = [];

async function loadOrders() {
    const ordersList = document.getElementById('admin-orders-list');
    if (!ordersList) return;

    ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">جاري التحميل...</td></tr>';

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, products(image, prices)')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")')
        .order('created_at', { ascending: false });

    if (error) {
        ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">❌ خطأ في جلب الطلبات</td></tr>';
        return;
    }

    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>';
        return;
    }

    renderOrders(orders);
    processWalletOrders(orders);
}

function renderOrders(orders) {
    const ordersList = document.getElementById('admin-orders-list');
    if (!ordersList) return;

    const groupedMap = {};
    orders.forEach(order => {
        const key = order.order_number || order.id;
        if (!groupedMap[key]) {
            groupedMap[key] = { ...order, items: [], totalPrice: 0 };
        }
        groupedMap[key].items.push(order);
        groupedMap[key].totalPrice += (order.price || 0) * (order.quantity || 1);
    });

    allGrouped = Object.values(groupedMap);

    if (allGrouped.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>';
        renderPagination(0);
        return;
    }

    renderPage(currentPage);
}

function renderPage(page) {
    const ordersList = document.getElementById('admin-orders-list');
    if (!ordersList) return;

    const total = allGrouped.length;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    currentPage = Math.max(1, Math.min(page, totalPages));

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const slice = allGrouped.slice(start, end);

    const canApprove = window.hasPerm?.('approve_orders') ?? true;
    const canRefund = window.hasPerm?.('refund_orders') ?? true;

    ordersList.innerHTML = slice.map(group => {
        const date = group.created_at ? new Date(group.created_at).toLocaleString('fr-FR') : 'غير محدد';
        const paymentMethod = group.paymentMethod || group.payment_method || '-';
        const receiptUrl = group.receiptUrl || group.receipt_url;
        const receiptBtn = receiptUrl
            ? `<a href="${receiptUrl}" target="_blank" class="btn-check" title="عرض الإيصال"><i class="fas fa-receipt"></i></a>`
            : '-';

        const imagesCell = group.items.map(item => {
            const img = item.products?.image;
            return img
                ? `<img src="${img}" style="width:36px;height:36px;object-fit:contain;background:white;border-radius:5px;padding:2px;margin:1px;" title="${item.product_name || ''}">`
                : '';
        }).join('');

        const productsCell = group.items.map(item =>
            `<div style="font-size:12px;margin-bottom:3px;">
                <span class="order-product-name">${item.product_name || 'غير محدد'}</span>
                ${item.label ? `<span style="color:#f97316;margin-right:4px;">(${item.label})</span>` : ''}
                ${item.player_id ? `<span style="color:#22c55e;font-size:10px;margin-right:4px;">🎮 ${item.player_id}</span>` : ''}
                ${group.items.length > 1 ? `<span style="color:var(--text-muted);">× ${item.quantity || 1}</span>` : ''}
            </div>`
        ).join('');

        const totalQty = group.items.reduce((s, o) => s + (o.quantity || 1), 0);

        const acceptBtn = group.items.length === 1
            ? `<div style="display:flex;flex-direction:column;gap:6px;">
                ${canApprove ? `<button onclick="openOrderModalWithBinance(${JSON.stringify(group.items[0]).replace(/"/g, '&quot;')})"
                    style="background:#22c55e;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
                    <i class="fas fa-check-circle"></i> قبول</button>` : ''}
                ${canRefund ? `<button onclick="quickRefund('${group.items[0].id}','${group.items[0].paymentMethod || group.items[0].payment_method || ''}')"
                    style="background:#f59e0b;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
                    <i class="fas fa-undo"></i> استرداد</button>` : ''}
                ${!canApprove && !canRefund ? `<span style="font-size:12px;color:#475569;">لا صلاحية</span>` : ''}
               </div>`
            : `<div style="display:flex;flex-direction:column;gap:6px;">
                ${canApprove ? `<button onclick="openGroupOrderModal(${JSON.stringify(group.items).replace(/"/g, '&quot;')})"
                    style="background:#3b82f6;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
                    <i class="fas fa-layer-group"></i> قبول المجموعة (${group.items.length})</button>` : ''}
                ${canRefund ? `<button onclick="quickRefundGroup(${JSON.stringify(group.items.map(i => i.id)).replace(/"/g, '&quot;')},'${group.paymentMethod || group.payment_method || ''}')"
                    style="background:#f59e0b;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
                    <i class="fas fa-undo"></i> استرداد المجموعة</button>` : ''}
                ${!canApprove && !canRefund ? `<span style="font-size:12px;color:#475569;">لا صلاحية</span>` : ''}
               </div>`;

        return `
            <tr id="order-row-${group.order_number || group.id}">
                <td style="color:#f97316;font-weight:bold;">${group.order_number || '#' + group.id.substring(0, 7)}</td>
                <td>
                    <div style="font-weight:700;font-size:13px;">${group.customer_name || 'غير معروف'}</div>
                    ${group.customer_phone ? `<div style="font-size:11px;color:#64748b;font-family:monospace;margin-top:2px;direction:ltr;">${group.customer_phone}</div>` : ''}
                </td>
                <td>${imagesCell || '-'}</td>
                <td>${productsCell}</td>
                <td><strong>${group.totalPrice} ${group.items[0]?.currency || 'MRU'}</strong></td>
                <td>${totalQty}</td>
                <td><small>${date}</small></td>
                <td>
                    <div>${paymentMethod}</div>
                    ${group.items[0]?.sender_phone ? `
                    <div style="font-size:11px;color:#22c55e;font-family:monospace;margin-top:4px;direction:ltr;">
                        <i class="fas fa-paper-plane" style="font-size:9px;margin-left:3px;"></i>${group.items[0].sender_phone}
                    </div>` : ''}
                </td>
                <td>${receiptBtn}</td>
                <td>${acceptBtn}</td>
            </tr>`;
    }).join('');

    renderPagination(total);
}

function renderPagination(total) {
    document.getElementById('orders-pagination')?.remove();

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return;

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    let pages = [];
    if (totalPages <= 7) {
        pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
        pages = [1];
        if (currentPage > 3) pages.push('...');
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            pages.push(i);
        }
        if (currentPage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
    }

    const pag = document.createElement('div');
    pag.id = 'orders-pagination';
    pag.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 20px; flex-wrap: wrap; gap: 10px;
        border-top: 1px solid var(--border-light, #334155);
        margin-top: 4px;
    `;

    pag.innerHTML = `
        <span style="font-size:13px;color:#64748b;">
            عرض <strong style="color:#f97316;">${start}–${end}</strong> من <strong>${total}</strong> طلب
        </span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <button onclick="goToPage(${currentPage - 1})"
                ${currentPage === 1 ? 'disabled' : ''}
                style="padding:7px 14px;border-radius:8px;border:1px solid var(--border-light,#334155);
                       background:${currentPage === 1 ? 'transparent' : 'var(--white,#1e293b)'};
                       color:${currentPage === 1 ? '#475569' : '#e2e8f0'};
                       cursor:${currentPage === 1 ? 'not-allowed' : 'pointer'};font-size:13px;
                       font-family:'Tajawal',sans-serif;transition:all 0.15s;">
                <i class="fas fa-chevron-right"></i>
            </button>
            ${pages.map(p => p === '...'
        ? `<span style="color:#475569;padding:0 4px;">...</span>`
        : `<button onclick="goToPage(${p})"
                    style="padding:7px 13px;border-radius:8px;font-size:13px;cursor:pointer;
                           font-family:'Tajawal',sans-serif;transition:all 0.15s;
                           border:1px solid ${p === currentPage ? '#f97316' : 'var(--border-light,#334155)'};
                           background:${p === currentPage ? '#f97316' : 'var(--white,#1e293b)'};
                           color:${p === currentPage ? 'white' : '#e2e8f0'};
                           font-weight:${p === currentPage ? '700' : '400'};">
                    ${p}
                   </button>`
    ).join('')}
            <button onclick="goToPage(${currentPage + 1})"
                ${currentPage === totalPages ? 'disabled' : ''}
                style="padding:7px 14px;border-radius:8px;border:1px solid var(--border-light,#334155);
                       background:${currentPage === totalPages ? 'transparent' : 'var(--white,#1e293b)'};
                       color:${currentPage === totalPages ? '#475569' : '#e2e8f0'};
                       cursor:${currentPage === totalPages ? 'not-allowed' : 'pointer'};font-size:13px;
                       font-family:'Tajawal',sans-serif;transition:all 0.15s;">
                <i class="fas fa-chevron-left"></i>
            </button>
        </div>
    `;

    const tableContainer = document.querySelector('.table-container') || document.getElementById('admin-orders-list')?.closest('section');
    tableContainer?.appendChild(pag);
}

window.goToPage = (page) => {
    const totalPages = Math.ceil(allGrouped.length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderPage(currentPage);
    document.querySelector('.table-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.filterOrders = () => {
    const search = document.getElementById('orderSearch').value.trim().toLowerCase();
    document.querySelectorAll('#admin-orders-list tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(search) ? '' : 'none';
    });
};

async function processWalletOrders(orders) {
    const walletOrders = orders.filter(order => {
        const pm = order.paymentMethod || order.payment_method || '';
        return pm === 'المحفظة' || pm === 'محفظة';
    });

    if (walletOrders.length === 0) return;

    let anyApproved = false;
    for (const order of walletOrders) {
        const approved = await tryAutoApproveFromStock(order);
        if (approved) anyApproved = true;
    }

    if (anyApproved) loadOrders();
}

async function tryAutoApproveFromStock(order) {
    const quantity = order.quantity || 1;
    const productId = order.product_id;
    const label = order.label;
    if (!productId || !label) return false;

    const { data: availableCodes, error } = await supabase
        .from('stocks').select('*')
        .eq('product_id', productId).eq('price_label', label).eq('status', 'available')
        .order('created_at', { ascending: true }).limit(quantity);

    if (error || !availableCodes || availableCodes.length < quantity) return false;

    const codes = availableCodes.map(c => c.code);
    const stockIds = availableCodes.map(c => c.id);
    const suppliersMap = {};
    availableCodes.forEach(c => {
        const name = c.supplier_name || 'غير محدد';
        if (!suppliersMap[name]) suppliersMap[name] = { supplier_name: name, supplier_order_id: c.order_id || '' };
    });

    for (const code of codes) {
        const { data: existing } = await supabase.from('used_codes').select('id').eq('code', code).maybeSingle();
        if (existing) return false;
    }

    const { error: updateError } = await supabase.from('orders').update({
        status: 'مكتمل', card_code: codes.join('\n'),
        cost_price: availableCodes[0]?.cost_per_card_usd || 0,
        supplier_id: availableCodes[0]?.supplier_name || 'تلقائي',
        supplier_order_id: availableCodes[0]?.order_id || '',
        suppliers_details: Object.values(suppliersMap), auto_approved: true
    }).eq('id', order.id);

    if (updateError) return false;

    for (const code of codes) {
        await supabase.from('used_codes').insert({ code, order_id: order.id, product_name: order.product_name });
    }
    await supabase.from('stocks').update({ status: 'sold', sold_at: new Date().toISOString(), order_id: order.id }).in('id', stockIds);
    return true;
}

// ==================== buildStockSection ====================
function buildStockSection({ suffix = '', productId, label, quantity, orderPrice, prices = [], currency = 'MRU', hasPlayerId = false }) {
    const c = getThemeColors();
    const priceObj = (prices || []).find(p => p.label === label) || prices[0] || {};
    const suppliers = priceObj.suppliers || [];
    const inputStyle = `width:100%; padding:9px 12px; background:${c.inputBg}; border:1px solid ${c.inputBorder}; border-radius:8px; color:${c.inputColor}; font-family:inherit; font-size:13px;`;

    const calcCall = suffix === ''
        ? `calcProfit(${orderPrice}, '${currency}')`
        : `calcProfitItem(${suffix}, ${orderPrice})`;

    const suppliersSelectHTML = suppliers.length > 0 ? `
        <div id="supplier-select-wrap${suffix}" style="margin-top:10px; display:${hasPlayerId ? 'block' : 'none'};">
            <label style="font-size:12px; color:${c.textMuted}; display:block; margin-bottom:6px;">
                🔗 اختر المورد للشراء
            </label>
            <div style="display:flex; flex-direction:column; gap:6px;">
                ${suppliers.map((s, idx) => `
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="
                            document.querySelectorAll('.supplier-btn-${suffix}').forEach(b => b.style.background='rgba(59,130,246,0.12)');
                            this.style.background='rgba(59,130,246,0.3)';
                            const supplierField = document.getElementById('modal-supplier-id${suffix === '' ? '' : '-' + suffix}');
                            if (supplierField) supplierField.value = '${s.name}';
                        "
                        class="supplier-btn-${suffix}"
                        style="flex:1; padding:9px 12px; background:rgba(59,130,246,0.12);
                               color:#60a5fa; border:1px solid rgba(59,130,246,0.3);
                               border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;
                               font-family:inherit; text-align:right; transition:background 0.2s;">
                        🏪 ${s.name}
                    </button>
                    ${s.url ? `
                    <a href="${s.url}" target="_blank" rel="noopener"
                        style="padding:9px 14px; background:#f97316; color:white;
                               border-radius:8px; text-decoration:none; font-size:13px; font-weight:700;
                               white-space:nowrap; display:inline-flex; align-items:center; gap:5px;"
                        onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                        <i class="fas fa-shopping-cart"></i> شراء
                    </a>` : ''}
                </div>`).join('')}
            </div>
        </div>
    ` : '';

    return `
        <div>
            <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">
                💵 سعر التكلفة ($) — لكود واحد
            </label>
            <input type="number" id="modal-cost${suffix}" placeholder="0.00" step="0.01"
                oninput="${hasPlayerId ? `calcProfitPlayerID('${suffix}', ${orderPrice}, '${currency}')` : calcCall}"
                style="${inputStyle} width:100%; box-sizing:border-box;">

            ${!hasPlayerId ? `
            <button onclick="loadFromStock${suffix === '' ? '(\'' + productId + '\',\'' + label + '\',' + quantity + ',' + orderPrice + ')' : 'ForItem(' + suffix + ',\'' + productId + '\',\'' + label + '\',' + quantity + ',' + orderPrice + ')'}"
                style="width:100%; margin-top:8px; padding:10px; background:rgba(59,130,246,0.15);
                    color:#3b82f6; border:1px solid #3b82f6; border-radius:8px;
                    cursor:pointer; font-size:13px; font-weight:bold; transition:0.2s;"
                onmouseover="this.style.background='rgba(59,130,246,0.3)'"
                onmouseout="this.style.background='rgba(59,130,246,0.15)'">
                <i class="fas fa-box-open"></i> سحب من المخزون
            </button>` : ''}

            ${hasPlayerId ? `
            <div id="profit-display-pi${suffix}" style="display:none; margin-top:10px; background:${c.deepBg};
                border-radius:8px; padding:10px; text-align:center; border:1px solid ${c.border};"></div>
            ` : ''}

            <p id="stock-status${suffix}" style="font-size:11px; color:${c.textMuted}; margin-top:5px; text-align:center;"></p>
            ${suppliersSelectHTML}
        </div>
    `;
}

// ==================== حساب الربح لطلبات Player ID ====================
window.calcProfitPlayerID = (suffix, orderPrice, currency) => {
    const cost = parseFloat(document.getElementById(`modal-cost${suffix}`)?.value) || 0;
    const display = document.getElementById(`profit-display-pi${suffix}`);
    if (!display) return;
    if (cost <= 0) { display.style.display = 'none'; return; }

    const totalCost = cost * USD_TO_MRU;
    const profit = orderPrice - totalCost;
    const color = profit >= 0 ? '#22c55e' : '#ef4444';

    display.style.display = 'block';
    display.innerHTML = `
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">
            التكلفة: $${cost} × ${USD_TO_MRU} = ${totalCost.toFixed(0)} MRU
        </div>
        <span style="color:#94a3b8;font-size:13px;">الربح: </span>
        <span style="color:${color};font-size:16px;font-weight:bold;">${profit.toFixed(0)}</span>
        <span style="color:#94a3b8;font-size:13px;"> MRU</span>
    `;
};

window.onSupplierSelectChange = (suffix) => {
    const sel = document.getElementById(`supplier-select${suffix}`);
    const buyBtn = document.getElementById(`buy-btn${suffix}`);
    const selectedOpt = sel.options[sel.selectedIndex];

    if (sel.value) {
        buyBtn.href = sel.value;
        buyBtn.style.display = 'inline-flex';
        buyBtn.style.alignItems = 'center';
        buyBtn.style.gap = '6px';
        const supplierField = document.getElementById(`modal-supplier-id${suffix === '' ? '' : '-' + suffix}`);
        if (supplierField) supplierField.value = selectedOpt.dataset.name || '';
    } else {
        buyBtn.style.display = 'none';
    }
};

// ==================== openOrderModal الأصلي ====================
window.openOrderModal = (order) => {
    const product = order.products || {};
    const image = product.image || '';
    const prices = product.prices || [];
    const totalPrice = order.price * (order.quantity || 1);
    const hasPlayerId = !!order.player_id;
    const displayCurrency = order.currency || 'MRU';
    const c = getThemeColors();

    document.getElementById('order-modal')?.remove();
    window._reservedStockIds = null;
    window._stockCodesData = null;

    const modal = document.createElement('div');
    modal.id = 'order-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.85); z-index:9999;
        display:flex; align-items:flex-start; justify-content:center;
        overflow-y:auto; padding:20px; box-sizing:border-box;
    `;

    const stockSectionHTML = buildStockSection({
        suffix: '', productId: order.product_id, label: order.label,
        quantity: order.quantity || 1, orderPrice: totalPrice, prices,
        currency: displayCurrency, hasPlayerId
    });

    const inputStyle = `width:100%;padding:10px;background:${c.inputBg};border:1px solid ${c.inputBorder};border-radius:8px;color:${c.inputColor};font-size:14px;box-sizing:border-box;`;

    modal.innerHTML = `
        <div style="background:${c.modalBg}; border-radius:16px; padding:30px; width:100%; max-width:750px; color:${c.text}; position:relative; margin:auto; border:1px solid ${c.border};">
            <button onclick="document.getElementById('order-modal').remove()"
                    style="position:absolute; top:15px; left:15px; background:#ef4444; color:white; border:none; border-radius:8px; padding:6px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>
            <h2 style="text-align:center; margin-bottom:20px; color:#f97316;">تفاصيل الطلب</h2>
            <div style="background:${c.deepBg}; border-radius:12px; padding:20px; margin-bottom:20px; display:flex; gap:15px; align-items:center; border:1px solid ${c.border};">
                <img src="${image}" style="width:90px;height:90px;object-fit:contain;background:white;border-radius:10px;padding:5px;flex-shrink:0;" onerror="this.style.display='none'">
                <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <h3 style="margin:0 0 4px; font-size:17px; grid-column:1/-1; color:${c.text};">${order.product_name || 'غير محدد'}</h3>
                    <p style="margin:0; color:${c.textMuted}; font-size:13px;">👤 ${order.customer_name || 'غير معروف'}</p>
                    <p style="margin:0; font-size:13px; color:${c.text};">🏷️ الفئة: <strong style="color:#f97316;">${order.label || '-'}</strong></p>
                    <p style="margin:0; color:${c.textMuted}; font-size:13px;">📱 ${order.customer_phone || '-'}</p>
                    <p style="margin:0; font-size:13px;">💰 <strong style="color:#f97316;">${totalPrice} ${displayCurrency}</strong></p>
                    <p style="margin:0; color:${c.textMuted}; font-size:13px;">🔢 الكمية: ${order.quantity || 1}</p>
                    <p style="margin:0; color:${c.textMuted}; font-size:13px;">💳 ${order.paymentMethod || order.payment_method || '-'}</p>
                </div>
            </div>
            ${order.player_id ? `
            <div style="margin-bottom:15px; font-size:13px;
                background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3);
                border-radius:8px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between;">
                <span style="color:#94a3b8;">🎮 Player ID:</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <strong id="player-id-value" style="font-family:monospace; color:#22c55e; font-size:15px;">${order.player_id}</strong>
                    <button onclick="navigator.clipboard.writeText('${order.player_id}').then(() => { this.innerHTML='<i class=\\'fas fa-check\\'></i>'; this.style.background='rgba(34,197,94,0.3)'; setTimeout(() => { this.innerHTML='<i class=\\'fas fa-copy\\'></i>'; this.style.background='rgba(34,197,94,0.15)'; }, 1500); });"
                        style="background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.4); padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; transition:all 0.2s;">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>` : ''}
            <div style="display:grid; grid-template-columns:${hasPlayerId ? '1fr' : '1fr 1fr'}; gap:15px; margin-bottom:15px;">
                ${stockSectionHTML}
                ${!hasPlayerId ? `
                <div>
                    <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">
                        🔑 أكواد البطاقة (${order.quantity || 1} كود) — كود في كل سطر
                    </label>
                    <textarea id="modal-code" placeholder="كود 1&#10;كود 2&#10;كود 3..."
                        rows="${Math.max(3, order.quantity || 1)}"
                        style="${inputStyle} resize:vertical; font-family:monospace; line-height:1.8;"></textarea>
                    <p style="font-size:11px; color:${c.textMuted}; margin-top:4px;">أدخل كل كود في سطر منفصل</p>
                </div>` : ''}
            </div>
            ${!hasPlayerId ? `
            <div id="profit-display" style="display:none; margin-bottom:15px; background:${c.deepBg}; border-radius:8px; padding:12px; text-align:center; border:1px solid ${c.border};"></div>
            <div id="stock-suppliers-section" style="display:none; margin-bottom:15px;">
                <div style="background:${c.deepBg}; border:1px solid #1e3a5f; border-radius:12px; padding:16px;">
                    <p style="font-size:13px; color:#3b82f6; font-weight:700; margin:0 0 12px;">
                        <i class="fas fa-boxes"></i> موردو هذا الكود في المخزون
                    </p>
                    <div id="stock-suppliers-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                </div>
            </div>` : ''}
            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">🏪 اسم المورد</label>
                <input type="text" id="modal-supplier-id" placeholder="اسم المورد..." style="${inputStyle}">
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">🔖 Order ID المورد</label>
                <input type="text" id="modal-supplier-order-id" placeholder="أدخل Order ID من المورد..." style="${inputStyle}">
            </div>
            ${hasPlayerId ? `
            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">
                    <i class="fas fa-receipt" style="color:#f97316;"></i> إيصال التنفيذ (يظهر للعميل)
                </label>
                <input type="file" id="player-receipt-file" accept="image/*"
                    style="width:100%; padding:10px; background:${c.inputBg}; border:1px solid ${c.inputBorder}; border-radius:8px; color:${c.text}; font-size:13px; box-sizing:border-box; cursor:pointer;">
                <div id="player-receipt-preview" style="display:none; margin-top:8px; border-radius:10px; overflow:hidden; border:1px solid ${c.border};">
                    <img id="player-receipt-img" style="width:100%; max-height:180px; object-fit:cover; display:block;">
                </div>
            </div>` : ''}
            <div style="margin-bottom:12px;">
                <input type="text" id="reject-reason" placeholder="سبب الرفض..."
                    style="${inputStyle} border-color:#ef4444; margin-bottom:8px;">
                <button onclick="rejectOrder('${order.id}')"
                    style="width:100%;padding:14px;background:#ef4444;color:white;border:none;border-radius:10px;font-size:16px;cursor:pointer;font-weight:bold;">
                    <i class="fas fa-times-circle"></i> رفض الطلب
                </button>
            </div>
            <button onclick="approveOrder('${order.id}', ${order.quantity || 1})"
                style="width:100%;padding:14px;background:#22c55e;color:white;border:none;border-radius:10px;font-size:16px;cursor:pointer;font-weight:bold;">
                <i class="fas fa-check-circle"></i> تأكيد القبول
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('player-receipt-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('player-receipt-img').src = ev.target.result;
            document.getElementById('player-receipt-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
};

// ==================== openOrderModalWithBinance ====================
window.openOrderModalWithBinance = (order) => {
    window.openOrderModal(order);

    setTimeout(() => {
        const costInput = document.getElementById('modal-cost');
        if (!costInput) return;

        // زر Binance
        const binanceBtn = document.createElement('button');
        binanceBtn.id = 'binance-fetch-btn';
        binanceBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1e293b" style="vertical-align:middle;margin-left:6px;">
                <path d="M12 0L7.5 4.5 10.5 7.5 12 6l1.5 1.5 3-3L12 0zM4.5 7.5L0 12l4.5 4.5 3-3L6 12l1.5-1.5-3-3zm15 0l-3 3L18 12l-1.5 1.5 3 3L24 12l-4.5-4.5zM12 13.5L10.5 15l-3-3L4.5 15 12 22.5l7.5-7.5-3-3-3 3L12 13.5z"/>
            </svg>
            جلب من سحوبات Binance
        `;
        binanceBtn.style.cssText = `
            width:100%; margin-top:8px; padding:10px 14px;
            background:#fcd535; color:#1e293b; border:none;
            border-radius:8px; cursor:pointer; font-size:13px;
            font-weight:800; font-family:'Tajawal',sans-serif;
            display:flex; align-items:center; justify-content:center; gap:6px;
            transition:opacity 0.2s; box-shadow:0 2px 8px rgba(252,213,53,0.3);
        `;
        binanceBtn.onmouseover = () => binanceBtn.style.opacity = '0.88';
        binanceBtn.onmouseout = () => binanceBtn.style.opacity = '1';
        binanceBtn.onclick = () => fetchBinanceWithdrawals();

        costInput.parentNode.insertBefore(binanceBtn, costInput.nextSibling);

        // حاوية الـ dropdown
        const dropdown = document.createElement('div');
        dropdown.id = 'binance-dropdown';
        dropdown.style.cssText = `
            display:none; margin-top:6px; background:#0a0f1a;
            border:1.5px solid #fcd535; border-radius:10px;
            overflow:hidden; max-height:260px; overflow-y:auto;
        `;
        binanceBtn.after(dropdown);

    }, 120);
};

// ==================== جلب سحوبات Binance ====================
async function fetchBinanceWithdrawals() {
    const btn = document.getElementById('binance-fetch-btn');
    const dropdown = document.getElementById('binance-dropdown');
    if (!btn || !dropdown) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الجلب...';
    btn.disabled = true;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
            'https://btcmfdfepykwimukbiad.supabase.co/functions/v1/binance-withdrawals',
            { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            dropdown.style.display = 'block';
            dropdown.innerHTML = `<p style="text-align:center;color:#94a3b8;padding:16px;font-size:13px;">لا توجد سحوبات حديثة</p>`;
            return;
        }

        dropdown.style.display = 'block';
dropdown.innerHTML = data.map(w => `
    <div onclick="selectBinanceWithdrawal('${w.amount}', '${w.orderId}', '${w.merchant}')"
        style="padding:12px 16px; cursor:pointer; border-bottom:1px solid #1e293b;
               transition:background 0.15s;"
        onmouseover="this.style.background='rgba(252,213,53,0.08)'"
        onmouseout="this.style.background='transparent'">

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-weight:900; color:#fcd535; font-size:16px;">
                ${w.amount} ${w.currency}
            </span>
            <span style="font-size:11px; color:#64748b;">${w.date}</span>
        </div>

        <div style="font-size:12px; color:#e2e8f0; font-weight:700; margin-bottom:4px;">
            🏪 ${w.merchant}
        </div>

        <div style="font-size:11px; color:#94a3b8; font-family:monospace;">
            TX: ${w.description}
        </div>

    </div>
`).join('');

    } catch (err) {
        dropdown.style.display = 'block';
        dropdown.innerHTML = `<p style="text-align:center;color:#ef4444;padding:16px;font-size:13px;">❌ ${err.message}</p>`;
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

window.selectBinanceWithdrawal = (amount, txId, merchant) => {
    const costInput     = document.getElementById('modal-cost');
    const orderIdInput  = document.getElementById('modal-supplier-order-id');
    const supplierInput = document.getElementById('modal-supplier-id');
    const dropdown      = document.getElementById('binance-dropdown');

    if (costInput) {
        costInput.value    = amount;
        costInput.readOnly = true;
        costInput.style.cssText += `background:#0d2010 !important; color:#fcd535 !important; cursor:not-allowed; border-color:#fcd535;`;
        costInput.dispatchEvent(new Event('input'));
    }

    if (orderIdInput) orderIdInput.value = txId;
    if (supplierInput) supplierInput.value = merchant;

    if (dropdown) dropdown.style.display = 'none';

    const btn = document.getElementById('binance-fetch-btn');
    if (btn) {
        btn.innerHTML        = '✅ تم الربط مع Binance';
        btn.style.background = '#0d2010';
        btn.style.color      = '#fcd535';
        btn.style.border     = '1px solid #fcd535';
        btn.disabled         = true;
    }

    // ✅ أضف زر إلغاء الربط
    document.getElementById('binance-unlink-btn')?.remove();
    const unlinkBtn = document.createElement('button');
    unlinkBtn.id = 'binance-unlink-btn';
    unlinkBtn.innerHTML = '🔗 إلغاء الربط';
    unlinkBtn.style.cssText = `
        width:100%; margin-top:6px; padding:8px 14px;
        background:transparent; color:#ef4444;
        border:1px solid #ef4444; border-radius:8px;
        cursor:pointer; font-size:12px; font-weight:700;
        font-family:'Tajawal',sans-serif; transition:opacity 0.2s;
    `;
    unlinkBtn.onclick = () => {
        // ✅ إعادة تعيين حقل التكلفة
        if (costInput) {
            costInput.value    = '';
            costInput.readOnly = false;
            costInput.style.cssText = costInput.style.cssText
                .replace(/background:[^;]+!important;/g, '')
                .replace(/color:[^;]+!important;/g, '')
                .replace(/cursor:[^;]+;/g, '')
                .replace(/border-color:[^;]+;/g, '');
        }

        // ✅ إعادة تعيين حقلي المورد والـ Order ID
        if (orderIdInput)  orderIdInput.value  = '';
        if (supplierInput) supplierInput.value = '';

        // ✅ إعادة زر Binance
        if (btn) {
            btn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1e293b" style="vertical-align:middle;margin-left:6px;">
                    <path d="M12 0L7.5 4.5 10.5 7.5 12 6l1.5 1.5 3-3L12 0zM4.5 7.5L0 12l4.5 4.5 3-3L6 12l1.5-1.5-3-3zm15 0l-3 3L18 12l-1.5 1.5 3 3L24 12l-4.5-4.5zM12 13.5L10.5 15l-3-3L4.5 15 12 22.5l7.5-7.5-3-3-3 3L12 13.5z"/>
                </svg>
                جلب من سحوبات Binance
            `;
            btn.style.background = '#fcd535';
            btn.style.color      = '#1e293b';
            btn.style.border     = 'none';
            btn.disabled         = false;
        }

        unlinkBtn.remove();
        showToast('✅ تم إلغاء الربط');
    };

    btn?.after(unlinkBtn);
    showToast('✅ تم ربط عملية Binance');
};

window.openGroupOrderModal = (items) => {
    document.getElementById('order-modal')?.remove();
    window._groupItems = items;
    window._groupStockData = items.map(() => null);
    const c = getThemeColors();
    const firstItem = items[0];
    const totalPrice = items.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);
    const inputStyle = `width:100%;padding:8px;background:${c.inputBg};border:1px solid ${c.inputBorder};border-radius:7px;color:${c.inputColor};font-size:13px;box-sizing:border-box;`;

    const modal = document.createElement('div');
    modal.id = 'order-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.85); z-index:9999;
        display:flex; align-items:flex-start; justify-content:center;
        overflow-y:auto; padding:20px; box-sizing:border-box;
    `;

    const itemsSections = items.map((item, idx) => {
        const img = item.products?.image || '';
        const prices = item.products?.prices || [];
        const hasPI = !!item.player_id;
        const stockHTML = buildStockSection({
            suffix: idx, productId: item.product_id, label: item.label,
            quantity: item.quantity || 1, orderPrice: item.price * (item.quantity || 1),
            prices, currency: item.currency || 'MRU', hasPlayerId: hasPI
        });

        return `
        <div style="background:${c.deepBg}; border-radius:10px; padding:16px; margin-bottom:12px; border:1px solid ${c.cardBorder};">
            <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
                ${img ? `<img src="${img}" style="width:50px;height:50px;object-fit:contain;background:white;border-radius:8px;padding:3px;flex-shrink:0;">` : ''}
                <div>
                    <div style="font-weight:700; color:${c.text};">${item.product_name || 'غير محدد'}</div>
                    <div style="font-size:13px; color:#f97316;">${item.label || '-'} • ${item.quantity || 1} قطعة • ${item.price * (item.quantity || 1)} ${item.currency || 'MRU'}</div>
                    ${hasPI ? `<div style="font-size:12px; color:#22c55e; margin-top:3px;">🎮 Player ID: <strong style="font-family:monospace;">${item.player_id}</strong></div>` : ''}
                </div>
            </div>
            <div style="display:grid; grid-template-columns:${hasPI ? '1fr' : '1fr 1fr'}; gap:10px;">
                ${stockHTML}
                ${!hasPI ? `
                <div>
                    <label style="font-size:12px; color:${c.textMuted}; display:block; margin-bottom:5px;">🔑 الأكواد (${item.quantity || 1} كود)</label>
                    <textarea id="code-${idx}" placeholder="كود 1&#10;كود 2..."
                        rows="${Math.max(2, item.quantity || 1)}"
                        style="${inputStyle} resize:vertical; font-family:monospace; line-height:1.8;"></textarea>
                </div>` : ''}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                <div>
                    <label style="font-size:12px; color:${c.textMuted}; display:block; margin-bottom:5px;">🏪 المورد</label>
                    <input type="text" id="supplier-${idx}" placeholder="اسم المورد..." style="${inputStyle}">
                </div>
                <div>
                    <label style="font-size:12px; color:${c.textMuted}; display:block; margin-bottom:5px;">🔖 Order ID</label>
                    <input type="text" id="supplier-order-${idx}" placeholder="Order ID..." style="${inputStyle}">
                </div>
            </div>
        </div>`;
    }).join('');

    modal.innerHTML = `
        <div style="background:${c.modalBg}; border-radius:16px; padding:30px; width:100%; max-width:800px; color:${c.text}; position:relative; margin:auto; border:1px solid ${c.border};">
            <button onclick="document.getElementById('order-modal').remove()"
                    style="position:absolute;top:15px;left:15px;background:#ef4444;color:white;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;">
                ✕ إغلاق
            </button>
            <h2 style="text-align:center; margin-bottom:6px; color:#f97316;">
                <i class="fas fa-layer-group"></i> مجموعة طلبات
            </h2>
            <div style="text-align:center; margin-bottom:20px;">
                <span style="background:${c.deepBg}; border:1px solid ${c.border}; border-radius:20px; padding:4px 14px; font-size:13px; color:${c.textMuted};">
                    ${firstItem.order_number || '-'} &nbsp;•&nbsp; 👤 ${firstItem.customer_name || '-'} &nbsp;•&nbsp; 💰 ${totalPrice} MRU
                </span>
            </div>
            ${itemsSections}
            <div style="margin-top:16px; margin-bottom:12px;">
                <input type="text" id="group-reject-reason" placeholder="سبب الرفض..."
                    style="width:100%;padding:10px;background:${c.inputBg};border:1px solid #ef4444;border-radius:8px;color:${c.inputColor};font-size:14px;box-sizing:border-box;margin-bottom:8px;">
                <button onclick="rejectGroupOrders()"
                    style="width:100%;padding:12px;background:#ef4444;color:white;border:none;border-radius:10px;font-size:15px;cursor:pointer;font-weight:bold;">
                    <i class="fas fa-times-circle"></i> رفض المجموعة كاملة
                </button>
            </div>
            <button onclick="approveGroupOrders()"
                style="width:100%;padding:14px;background:#22c55e;color:white;border:none;border-radius:10px;font-size:16px;cursor:pointer;font-weight:bold;">
                <i class="fas fa-check-double"></i> تأكيد قبول المجموعة (${items.length} طلب)
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

window.calcProfit = (orderPrice, currency) => {
    const cost = parseFloat(document.getElementById('modal-cost').value) || 0;
    const codesEl = document.getElementById('modal-code');
    const codesText = codesEl ? codesEl.value.trim() : '';
    const quantity = codesText ? codesText.split('\n').filter(c => c.trim() !== '').length : 1;
    const profitDisplay = document.getElementById('profit-display');

    if (!profitDisplay) return;
    if (cost <= 0) { profitDisplay.style.display = 'none'; return; }

    const isCrypto = (currency || 'MRU') === 'USDT';

    if (isCrypto) {
        const totalCost = cost * quantity;
        const profit = orderPrice - totalCost;
        profitDisplay.style.display = 'block';
        profitDisplay.innerHTML = `
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">التكلفة: $${cost} × ${quantity} كود = $${totalCost.toFixed(2)}</div>
            <span style="color:#94a3b8;font-size:13px;">الربح: </span>
            <span style="color:${profit >= 0 ? '#22c55e' : '#ef4444'};font-size:18px;font-weight:bold;">${profit.toFixed(2)}</span>
            <span style="color:#94a3b8;font-size:13px;"> USDT</span>
        `;
    } else {
        const codesCount = codesText
            ? codesText.split('\n').filter(c => c.trim() !== '').length
            : quantity;
        const totalCost = cost * USD_TO_MRU * codesCount;
        const profit = orderPrice - totalCost;
        profitDisplay.style.display = 'block';
        profitDisplay.innerHTML = `
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">التكلفة: $${cost} × ${codesCount} كود × ${USD_TO_MRU} = ${totalCost.toFixed(0)} MRU</div>
            <span style="color:#94a3b8;font-size:13px;">الربح: </span>
            <span style="color:${profit >= 0 ? '#22c55e' : '#ef4444'};font-size:18px;font-weight:bold;">${profit.toFixed(0)}</span>
            <span style="color:#94a3b8;font-size:13px;"> MRU</span>
        `;
    }
};

window.calcProfitItem = (idx, orderPrice) => {
    const cost = parseFloat(document.getElementById(`modal-cost${idx}`)?.value) || 0;
};

window.loadFromStock = async (productId, label, quantity, orderPrice) => {
    const statusEl = document.getElementById('stock-status');
    if (!productId || productId === 'null') {
        statusEl.textContent = '⚠️ لا يوجد منتج مرتبط'; statusEl.style.color = '#ef4444'; return;
    }
    statusEl.textContent = '⏳ جاري البحث...'; statusEl.style.color = '#94a3b8';

    const { data: availableCodes, error } = await supabase
        .from('stocks').select('id, code, price_value, supplier_name, order_id, cost_per_card_usd')
        .eq('product_id', productId).eq('price_label', label).eq('status', 'available')
        .order('created_at', { ascending: true }).limit(quantity);

    if (error || !availableCodes || availableCodes.length === 0) {
        statusEl.textContent = error ? '❌ خطأ: ' + error.message : `❌ لا توجد أكواد متاحة للفئة "${label}"`;
        statusEl.style.color = '#ef4444';
        const section = document.getElementById('stock-suppliers-section');
        if (section) section.style.display = 'none';
        const wrap = document.getElementById('supplier-select-wrap');
        if (wrap) wrap.style.display = 'block';
        return;
    }

    statusEl.textContent = availableCodes.length < quantity
        ? `⚠️ يوجد ${availableCodes.length} كود فقط من أصل ${quantity} مطلوب`
        : `✅ تم سحب ${availableCodes.length} كود من المخزون`;
    statusEl.style.color = availableCodes.length < quantity ? '#f97316' : '#22c55e';

    document.getElementById('modal-code').value = availableCodes.map(c => c.code).join('\n');
    window._reservedStockIds = availableCodes.map(c => c.id);
    window._stockCodesData = availableCodes.map(c => ({
        id: c.id, code: c.code,
        supplier_name: c.supplier_name || 'غير محدد',
        order_id: c.order_id || '',
        cost_per_card_usd: c.cost_per_card_usd || 0
    }));

    const firstCost = availableCodes[0]?.cost_per_card_usd;
    if (firstCost > 0) {
        document.getElementById('modal-cost').value = parseFloat(firstCost).toFixed(4);
        calcProfit(orderPrice);
    }

    const suppliersMap = {};
    availableCodes.forEach(c => {
        const name = c.supplier_name || 'غير محدد';
        if (!suppliersMap[name]) suppliersMap[name] = { name, order_id: c.order_id || '', count: 0 };
        suppliersMap[name].count++;
    });
    const suppliers = Object.values(suppliersMap);
    const section = document.getElementById('stock-suppliers-section');
    const list = document.getElementById('stock-suppliers-list');
    if (list) {
        list.innerHTML = suppliers.map(s => `
            <div style="width:100%;padding:12px 16px;background:rgba(249,115,22,0.08);border:2px solid #f97316;
                   border-radius:8px;color:#e2e8f0;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
                <span style="display:flex;align-items:center;gap:8px;">
                    ${s.order_id ? `<span style="color:#94a3b8;">🔖 ${s.order_id}</span>` : ''}
                    <span style="color:#22c55e;background:rgba(34,197,94,0.1);padding:2px 8px;border-radius:10px;">${s.count} كود</span>
                </span>
                <span style="font-weight:700;">🏪 ${s.name}</span>
            </div>
        `).join('');
        if (section) section.style.display = 'block';
    }

    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput) supplierInput.value = suppliers.map(s => s.name).join(' / ');
    const orderInput = document.getElementById('modal-supplier-order-id');
    if (orderInput) orderInput.value = suppliers.map(s => s.order_id).filter(Boolean).join(' / ');

    const wrap = document.getElementById('supplier-select-wrap');
    if (wrap) { wrap.style.display = 'block'; wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
};

window.loadFromStockForItem = async (idx, productId, label, quantity, orderPrice) => {
    const statusEl = document.getElementById(`stock-status${idx}`);
    if (!productId || productId === 'null') {
        statusEl.textContent = '⚠️ لا يوجد منتج مرتبط'; statusEl.style.color = '#ef4444'; return;
    }
    statusEl.textContent = '⏳ جاري البحث...'; statusEl.style.color = '#94a3b8';

    const { data: availableCodes, error } = await supabase
        .from('stocks').select('id, code, supplier_name, order_id, cost_per_card_usd')
        .eq('product_id', productId).eq('price_label', label).eq('status', 'available')
        .order('created_at', { ascending: true }).limit(quantity);

    if (error || !availableCodes || availableCodes.length === 0) {
        statusEl.textContent = `❌ لا توجد أكواد متاحة`;
        statusEl.style.color = '#ef4444';
        const wrap = document.getElementById(`supplier-select-wrap${idx}`);
        if (wrap) wrap.style.display = 'block';
        return;
    }

    statusEl.textContent = `✅ تم سحب ${availableCodes.length} كود`; statusEl.style.color = '#22c55e';

    document.getElementById(`code-${idx}`).value = availableCodes.map(c => c.code).join('\n');
    document.getElementById(`supplier-${idx}`).value = availableCodes[0]?.supplier_name || '';
    document.getElementById(`supplier-order-${idx}`).value = availableCodes[0]?.order_id || '';

    const costField = document.getElementById(`modal-cost${idx}`);
    if (costField && availableCodes[0]?.cost_per_card_usd > 0) {
        costField.value = parseFloat(availableCodes[0].cost_per_card_usd).toFixed(4);
    }

    if (!window._groupStockData) window._groupStockData = [];
    window._groupStockData[idx] = {
        stockIds: availableCodes.map(c => c.id),
        codes: availableCodes.map(c => c.code),
        suppliersDetails: availableCodes.map(c => ({
            code: c.code,
            supplier_name: c.supplier_name || 'غير محدد',
            supplier_order_id: c.order_id || ''
        }))
    };

    const wrap = document.getElementById(`supplier-select-wrap${idx}`);
    if (wrap) { wrap.style.display = 'block'; wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
};

window.approveOrder = async (orderId, quantity) => {
    const hasPlayerId = !!document.getElementById('player-id-value');
    const codesRaw = document.getElementById('modal-code')?.value.trim() || '';
    const codes = hasPlayerId ? [] : codesRaw.split('\n').map(c => c.trim()).filter(c => c !== '');
    const cost = document.getElementById('modal-cost').value.trim();
    const supplierId = document.getElementById('modal-supplier-id').value.trim();
    const supplierOrderId = document.getElementById('modal-supplier-order-id')?.value.trim() || '';

    if (!hasPlayerId) {
        if (codes.length === 0) { showToast('⚠️ يرجى إدخال كود البطاقة!'); return; }
        if (codes.length !== quantity) { showToast(`⚠️ عدد الأكواد (${codes.length}) لا يطابق الكمية (${quantity})!`); return; }
    }
    if (!cost || parseFloat(cost) <= 0) { showToast('⚠️ يرجى إدخال سعر التكلفة!'); return; }
    if (!supplierId) { showToast('⚠️ يرجى إدخال اسم المورد!'); return; }

    if (!hasPlayerId) {
        for (const c of codes) {
            const { data: existing } = await supabase.from('used_codes').select('id').eq('code', c).maybeSingle();
            if (existing) { showToast(`⚠️ الكود "${c}" مستخدم بالفعل!`); return; }
        }
    }

    const stockCodesData = window._stockCodesData || [];
    const suppliersDetails = stockCodesData.map(c => ({ code: c.code, supplier_name: c.supplier_name, supplier_order_id: c.order_id }));

    const playerReceiptFile = document.getElementById('player-receipt-file')?.files[0];
    if (hasPlayerId && !playerReceiptFile) {
        showToast('⚠️ يجب رفع إيصال التنفيذ قبل القبول!');
        document.getElementById('player-receipt-file')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('player-receipt-file').style.border = '2px solid #ef4444';
        return;
    }

    let playerReceiptUrl = null;
    if (playerReceiptFile) {
        try {
            const fileName = `player-receipts/${orderId}_${Date.now()}`;
            const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, playerReceiptFile);
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
                playerReceiptUrl = urlData?.publicUrl;
            }
        } catch (e) { console.warn('تعذر رفع الإيصال:', e); }
    }

    const { data: orderData, error } = await supabase.from('orders').update({
        status: 'مكتمل',
        card_code: hasPlayerId ? null : codes.join('\n'),
        cost_price: parseFloat(cost),
        supplier_id: supplierId,
        supplier_order_id: supplierOrderId,
        suppliers_details: suppliersDetails.length > 0 ? suppliersDetails : null,
        approved_by_name: window.STAFF_NAME || window.CURRENT_USER?.email || 'أدمن',
        ...(playerReceiptUrl && { execution_receipt_url: playerReceiptUrl })
    }).eq('id', orderId).select().single();

    if (error) { showToast('❌ خطأ: ' + error.message); return; }

    if (!hasPlayerId) {
        for (const c of codes) {
            await supabase.from('used_codes').insert({ code: c, order_id: orderId, product_name: orderData?.product_name || '' });
        }

        const reservedIds = window._reservedStockIds;
        if (reservedIds?.length > 0) {
            await supabase.from('stocks').update({ status: 'sold', sold_at: new Date().toISOString(), order_id: orderId }).in('id', reservedIds);
            window._reservedStockIds = null;
            window._stockCodesData = null;
        } else {
            for (const code of codes) {
                await supabase.from('stocks').update({ status: 'sold', sold_at: new Date().toISOString(), order_id: orderId }).eq('code', code).eq('status', 'available');
            }
        }
    }

    document.getElementById('order-modal').remove();
    showToast('✅ تم قبول الطلب بنجاح!');
    loadOrders();
};

window.approveGroupOrders = async () => {
    const items = window._groupItems || [];
    if (!items.length) return;

    for (let i = 0; i < items.length; i++) {
        const hasPI = !!items[i].player_id;
        const codesRaw = document.getElementById(`code-${i}`)?.value.trim() || '';
        const codes = hasPI ? [] : codesRaw.split('\n').map(c => c.trim()).filter(c => c !== '');
        const cost = document.getElementById(`modal-cost${i}`)?.value.trim();
        const supplier = document.getElementById(`supplier-${i}`)?.value.trim();
        const qty = items[i].quantity || 1;

        if (!hasPI && !codes.length) { showToast(`⚠️ العنصر ${i + 1}: يرجى إدخال الأكواد!`); return; }
        if (!hasPI && codes.length !== qty) { showToast(`⚠️ العنصر ${i + 1}: عدد الأكواد لا يطابق الكمية!`); return; }
        if (!cost || parseFloat(cost) <= 0) { showToast(`⚠️ العنصر ${i + 1}: يرجى إدخال سعر التكلفة!`); return; }
        if (!supplier) { showToast(`⚠️ العنصر ${i + 1}: يرجى إدخال اسم المورد!`); return; }

        if (!hasPI) {
            for (const c of codes) {
                const { data: existing } = await supabase.from('used_codes').select('id').eq('code', c).maybeSingle();
                if (existing) { showToast(`⚠️ الكود "${c}" مستخدم بالفعل!`); return; }
            }
        }
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const hasPI = !!item.player_id;
        const codes = hasPI ? [] : document.getElementById(`code-${i}`).value.trim().split('\n').map(c => c.trim()).filter(c => c !== '');
        const cost = document.getElementById(`modal-cost${i}`).value.trim();
        const supplierId = document.getElementById(`supplier-${i}`).value.trim();
        const supplierOrderId = document.getElementById(`supplier-order-${i}`)?.value.trim() || '';
        const stockData = window._groupStockData?.[i];

        const { data: orderData, error } = await supabase.from('orders').update({
            status: 'مكتمل',
            card_code: hasPI ? null : codes.join('\n'),
            cost_price: parseFloat(cost),
            supplier_id: supplierId,
            supplier_order_id: supplierOrderId,
            suppliers_details: stockData?.suppliersDetails?.length > 0 ? stockData.suppliersDetails : null,
            approved_by_name: window.STAFF_NAME || window.CURRENT_USER?.email || 'أدمن'
        }).eq('id', item.id).select().single();

        if (error) { showToast(`❌ خطأ في الطلب ${i + 1}: ` + error.message); return; }

        if (!hasPI) {
            for (const c of codes) {
                await supabase.from('used_codes').insert({ code: c, order_id: item.id, product_name: orderData?.product_name || '' });
            }
            if (stockData?.stockIds?.length > 0) {
                await supabase.from('stocks').update({ status: 'sold', sold_at: new Date().toISOString(), order_id: item.id }).in('id', stockData.stockIds);
            } else {
                for (const code of codes) {
                    await supabase.from('stocks').update({ status: 'sold', sold_at: new Date().toISOString(), order_id: item.id }).eq('code', code).eq('status', 'available');
                }
            }
        }
    }

    window._groupItems = null; window._groupStockData = null;
    document.getElementById('order-modal').remove();
    showToast(`✅ تم قبول ${items.length} طلب بنجاح!`);
    loadOrders();
};

window.rejectOrder = async (orderId) => {
    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) { showToast('⚠️ يرجى إدخال سبب الرفض!'); return; }
    if (!confirm(`هل تريد رفض هذا الطلب؟\nالسبب: ${reason}`)) return;

    const { error } = await supabase.from('orders').update({
        status: 'ملغي',
        reject_reason: reason,
        approved_by_name: window.STAFF_NAME || window.CURRENT_USER?.email || 'أدمن'
    }).eq('id', orderId);

    if (error) { showToast('❌ خطأ: ' + error.message); return; }
    window._reservedStockIds = null; window._stockCodesData = null;
    document.getElementById('order-modal').remove();
    showToast('تم رفض الطلب.');
    loadOrders();
};

window.rejectGroupOrders = async () => {
    const items = window._groupItems || [];
    const reason = document.getElementById('group-reject-reason')?.value.trim();
    if (!reason) { showToast('⚠️ يرجى إدخال سبب الرفض!'); return; }
    if (!confirm(`هل تريد رفض ${items.length} طلب؟`)) return;

    for (const item of items) {
        await supabase.from('orders').update({
            status: 'ملغي',
            reject_reason: reason,
            approved_by_name: window.STAFF_NAME || window.CURRENT_USER?.email || 'أدمن'
        }).eq('id', item.id);
    }

    window._groupItems = null; window._groupStockData = null;
    document.getElementById('order-modal').remove();
    showToast(`تم رفض ${items.length} طلب.`);
    loadOrders();
};

async function checkNewOrders() {
    const { data: orders } = await supabase.from('orders').select('id, order_number').not('status', 'in', '("مكتمل","ملغي","مسترد")');
    const count = new Set((orders || []).map(o => o.order_number || o.id)).size;
    const badge = document.getElementById('orders-badge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
    document.title = count > 0 ? `(${count}) طلب جديد | إدارة الطلبات` : 'إدارة الطلبات | StoreCard';
}

window.filterOrders = () => {
    const search = document.getElementById('orderSearch').value.trim().toLowerCase();
    document.querySelectorAll('#admin-orders-list tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(search) ? '' : 'none';
    });
};

// ==================== DOMContentLoaded ====================
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    loadCompletedOrders();
    checkNewOrders();
    subscribeToOrderUpdates();
    supabase.channel('orders-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            loadOrders();
            loadCompletedOrders();
            checkNewOrders();
        })
        .subscribe();
    setInterval(checkNewOrders, 1000);
});

function showToast(message, type = 'success') {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.textContent = message;
    t.style.cssText = `
        position:fixed; top:24px; left:50%;
        transform:translateX(-50%) translateY(-10px);
        background:${type === 'success' ? '#22c55e' : '#ef4444'};
        color:white; padding:12px 24px; border-radius:10px;
        font-size:14px; font-weight:700; font-family:'Tajawal',sans-serif;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
        opacity:0; transition:opacity 0.3s,transform 0.3s;
        pointer-events:none; white-space:nowrap;
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
        t.style.opacity = '1';
        t.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => t.remove(), 300);
    }, 2800);
}

function getThemeColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        modalBg: isLight ? '#ffffff' : '#1e293b',
        deepBg: isLight ? '#f8fafc' : '#0f172a',
        border: isLight ? '#e2e8f0' : '#334155',
        text: isLight ? '#1e293b' : '#e2e8f0',
        textMuted: isLight ? '#64748b' : '#94a3b8',
        inputBg: isLight ? '#f8fafc' : '#0f172a',
        inputBorder: isLight ? '#e2e8f0' : '#334155',
        inputColor: isLight ? '#1e293b' : '#e2e8f0',
        cardBg: isLight ? '#f1f5f9' : '#0f172a',
        cardBorder: isLight ? '#e2e8f0' : '#1e3a5f',
    };
}

// ==================== Modal الاسترداد ====================
window.quickRefund = async (orderId, paymentMethod) => {
    const { data: order, error } = await supabase
        .from('orders')
        .select('id, user_id, price, quantity, payment_method, paymentMethod, customer_name, customer_phone, sender_phone, product_name, label, order_number, created_at')
        .eq('id', orderId)
        .single();

    if (error || !order) { showToast('❌ خطأ في جلب الطلب', 'error'); return; }

    const pm = order.paymentMethod || order.payment_method || '';
    const refundAmount = (order.price || 0) * (order.quantity || 1);
    const isWallet = pm === 'المحفظة' || pm === 'محفظة';
    const c = getThemeColors();

    document.getElementById('refund-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'refund-modal';
    modal.style.cssText = `
        position:fixed; inset:0;
        background:rgba(0,0,0,0.75); backdrop-filter:blur(4px);
        z-index:99999; display:flex; align-items:center; justify-content:center;
        padding:20px; animation:refundFadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <style>
            @keyframes refundFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes refundSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
            .refund-box { background:${c.modalBg}; border:1px solid ${c.border}; border-radius:20px; padding:28px; width:100%; max-width:460px; color:${c.text}; font-family:'Tajawal','Segoe UI',sans-serif; animation:refundSlideUp 0.25s ease; overflow-y:auto; max-height:90vh; }
            .refund-title { text-align:center; font-size:18px; font-weight:800; color:#f59e0b; margin-bottom:20px; display:flex; align-items:center; justify-content:center; gap:8px; }
            .refund-row { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-radius:10px; background:${c.deepBg}; border:1px solid ${c.border}; margin-bottom:8px; font-size:13px; }
            .refund-row .label { color:${c.textMuted}; }
            .refund-row .value { font-weight:700; color:${c.text}; }
            .refund-amount-box { background:rgba(245,158,11,0.1); border:2px solid #f59e0b; border-radius:12px; padding:14px; text-align:center; margin:14px 0; }
            .refund-note { background:${isWallet ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)'}; border:1px solid ${isWallet ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}; border-radius:10px; padding:10px 14px; font-size:12px; color:${isWallet ? '#22c55e' : '#f59e0b'}; margin-bottom:16px; display:flex; align-items:flex-start; gap:8px; line-height:1.6; }
            .refund-btn-confirm { width:100%; padding:13px; background:linear-gradient(135deg,#f59e0b,#d97706); color:white; border:none; border-radius:10px; font-size:15px; font-weight:800; cursor:pointer; font-family:'Tajawal','Segoe UI',sans-serif; box-shadow:0 4px 14px rgba(245,158,11,0.35); transition:opacity 0.2s,transform 0.15s; margin-bottom:8px; }
            .refund-btn-confirm:hover { opacity:0.9; transform:translateY(-1px); }
            .refund-btn-cancel { width:100%; padding:11px; background:${c.deepBg}; color:${c.textMuted}; border:1px solid ${c.border}; border-radius:10px; font-size:14px; cursor:pointer; font-family:'Tajawal','Segoe UI',sans-serif; transition:background 0.2s; }
            .refund-btn-cancel:hover { background:rgba(239,68,68,0.1); color:#ef4444; border-color:#ef4444; }
        </style>
        <div class="refund-box">
            <div class="refund-title"><i class="fas fa-undo"></i> تأكيد الاسترداد</div>
            <div class="refund-row"><span class="label"><i class="fas fa-hashtag"></i> رقم الطلب</span><span class="value" style="font-family:monospace;color:#f97316;">${order.order_number || '#' + orderId.substring(0, 8)}</span></div>
            <div class="refund-row"><span class="label"><i class="fas fa-box"></i> المنتج</span><span class="value">${order.product_name || '—'} ${order.label ? `<span style="color:#f97316;font-size:12px;">(${order.label})</span>` : ''}</span></div>
            <div class="refund-row"><span class="label"><i class="fas fa-user"></i> العميل</span><span class="value">${order.customer_name || '—'}</span></div>
            ${(order.sender_phone || order.customer_phone) ? `
            <div class="refund-row">
                <span class="label"><i class="fas fa-phone"></i> ${order.sender_phone ? 'الرقم المرسل منه' : 'الهاتف'}</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="value" style="font-family:monospace;direction:ltr;${order.sender_phone ? 'color:#22c55e;' : ''}">${order.sender_phone || order.customer_phone}</span>
                    <button onclick="navigator.clipboard.writeText('${order.sender_phone || order.customer_phone}').then(() => { this.innerHTML='<i class=\\'fas fa-check\\'></i>'; setTimeout(() => this.innerHTML='<i class=\\'fas fa-copy\\'></i>', 1500); })"
                        style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px;">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>` : ''}
            <div class="refund-row"><span class="label"><i class="fas fa-credit-card"></i> طريقة الدفع</span><span class="value">${pm || '—'}</span></div>
            <div class="refund-amount-box">
                <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">المبلغ الذي سيُسترد</div>
                <div style="font-size:28px;font-weight:900;color:#f59e0b;">${refundAmount} <span style="font-size:14px;font-weight:600;">MRU</span></div>
                ${order.quantity > 1 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${order.price} MRU × ${order.quantity} قطعة</div>` : ''}
            </div>
            <div class="refund-note">
                <i class="fas fa-${isWallet ? 'wallet' : 'exclamation-triangle'}" style="margin-top:2px;flex-shrink:0;"></i>
                <span>${isWallet ? `سيتم إعادة <strong>${refundAmount} MRU</strong> تلقائياً إلى محفظة العميل فور التأكيد.` : `طريقة الدفع يدوية — ستحتاج إلى إعادة المبلغ يدوياً عبر <strong>${pm}</strong>.`}</span>
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">
                    <i class="fas fa-receipt" style="color:#f59e0b;"></i> إيصال الاسترداد (اختياري)
                </label>
                <input type="file" id="refund-receipt-file" accept="image/*"
                    style="width:100%; padding:10px; background:${c.deepBg}; border:1px solid ${c.border}; border-radius:8px; color:${c.text}; font-size:13px; box-sizing:border-box; cursor:pointer;">
                <div id="refund-receipt-preview" style="display:none; margin-top:8px; border-radius:10px; overflow:hidden; border:1px solid ${c.border};">
                    <img id="refund-receipt-img" style="width:100%; max-height:150px; object-fit:cover; display:block;">
                </div>
            </div>
            <button class="refund-btn-confirm" id="refund-confirm-btn"
                onclick="executeRefund('${orderId}', '${pm}', ${refundAmount}, '${order.user_id}')">
                <i class="fas fa-check-circle"></i> تأكيد الاسترداد
            </button>
            <button class="refund-btn-cancel" onclick="document.getElementById('refund-modal').remove()">إلغاء</button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('refund-receipt-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('refund-receipt-img').src = ev.target.result;
            document.getElementById('refund-receipt-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
};

window.executeRefund = async (orderId, pm, refundAmount, userId) => {
    const btn = document.getElementById('refund-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاسترداد...'; }

    let refundReceiptUrl = null;
    const receiptFile = document.getElementById('refund-receipt-file')?.files[0];
    if (receiptFile) {
        try {
            const fileName = `refunds/${orderId}_${Date.now()}`;
            const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, receiptFile);
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
                refundReceiptUrl = urlData?.publicUrl;
            }
        } catch (e) { console.warn('تعذر رفع إيصال الاسترداد:', e); }
    }

    await supabase.from('orders').update({
        status: 'مسترد',
        approved_by_name: window.STAFF_NAME || window.CURRENT_USER?.email || 'أدمن',
        ...(refundReceiptUrl && { refund_receipt_url: refundReceiptUrl })
    }).eq('id', orderId);

    const isWallet = pm === 'المحفظة' || pm === 'محفظة';
    if (isWallet && userId) {
        const { data: userData } = await supabase.from('users').select('balance').eq('id', userId).single();
        const newBalance = (userData?.balance || 0) + refundAmount;
        await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('wallet_transactions').insert({
            user_id: userId,
            type: 'charge',
            amount: refundAmount,
            payment_method: 'استرداد طلب',
            status: 'مكتمل',
            receipt_url: refundReceiptUrl || null,
            created_at: new Date().toISOString()
        });
        showToast(`✅ تم الاسترداد — أُضيف ${refundAmount} MRU للمحفظة`);
    } else {
        showToast('✅ تم تغيير الحالة إلى مسترد — الإرجاع يدوي');
    }

    document.getElementById('refund-modal')?.remove();
    loadOrders();
};

window.quickRefundGroup = async (ids, paymentMethod) => {
    if (ids.length === 1) return window.quickRefund(ids[0], paymentMethod);

    const { data: orders } = await supabase
        .from('orders')
        .select('id, price, quantity, product_name, label, customer_name, customer_phone, order_number, payment_method, paymentMethod, user_id')
        .in('id', ids);

    if (!orders?.length) { showToast('❌ خطأ في جلب الطلبات', 'error'); return; }

    const totalAmount = orders.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);
    const pm = orders[0].paymentMethod || orders[0].payment_method || '';
    const isWallet = pm === 'المحفظة' || pm === 'محفظة';
    const c = getThemeColors();

    document.getElementById('refund-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'refund-modal';
    modal.style.cssText = `position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto;`;

    modal.innerHTML = `
        <div style="background:${c.modalBg};border:1px solid ${c.border};border-radius:20px;padding:28px;width:100%;max-width:500px;color:${c.text};font-family:'Tajawal','Segoe UI',sans-serif;margin:auto;">
            <div style="text-align:center;font-size:18px;font-weight:800;color:#f59e0b;margin-bottom:20px;">
                <i class="fas fa-undo"></i> استرداد مجموعة (${orders.length} طلب)
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;max-height:240px;overflow-y:auto;">
                ${orders.map(o => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:10px;background:${c.deepBg};border:1px solid ${c.border};font-size:13px;">
                    <span style="color:${c.textMuted};">${o.product_name || '—'} ${o.label ? `<span style="color:#f97316;">(${o.label})</span>` : ''}</span>
                    <span style="font-weight:700;color:#f59e0b;">${(o.price || 0) * (o.quantity || 1)} MRU</span>
                </div>`).join('')}
            </div>
            <div style="background:rgba(245,158,11,0.1);border:2px solid #f59e0b;border-radius:12px;padding:14px;text-align:center;margin-bottom:14px;">
                <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">إجمالي المبلغ المُسترد</div>
                <div style="font-size:26px;font-weight:900;color:#f59e0b;">${totalAmount} <span style="font-size:14px;font-weight:600;">MRU</span></div>
            </div>
            <div style="background:${isWallet ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)'};border:1px solid ${isWallet ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'};border-radius:10px;padding:10px 14px;font-size:12px;color:${isWallet ? '#22c55e' : '#f59e0b'};margin-bottom:16px;display:flex;align-items:flex-start;gap:8px;line-height:1.6;">
                <i class="fas fa-${isWallet ? 'wallet' : 'exclamation-triangle'}" style="margin-top:2px;flex-shrink:0;"></i>
                <span>${isWallet ? `سيتم إعادة <strong>${totalAmount} MRU</strong> تلقائياً إلى محفظة العميل.` : `طريقة الدفع يدوية — ستحتاج إلى الإرجاع يدوياً عبر <strong>${pm}</strong>.`}</span>
            </div>
            <button id="refund-confirm-btn"
                onclick="executeGroupRefund(${JSON.stringify(ids).replace(/"/g, '&quot;')}, '${pm}', ${totalAmount}, '${orders[0].user_id}')"
                style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#d97706);color:white;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Tajawal','Segoe UI',sans-serif;box-shadow:0 4px 14px rgba(245,158,11,0.35);margin-bottom:8px;">
                <i class="fas fa-check-circle"></i> تأكيد استرداد ${orders.length} طلب
            </button>
            <button onclick="document.getElementById('refund-modal').remove()"
                style="width:100%;padding:11px;background:${c.deepBg};color:${c.textMuted};border:1px solid ${c.border};border-radius:10px;font-size:14px;cursor:pointer;font-family:'Tajawal','Segoe UI',sans-serif;">
                إلغاء
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window.executeGroupRefund = async (ids, pm, totalAmount, userId) => {
    const btn = document.getElementById('refund-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاسترداد...'; }

    for (const id of ids) {
        await supabase.from('orders').update({
            status: 'مسترد',
            approved_by_name: window.STAFF_NAME || window.CURRENT_USER?.email || 'أدمن'
        }).eq('id', id);
    }

    const isWallet = pm === 'المحفظة' || pm === 'محفظة';
    if (isWallet && userId) {
        const { data: userData } = await supabase.from('users').select('balance').eq('id', userId).single();
        const newBalance = (userData?.balance || 0) + totalAmount;
        await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('wallet_transactions').insert({
            user_id: userId,
            type: 'charge',
            amount: totalAmount,
            payment_method: 'استرداد طلب',
            status: 'مكتمل',
            created_at: new Date().toISOString()
        });
        showToast(`✅ تم استرداد ${ids.length} طلب — أُضيف ${totalAmount} MRU للمحفظة`);
    } else {
        showToast(`✅ تم تغيير ${ids.length} طلب إلى مسترد — الإرجاع يدوي`);
    }

    document.getElementById('refund-modal')?.remove();
    loadOrders();
};

// ==================== جدول الطلبات المكتملة ====================
let allCompletedGrouped = [];
let completedPage = 1;
const COMPLETED_PAGE_SIZE = 10;

async function loadCompletedOrders() {
    const container = document.getElementById('completed-orders-list');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="10" style="text-align:center;">جاري التحميل...</td></tr>';

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, products(image)')
        .in('status', ['مكتمل', 'مسترد', 'ملغي'])
        .order('created_at', { ascending: false })
        .limit(200);

    if (error || !orders?.length) {
        container.innerHTML = '<tr><td colspan="10" style="text-align:center;">لا توجد طلبات مكتملة</td></tr>';
        return;
    }

    const groupedMap = {};
    orders.forEach(order => {
        const key = order.order_number || order.id;
        if (!groupedMap[key]) groupedMap[key] = { ...order, items: [], totalPrice: 0 };
        groupedMap[key].items.push(order);
        groupedMap[key].totalPrice += (order.price || 0) * (order.quantity || 1);
    });

    allCompletedGrouped = Object.values(groupedMap).sort((a, b) => {
        const aDate = Math.max(...a.items.map(i => new Date(i.created_at).getTime()));
        const bDate = Math.max(...b.items.map(i => new Date(i.created_at).getTime()));
        return bDate - aDate;
    });
    renderCompletedPage(1);
}

function renderCompletedPage(page) {
    const container = document.getElementById('completed-orders-list');
    if (!container) return;

    const total = allCompletedGrouped.length;
    const totalPages = Math.ceil(total / COMPLETED_PAGE_SIZE);
    completedPage = Math.max(1, Math.min(page, totalPages));

    const start = (completedPage - 1) * COMPLETED_PAGE_SIZE;
    const slice = allCompletedGrouped.slice(start, start + COMPLETED_PAGE_SIZE);

    const statusColor = { 'مكتمل': '#22c55e', 'ملغي': '#ef4444', 'مسترد': '#f59e0b' };

    container.innerHTML = slice.map(group => {
        const date = new Date(group.created_at).toLocaleString('fr-FR');
        const orderNum = group.order_number || '#' + group.id?.substring(0, 7);
        const pm = group.paymentMethod || group.payment_method || '-';
        const color = statusColor[group.items[0]?.status] || '#94a3b8';

        const imagesCell = group.items.map(item => {
            const img = item.products?.image;
            return img ? `<img src="${img}" style="width:32px;height:32px;object-fit:contain;background:white;border-radius:5px;padding:2px;margin:1px;">` : '';
        }).join('');

        const productsCell = group.items.map(item => `
            <div style="font-size:12px;margin-bottom:2px;">
                <span>${item.product_name || '—'}</span>
                ${item.label ? `<span style="color:#f97316;margin-right:4px;">(${item.label})</span>` : ''}
                ${item.player_id ? `<span style="color:#22c55e;font-size:10px;margin-right:4px;">🎮</span>` : ''}
            </div>`
        ).join('');

        const firstItem = group.items[0];
        const isAuto = group.items.some(i => i.auto_approved);
        const approvedBy = [...new Set(group.items.map(i => i.approved_by_name || i.completed_by_name).filter(Boolean))].join(' / ');

        const statusBadge = `
            <div style="display:flex;flex-direction:column;gap:4px;">
                <span style="background:${color}22;color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">
                    ${firstItem?.status || '—'}
                </span>
                ${(firstItem?.status === 'مكتمل' || firstItem?.status === 'مسترد')
                ? isAuto
                    ? `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(59,130,246,0.12);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;"><i class="fas fa-box"></i> مخزون</span>`
                    : approvedBy
                        ? `<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(168,85,247,0.12);color:#c084fc;border:1px solid rgba(168,85,247,0.3);padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;" title="${approvedBy}"><i class="fas fa-user-check"></i> ${approvedBy}</span>`
                        : ''
                : ''}
            </div>`;

        return `
        <tr>
            <td style="color:#f97316;font-weight:bold;font-size:12px;">${orderNum}</td>
            <td>
                <div style="font-size:12px;font-weight:700;">${group.customer_name || '—'}</div>
                ${group.customer_phone ? `<div style="font-size:11px;color:#64748b;font-family:monospace;direction:ltr;">${group.customer_phone}</div>` : ''}
            </td>
            <td>${imagesCell || '—'}</td>
            <td>${productsCell}</td>
            <td><strong>${group.totalPrice} ${group.items[0]?.currency || 'MRU'}</strong></td>
            <td>${group.items.reduce((s, o) => s + (o.quantity || 1), 0)}</td>
            <td><small style="color:#94a3b8;">${date}</small></td>
            <td style="font-size:12px;">${pm}</td>
            <td>${statusBadge}</td>
        </tr>`;
    }).join('');

    document.getElementById('completed-pagination')?.remove();
    if (totalPages > 1) {
        const pag = document.createElement('div');
        pag.id = 'completed-pagination';
        pag.style.cssText = 'display:flex;justify-content:center;gap:6px;padding:14px;flex-wrap:wrap;';
        for (let i = 1; i <= totalPages; i++) {
            pag.innerHTML += `
                <button onclick="renderCompletedPage(${i})"
                    style="padding:6px 12px;border-radius:7px;cursor:pointer;font-size:12px;
                           border:1px solid ${i === completedPage ? '#f97316' : '#334155'};
                           background:${i === completedPage ? '#f97316' : 'transparent'};
                           color:${i === completedPage ? 'white' : '#94a3b8'};">
                    ${i}
                </button>`;
        }
        document.getElementById('completed-section')?.appendChild(pag);
    }
}

window.renderCompletedPage = renderCompletedPage;
window.filterCompleted = () => {
    const q = document.getElementById('completed-search')?.value.toLowerCase().trim() || '';
    document.querySelectorAll('#completed-orders-list tr').forEach(row => {
        row.style.display = !q || row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
};
window.loadOrders = loadOrders;
window.loadCompletedOrders = loadCompletedOrders;

// ==================== إشعارات العميل ====================
async function subscribeToOrderUpdates() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const userId = session.user.id;

    supabase.channel('customer-orders')
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'orders',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const order = payload.new;
            const status = order.status;

            if (status === 'مكتمل') {
                showCustomerNotification({
                    title: '✅ تم إكمال طلبك!',
                    body: `${order.product_name} ${order.label ? `(${order.label})` : ''}`,
                    code: order.card_code, color: '#22c55e', orderId: order.order_number
                });
            } else if (status === 'ملغي') {
                showCustomerNotification({
                    title: '❌ تم رفض طلبك',
                    body: `${order.product_name} — السبب: ${order.reject_reason || 'غير محدد'}`,
                    color: '#ef4444', orderId: order.order_number
                });
            } else if (status === 'مسترد') {
                showCustomerNotification({
                    title: '↩️ تم استرداد طلبك',
                    body: `${order.product_name} — ${(order.price || 0) * (order.quantity || 1)} MRU`,
                    color: '#f59e0b', orderId: order.order_number
                });
            }
        })
        .subscribe();
}

function showCustomerNotification({ title, body, code, color, orderId }) {
    document.getElementById('_customer-notif')?.remove();

    const notif = document.createElement('div');
    notif.id = '_customer-notif';
    notif.style.cssText = `
        position:fixed; top:20px; left:50%; transform:translateX(-50%);
        background:#1e293b; border:2px solid ${color}; border-radius:16px;
        padding:20px 24px; min-width:320px; max-width:420px;
        z-index:999999; box-shadow:0 8px 32px rgba(0,0,0,0.4);
        font-family:'Tajawal',sans-serif; animation:notifSlideDown 0.4s ease; direction:rtl;
    `;

    notif.innerHTML = `
        <style>@keyframes notifSlideDown { from{opacity:0;transform:translateX(-50%) translateY(-20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }</style>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:16px;font-weight:800;color:${color};">${title}</span>
            <button onclick="document.getElementById('_customer-notif').remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <div style="font-size:13px;color:#e2e8f0;margin-bottom:${code ? '12px' : '0'};">${body}</div>
        ${code ? `
        <div style="background:#0f172a;border:1px solid ${color};border-radius:10px;padding:12px;margin-top:8px;">
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">🔑 الكود:</div>
            <div style="font-family:monospace;font-size:15px;color:${color};font-weight:700;letter-spacing:1px;">${code.split('\n').join('<br>')}</div>
            <button onclick="navigator.clipboard.writeText(this.dataset.code);this.innerHTML='✅ تم النسخ!';setTimeout(()=>this.innerHTML='📋 نسخ الكود',2000);"
                data-code="${code.replace(/"/g, '&quot;')}"
                style="width:100%;margin-top:10px;padding:8px;background:${color};color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;font-family:'Tajawal',sans-serif;">
                📋 نسخ الكود
            </button>
        </div>` : ''}
        <div style="margin-top:12px;">
            <a href="orders.html" style="display:block;text-align:center;padding:8px;background:rgba(249,115,22,0.15);color:#f97316;border:1px solid #f97316;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">
                📋 عرض الطلبات
            </a>
        </div>
    `;

    document.body.appendChild(notif);

    if (!code) {
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transition = 'opacity 0.4s';
            setTimeout(() => notif?.remove(), 400);
        }, 8000);
    }

    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/assets/Icon.png' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}