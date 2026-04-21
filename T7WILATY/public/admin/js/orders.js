import { supabase } from '../../js/supabase-config.js';

const USD_TO_MRU = 43;

// ==================== تحميل الطلبات ====================
// ==================== تحميل الطلبات ====================
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

    // ✅ عرض الطلبات فوراً بدون انتظار
    renderOrders(orders);

    // ✅ معالجة المحفظة في الخلفية بدون انتظار
    processWalletOrders(orders);
}

// ==================== عرض الطلبات ====================
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

    const groupedOrders = Object.values(groupedMap);

    if (groupedOrders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>';
        return;
    }

    ordersList.innerHTML = groupedOrders.map(group => {
        const date          = group.created_at ? new Date(group.created_at).toLocaleString('ar-EG') : 'غير محدد';
        const paymentMethod = group.paymentMethod || group.payment_method || '-';
        const receiptUrl    = group.receiptUrl || group.receipt_url;
        const receiptBtn    = receiptUrl
            ? `<a href="${receiptUrl}" target="_blank" class="btn-check" title="عرض الإيصال"><i class="fas fa-receipt"></i></a>`
            : '-';

        const imagesCell = group.items.map(item => {
            const img = item.products?.image;
            return img ? `<img src="${img}" style="width:36px;height:36px;object-fit:contain;background:white;border-radius:5px;padding:2px;margin:1px;" title="${item.product_name || ''}">` : '';
        }).join('');

        const productsCell = group.items.map(item =>
            `<div style="font-size:12px;margin-bottom:3px;">
                <span class="order-product-name">${item.product_name || 'غير محدد'}</span>
                ${item.label ? `<span style="color:#f97316;margin-right:4px;">(${item.label})</span>` : ''}
                ${group.items.length > 1 ? `<span style="color:var(--text-muted);">× ${item.quantity || 1}</span>` : ''}
            </div>`
        ).join('');

        const totalQty  = group.items.reduce((s, o) => s + (o.quantity || 1), 0);
        const acceptBtn = group.items.length === 1
    ? `<div style="display:flex;flex-direction:column;gap:6px;">
        <button onclick="openOrderModal(${JSON.stringify(group.items[0]).replace(/"/g, '&quot;')})"
            style="background:#22c55e;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
            <i class="fas fa-check-circle"></i> قبول
        </button>
        <button onclick="quickRefund('${group.items[0].id}', '${group.items[0].paymentMethod || group.items[0].payment_method || ''}')"
            style="background:#f59e0b;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
            <i class="fas fa-undo"></i> استرداد
        </button>
       </div>`
    : `<div style="display:flex;flex-direction:column;gap:6px;">
        <button onclick="openGroupOrderModal(${JSON.stringify(group.items).replace(/"/g, '&quot;')})"
            style="background:#3b82f6;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
            <i class="fas fa-layer-group"></i> قبول المجموعة (${group.items.length})
        </button>
        <button onclick="quickRefundGroup(${JSON.stringify(group.items.map(i=>i.id)).replace(/"/g,'&quot;')}, '${group.paymentMethod || group.payment_method || ''}')"
            style="background:#f59e0b;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">
            <i class="fas fa-undo"></i> استرداد المجموعة
        </button>
       </div>`;

        return `
            <tr id="order-row-${group.order_number || group.id}">
                <td style="color:#f97316; font-weight:bold;">${group.order_number || '#' + group.id.substring(0, 7)}</td>
                <td>${group.customer_name || 'غير معروف'}</td>
                <td>${imagesCell || '-'}</td>
                <td>${productsCell}</td>
                <td>—</td>
                <td><strong>${group.totalPrice} MRU</strong></td>
                <td>${totalQty}</td>
                <td><small>${date}</small></td>
                <td>${paymentMethod}</td>
                <td>${receiptBtn}</td>
                <td>${acceptBtn}</td>
            </tr>
        `;
    }).join('');
}

// ==================== معالجة المحفظة في الخلفية ====================
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

    // إعادة تحميل فقط إذا تم قبول طلب
    if (anyApproved) loadOrders();
}

// ==================== قبول تلقائي ====================
async function tryAutoApproveFromStock(order) {
    const quantity  = order.quantity || 1;
    const productId = order.product_id;
    const label     = order.label;
    if (!productId || !label) return false;

    const { data: availableCodes, error } = await supabase
        .from('stocks').select('*')
        .eq('product_id', productId).eq('price_label', label).eq('status', 'available')
        .order('created_at', { ascending: true }).limit(quantity);

    if (error || !availableCodes || availableCodes.length < quantity) return false;

    const codes    = availableCodes.map(c => c.code);
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

// ==================== بناء قسم السحب + السيليكت ====================
function buildStockSection({ suffix = '', productId, label, quantity, orderPrice, prices = [] }) {
    const c          = getThemeColors();
    const priceObj   = (prices || []).find(p => p.label === label) || prices[0] || {};
    const suppliers  = priceObj.suppliers || [];
    const inputStyle = `width:100%; padding:9px 12px; background:${c.inputBg}; border:1px solid ${c.inputBorder}; border-radius:8px; color:${c.inputColor}; font-family:inherit; font-size:13px;`;

    const suppliersSelectHTML = suppliers.length > 0 ? `
        <div id="supplier-select-wrap${suffix}" style="margin-top:10px; display:none;">
            <label style="font-size:12px; color:${c.textMuted}; display:block; margin-bottom:5px;">🔗 اختر المورد للشراء</label>
            <div style="display:flex; gap:8px; align-items:center;">
                <select id="supplier-select${suffix}"
                    onchange="onSupplierSelectChange('${suffix}')"
                    style="${inputStyle} flex:1; border-color:#3b82f6; cursor:pointer;">
                    <option value="">-- اختر مورداً --</option>
                    ${suppliers.map(s => `<option value="${s.url || ''}" data-name="${s.name}">${s.name}</option>`).join('')}
                </select>
                <a id="buy-btn${suffix}" href="#" target="_blank"
                    style="display:none; padding:9px 16px; background:#f97316; color:white;
                           border-radius:8px; text-decoration:none; font-size:13px; font-weight:700;
                           white-space:nowrap;"
                    onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                    <i class="fas fa-shopping-cart"></i> شراء
                </a>
            </div>
        </div>
    ` : '';

    return `
        <div>
            <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">💵 سعر التكلفة ($) — لكود واحد</label>
            <input type="number" id="modal-cost${suffix}" placeholder="0.00" step="0.01"
                oninput="calcProfit${suffix === '' ? '(' + orderPrice + ')' : 'Item(' + suffix + ',' + orderPrice + ')'}"
                style="${inputStyle} width:100%; box-sizing:border-box;">

            <button onclick="loadFromStock${suffix === '' ? '(\'' + productId + '\',\'' + label + '\',' + quantity + ',' + orderPrice + ')' : 'ForItem(' + suffix + ',\'' + productId + '\',\'' + label + '\',' + quantity + ',' + orderPrice + ')'}"
                style="width:100%; margin-top:10px; padding:10px; background:rgba(59,130,246,0.15);
                    color:#3b82f6; border:1px solid #3b82f6; border-radius:8px;
                    cursor:pointer; font-size:13px; font-weight:bold; transition:0.2s;"
                onmouseover="this.style.background='rgba(59,130,246,0.3)'"
                onmouseout="this.style.background='rgba(59,130,246,0.15)'">
                <i class="fas fa-box-open"></i> سحب من المخزون
            </button>
            <p id="stock-status${suffix}" style="font-size:11px; color:${c.textMuted}; margin-top:5px; text-align:center;"></p>

            ${suppliersSelectHTML}
        </div>
    `;
}

// ==================== تغيير السيليكت → إظهار زر الشراء ====================
window.onSupplierSelectChange = (suffix) => {
    const sel    = document.getElementById(`supplier-select${suffix}`);
    const buyBtn = document.getElementById(`buy-btn${suffix}`);
    const selectedOpt = sel.options[sel.selectedIndex];

    if (sel.value) {
        buyBtn.href         = sel.value;
        buyBtn.style.display = 'inline-flex';
        buyBtn.style.alignItems = 'center';
        buyBtn.style.gap    = '6px';
        // تحديث حقل المورد تلقائياً
        const supplierField = document.getElementById(`modal-supplier-id${suffix === '' ? '' : '-' + suffix}`);
        if (supplierField) supplierField.value = selectedOpt.dataset.name || '';
    } else {
        buyBtn.style.display = 'none';
    }
};

// ==================== فتح Modal طلب واحد ====================
window.openOrderModal = (order) => {
    const product    = order.products || {};
    const image      = product.image  || '';
    const prices     = product.prices || [];
    const totalPrice = order.price * (order.quantity || 1);
    const c          = getThemeColors(); // ← ألوان الثيم

    document.getElementById('order-modal')?.remove();
    window._reservedStockIds = null;
    window._stockCodesData   = null;

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
        quantity: order.quantity || 1, orderPrice: totalPrice, prices
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
                    <p style="margin:0; font-size:13px;">💰 <strong style="color:#f97316;">${totalPrice} MRU</strong></p>
                    <p style="margin:0; color:${c.textMuted}; font-size:13px;">🔢 الكمية: ${order.quantity || 1}</p>
                    <p style="margin:0; color:${c.textMuted}; font-size:13px;">💳 ${order.paymentMethod || order.payment_method || '-'}</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                ${stockSectionHTML}
                <div>
                    <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">
                        🔑 أكواد البطاقة (${order.quantity || 1} كود) — كود في كل سطر
                    </label>
                    <textarea id="modal-code" placeholder="كود 1&#10;كود 2&#10;كود 3..."
                        rows="${Math.max(3, order.quantity || 1)}"
                        style="${inputStyle} resize:vertical; font-family:monospace; line-height:1.8;"></textarea>
                    <p style="font-size:11px; color:${c.textMuted}; margin-top:4px;">أدخل كل كود في سطر منفصل</p>
                </div>
            </div>

            <div id="profit-display" style="display:none; margin-bottom:15px; background:${c.deepBg}; border-radius:8px; padding:12px; text-align:center; border:1px solid ${c.border};"></div>

            <div id="stock-suppliers-section" style="display:none; margin-bottom:15px;">
                <div style="background:${c.deepBg}; border:1px solid #1e3a5f; border-radius:12px; padding:16px;">
                    <p style="font-size:13px; color:#3b82f6; font-weight:700; margin:0 0 12px;">
                        <i class="fas fa-boxes"></i> موردو هذا الكود في المخزون
                    </p>
                    <div id="stock-suppliers-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                </div>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">🏪 اسم المورد</label>
                <input type="text" id="modal-supplier-id" placeholder="اسم المورد..." style="${inputStyle}">
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-size:13px; color:${c.textMuted}; display:block; margin-bottom:6px;">🔖 Order ID المورد</label>
                <input type="text" id="modal-supplier-order-id" placeholder="أدخل Order ID من المورد..." style="${inputStyle}">
            </div>

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
};

// ==================== فتح Modal مجموعة ====================
window.openGroupOrderModal = (items) => {
    document.getElementById('order-modal')?.remove();
    window._groupItems     = items;
    window._groupStockData = items.map(() => null);
    const c          = getThemeColors();
    const firstItem  = items[0];
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
        const img    = item.products?.image || '';
        const prices = item.products?.prices || [];
        const stockHTML = buildStockSection({
            suffix: idx, productId: item.product_id, label: item.label,
            quantity: item.quantity || 1, orderPrice: item.price * (item.quantity || 1), prices
        });

        return `
        <div style="background:${c.deepBg}; border-radius:10px; padding:16px; margin-bottom:12px; border:1px solid ${c.cardBorder};">
            <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
                ${img ? `<img src="${img}" style="width:50px;height:50px;object-fit:contain;background:white;border-radius:8px;padding:3px;flex-shrink:0;">` : ''}
                <div>
                    <div style="font-weight:700; color:${c.text};">${item.product_name || 'غير محدد'}</div>
                    <div style="font-size:13px; color:#f97316;">${item.label || '-'} • ${item.quantity || 1} قطعة • ${item.price * (item.quantity || 1)} MRU</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                ${stockHTML}
                <div>
                    <label style="font-size:12px; color:${c.textMuted}; display:block; margin-bottom:5px;">🔑 الأكواد (${item.quantity || 1} كود)</label>
                    <textarea id="code-${idx}" placeholder="كود 1&#10;كود 2..."
                        rows="${Math.max(2, item.quantity || 1)}"
                        style="${inputStyle} resize:vertical; font-family:monospace; line-height:1.8;"></textarea>
                </div>
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

// ==================== calcProfit ====================
window.calcProfit = (orderPrice) => {
    const cost          = parseFloat(document.getElementById('modal-cost').value) || 0;
    const codesText     = document.getElementById('modal-code').value.trim();
    const quantity      = codesText ? codesText.split('\n').filter(c => c.trim() !== '').length : 1;
    const profitDisplay = document.getElementById('profit-display');
    if (cost > 0) {
        const totalCost = cost * USD_TO_MRU * quantity;
        const profit    = orderPrice - totalCost;
        profitDisplay.style.display = 'block';
        profitDisplay.innerHTML = `
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">
                التكلفة: $${cost} × ${quantity} كود × ${USD_TO_MRU} = ${totalCost.toFixed(0)} MRU
            </div>
            <span style="color:#94a3b8;font-size:13px;">الربح: </span>
            <span style="color:${profit >= 0 ? '#22c55e' : '#ef4444'};font-size:18px;font-weight:bold;">${profit.toFixed(0)}</span>
            <span style="color:#94a3b8;font-size:13px;"> MRU</span>
        `;
    } else { profitDisplay.style.display = 'none'; }
};

// calcProfit للمجموعة (بدون profit display مركزي)
window.calcProfitItem = (idx, orderPrice) => {
    const cost = parseFloat(document.getElementById(`modal-cost${idx}`)?.value) || 0;
    // اختياري: يمكن عرض الربح لكل عنصر لاحقاً
};

// ==================== سحب من المخزون — طلب واحد ====================
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
        document.getElementById('stock-suppliers-section').style.display = 'none';
        // إظهار السيليكت حتى بدون مخزون
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
    window._stockCodesData   = availableCodes.map(c => ({
        id: c.id, code: c.code,
        supplier_name: c.supplier_name || 'غير محدد',
        order_id: c.order_id || '',
        cost_per_card_usd: c.cost_per_card_usd || 0
    }));

    const firstCost = availableCodes[0]?.cost_per_card_usd;
    if (firstCost > 0) { document.getElementById('modal-cost').value = parseFloat(firstCost).toFixed(4); calcProfit(orderPrice); }

    // موردو المخزون
    const suppliersMap = {};
    availableCodes.forEach(c => {
        const name = c.supplier_name || 'غير محدد';
        if (!suppliersMap[name]) suppliersMap[name] = { name, order_id: c.order_id || '', count: 0 };
        suppliersMap[name].count++;
    });
    const suppliers = Object.values(suppliersMap);
    const section   = document.getElementById('stock-suppliers-section');
    const list      = document.getElementById('stock-suppliers-list');
    list.innerHTML  = suppliers.map(s => `
        <div style="width:100%;padding:12px 16px;background:rgba(249,115,22,0.08);border:2px solid #f97316;
               border-radius:8px;color:#e2e8f0;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
            <span style="display:flex;align-items:center;gap:8px;">
                ${s.order_id ? `<span style="color:#94a3b8;">🔖 ${s.order_id}</span>` : ''}
                <span style="color:#22c55e;background:rgba(34,197,94,0.1);padding:2px 8px;border-radius:10px;">${s.count} كود</span>
            </span>
            <span style="font-weight:700;">🏪 ${s.name}</span>
        </div>
    `).join('');
    section.style.display = 'block';

    // تعبئة حقول المورد
    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput) supplierInput.value = suppliers.map(s => s.name).join(' / ');
    const orderInput = document.getElementById('modal-supplier-order-id');
    if (orderInput) orderInput.value = suppliers.map(s => s.order_id).filter(Boolean).join(' / ');

    // إظهار سيليكت الموردين
    const wrap = document.getElementById('supplier-select-wrap');
    if (wrap) { wrap.style.display = 'block'; wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
};

// ==================== سحب من المخزون — مجموعة ====================
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
        if (wrap) wrap.style.display = 'block'; // إظهار السيليكت للشراء اليدوي
        return;
    }

    statusEl.textContent = `✅ تم سحب ${availableCodes.length} كود`; statusEl.style.color = '#22c55e';

    document.getElementById(`code-${idx}`).value          = availableCodes.map(c => c.code).join('\n');
    document.getElementById(`supplier-${idx}`).value      = availableCodes[0]?.supplier_name || '';
    document.getElementById(`supplier-order-${idx}`).value = availableCodes[0]?.order_id || '';

    const costField = document.getElementById(`modal-cost${idx}`);
    if (costField && availableCodes[0]?.cost_per_card_usd > 0) {
        costField.value = parseFloat(availableCodes[0].cost_per_card_usd).toFixed(4);
    }

    if (!window._groupStockData) window._groupStockData = [];
    window._groupStockData[idx] = {
        stockIds: availableCodes.map(c => c.id),
        codes:    availableCodes.map(c => c.code),
        suppliersDetails: availableCodes.map(c => ({
            code: c.code,
            supplier_name: c.supplier_name || 'غير محدد',
            supplier_order_id: c.order_id || ''
        }))
    };

    // إظهار سيليكت الموردين للعنصر
    const wrap = document.getElementById(`supplier-select-wrap${idx}`);
    if (wrap) { wrap.style.display = 'block'; wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
};

// ==================== قبول طلب واحد ====================
window.approveOrder = async (orderId, quantity) => {
    const codesRaw        = document.getElementById('modal-code').value.trim();
    const codes           = codesRaw.split('\n').map(c => c.trim()).filter(c => c !== '');
    const cost            = document.getElementById('modal-cost').value.trim();
    const supplierId      = document.getElementById('modal-supplier-id').value.trim();
    const supplierOrderId = document.getElementById('modal-supplier-order-id')?.value.trim() || '';

    if (codes.length === 0)             { showToast('⚠️ يرجى إدخال كود البطاقة!'); return; }
    if (codes.length !== quantity)      { showToast(`⚠️ عدد الأكواد (${codes.length}) لا يطابق الكمية (${quantity})!`); return; }
    if (!cost || parseFloat(cost) <= 0) { showToast('⚠️ يرجى إدخال سعر التكلفة!'); return; }
    if (!supplierId)                    { showToast('⚠️ يرجى إدخال اسم المورد!'); return; }

    for (const c of codes) {
        const { data: existing } = await supabase.from('used_codes').select('id').eq('code', c).maybeSingle();
        if (existing) { showToast(`⚠️ الكود "${c}" مستخدم بالفعل!`); return; }
    }

    const stockCodesData   = window._stockCodesData || [];
    const suppliersDetails = stockCodesData.map(c => ({ code: c.code, supplier_name: c.supplier_name, supplier_order_id: c.order_id }));

    const { data: orderData, error } = await supabase.from('orders').update({
        status: 'مكتمل', card_code: codes.join('\n'),
        cost_price: parseFloat(cost), supplier_id: supplierId, supplier_order_id: supplierOrderId,
        suppliers_details: suppliersDetails.length > 0 ? suppliersDetails : null
    }).eq('id', orderId).select().single();

    if (error) { showToast('❌ خطأ: ' + error.message); return; }

    for (const c of codes) {
        await supabase.from('used_codes').insert({ code: c, order_id: orderId, product_name: orderData?.product_name || '' });
    }

    const reservedIds = window._reservedStockIds;
    if (reservedIds?.length > 0) {
        await supabase.from('stocks').update({ status: 'sold', sold_at: new Date().toISOString(), order_id: orderId }).in('id', reservedIds);
        window._reservedStockIds = null; window._stockCodesData = null;
    } else {
        for (const code of codes) {
            await supabase.from('stocks').update({ status: 'sold', sold_at: new Date().toISOString(), order_id: orderId }).eq('code', code).eq('status', 'available');
        }
    }

    document.getElementById('order-modal').remove();
    showToast('✅ تم قبول الطلب بنجاح!');
    loadOrders();
};

// ==================== قبول مجموعة ====================
window.approveGroupOrders = async () => {
    const items = window._groupItems || [];
    if (!items.length) return;

    for (let i = 0; i < items.length; i++) {
        const item     = items[i];
        const codesRaw = document.getElementById(`code-${i}`)?.value.trim() || '';
        const codes    = codesRaw.split('\n').map(c => c.trim()).filter(c => c !== '');
        const cost     = document.getElementById(`modal-cost${i}`)?.value.trim();
        const supplier = document.getElementById(`supplier-${i}`)?.value.trim();
        const qty      = item.quantity || 1;

        if (!codes.length)               { showToast(`⚠️ العنصر ${i+1}: يرجى إدخال الأكواد!`); return; }
        if (codes.length !== qty)        { showToast(`⚠️ العنصر ${i+1}: عدد الأكواد لا يطابق الكمية!`); return; }
        if (!cost || parseFloat(cost) <= 0) { showToast(`⚠️ العنصر ${i+1}: يرجى إدخال سعر التكلفة!`); return; }
        if (!supplier)                   { showToast(`⚠️ العنصر ${i+1}: يرجى إدخال اسم المورد!`); return; }

        for (const c of codes) {
            const { data: existing } = await supabase.from('used_codes').select('id').eq('code', c).maybeSingle();
            if (existing) { showToast(`⚠️ الكود "${c}" مستخدم بالفعل!`); return; }
        }
    }

    for (let i = 0; i < items.length; i++) {
        const item            = items[i];
        const codes           = document.getElementById(`code-${i}`).value.trim().split('\n').map(c => c.trim()).filter(c => c !== '');
        const cost            = document.getElementById(`modal-cost${i}`).value.trim();
        const supplierId      = document.getElementById(`supplier-${i}`).value.trim();
        const supplierOrderId = document.getElementById(`supplier-order-${i}`)?.value.trim() || '';
        const stockData       = window._groupStockData?.[i];

        const { data: orderData, error } = await supabase.from('orders').update({
            status: 'مكتمل', card_code: codes.join('\n'), cost_price: parseFloat(cost),
            supplier_id: supplierId, supplier_order_id: supplierOrderId,
            suppliers_details: stockData?.suppliersDetails?.length > 0 ? stockData.suppliersDetails : null
        }).eq('id', item.id).select().single();

        if (error) { showToast(`❌ خطأ في الطلب ${i+1}: ` + error.message); return; }

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

    window._groupItems = null; window._groupStockData = null;
    document.getElementById('order-modal').remove();
    showToast(`✅ تم قبول ${items.length} طلب بنجاح!`);
    loadOrders();
};

// ==================== رفض ====================
window.rejectOrder = async (orderId) => {
    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) { showToast('⚠️ يرجى إدخال سبب الرفض!'); return; }
    if (!confirm(`هل تريد رفض هذا الطلب؟\nالسبب: ${reason}`)) return;
    const { error } = await supabase.from('orders').update({ status: 'ملغي', reject_reason: reason }).eq('id', orderId);
    if (error) { showToast('❌ خطأ: ' + error.message); return; }
    window._reservedStockIds = null; window._stockCodesData = null;
    document.getElementById('order-modal').remove();
    showToast('تم رفض الطلب.');
    loadOrders();
};

window.rejectGroupOrders = async () => {
    const items  = window._groupItems || [];
    const reason = document.getElementById('group-reject-reason')?.value.trim();
    if (!reason) { showToast('⚠️ يرجى إدخال سبب الرفض!'); return; }
    if (!confirm(`هل تريد رفض ${items.length} طلب؟`)) return;
    for (const item of items) {
        await supabase.from('orders').update({ status: 'ملغي', reject_reason: reason }).eq('id', item.id);
    }
    window._groupItems = null; window._groupStockData = null;
    document.getElementById('order-modal').remove();
    showToast(`تم رفض ${items.length} طلب.`);
    loadOrders();
};

// ==================== عداد ====================
async function checkNewOrders() {
    const { data: orders } = await supabase.from('orders').select('id, order_number').not('status', 'in', '("مكتمل","ملغي","مسترد")');
    const count = new Set((orders || []).map(o => o.order_number || o.id)).size;
    const badge = document.getElementById('orders-badge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
    document.title = count > 0 ? `(${count}) طلب جديد | إدارة الطلبات` : 'إدارة الطلبات | SecondsCard';
}

window.filterOrders = () => {
    const search = document.getElementById('orderSearch').value.trim().toLowerCase();
    document.querySelectorAll('#admin-orders-list tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(search) ? '' : 'none';
    });
};

document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    checkNewOrders();
    const channel = supabase.channel('orders-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders(); checkNewOrders(); })
        .subscribe();
    setInterval(checkNewOrders, 1000);
});


function showToast(message, type = 'success') {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.textContent = message;
    t.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(-10px);
        background: ${type === 'success' ? '#22c55e' : '#ef4444'};
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 700;
        font-family: 'Tajawal', sans-serif;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        pointer-events: none;
        white-space: nowrap;
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
// ===== دالة للحصول على ألوان حسب الثيم =====
function getThemeColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        modalBg:     isLight ? '#ffffff'  : '#1e293b',
        deepBg:      isLight ? '#f8fafc'  : '#0f172a',
        border:      isLight ? '#e2e8f0'  : '#334155',
        text:        isLight ? '#1e293b'  : '#e2e8f0',
        textMuted:   isLight ? '#64748b'  : '#94a3b8',
        inputBg:     isLight ? '#f8fafc'  : '#0f172a',
        inputBorder: isLight ? '#e2e8f0'  : '#334155',
        inputColor:  isLight ? '#1e293b'  : '#e2e8f0',
        cardBg:      isLight ? '#f1f5f9'  : '#0f172a',
        cardBorder:  isLight ? '#e2e8f0'  : '#1e3a5f',
    };
}

// ==================== Modal الاسترداد ====================
// أضف هذا الكود في orders.js — استبدل دالتي quickRefund و quickRefundGroup

window.quickRefund = async (orderId, paymentMethod) => {
    // جلب بيانات الطلب الكاملة أولاً
    const { data: order, error } = await supabase
        .from('orders')
        .select('id, user_id, price, quantity, payment_method, paymentMethod, customer_name, customer_phone, product_name, label, order_number, receipt_url, receiptUrl, created_at')
        .eq('id', orderId)
        .single();

    if (error || !order) { showToast('❌ خطأ في جلب الطلب', 'error'); return; }

    const pm            = order.paymentMethod || order.payment_method || '';
    const refundAmount  = (order.price || 0) * (order.quantity || 1);
    const isWallet      = pm === 'المحفظة' || pm === 'محفظة';
    const receiptUrl    = order.receiptUrl || order.receipt_url;
    const c             = getThemeColors();

    // إزالة أي modal قديم
    document.getElementById('refund-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'refund-modal';
    modal.style.cssText = `
        position:fixed; inset:0;
        background:rgba(0,0,0,0.75);
        backdrop-filter:blur(4px);
        z-index:99999;
        display:flex; align-items:center; justify-content:center;
        padding:20px;
        animation:refundFadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <style>
            @keyframes refundFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes refundSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
            .refund-box {
                background:${c.modalBg};
                border:1px solid ${c.border};
                border-radius:20px;
                padding:28px;
                width:100%; max-width:460px;
                color:${c.text};
                font-family:'Tajawal','Segoe UI',sans-serif;
                animation:refundSlideUp 0.25s ease;
            }
            .refund-title {
                text-align:center; font-size:18px; font-weight:800;
                color:#f59e0b; margin-bottom:20px;
                display:flex; align-items:center; justify-content:center; gap:8px;
            }
            .refund-row {
                display:flex; justify-content:space-between; align-items:center;
                padding:10px 14px;
                border-radius:10px;
                background:${c.deepBg};
                border:1px solid ${c.border};
                margin-bottom:8px;
                font-size:13px;
            }
            .refund-row .label { color:${c.textMuted}; }
            .refund-row .value { font-weight:700; color:${c.text}; }
            .refund-amount-box {
                background:rgba(245,158,11,0.1);
                border:2px solid #f59e0b;
                border-radius:12px;
                padding:14px;
                text-align:center;
                margin:14px 0;
            }
            .refund-receipt-box {
                border-radius:12px;
                overflow:hidden;
                border:1px solid ${c.border};
                margin:14px 0;
                cursor:pointer;
                transition:transform 0.15s;
            }
            .refund-receipt-box:hover { transform:scale(1.01); }
            .refund-receipt-box img { width:100%; max-height:180px; object-fit:cover; display:block; }
            .refund-receipt-label {
                background:${c.deepBg};
                padding:8px 12px;
                font-size:12px;
                color:${c.textMuted};
                display:flex; align-items:center; gap:6px;
            }
            .refund-note {
                background:${isWallet ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)'};
                border:1px solid ${isWallet ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'};
                border-radius:10px; padding:10px 14px;
                font-size:12px; color:${isWallet ? '#22c55e' : '#f59e0b'};
                margin-bottom:16px; display:flex; align-items:flex-start; gap:8px; line-height:1.6;
            }
            .refund-btn-confirm {
                width:100%; padding:13px;
                background:linear-gradient(135deg,#f59e0b,#d97706);
                color:white; border:none; border-radius:10px;
                font-size:15px; font-weight:800; cursor:pointer;
                font-family:'Tajawal','Segoe UI',sans-serif;
                box-shadow:0 4px 14px rgba(245,158,11,0.35);
                transition:opacity 0.2s, transform 0.15s;
                margin-bottom:8px;
            }
            .refund-btn-confirm:hover { opacity:0.9; transform:translateY(-1px); }
            .refund-btn-cancel {
                width:100%; padding:11px;
                background:${c.deepBg};
                color:${c.textMuted}; border:1px solid ${c.border}; border-radius:10px;
                font-size:14px; cursor:pointer;
                font-family:'Tajawal','Segoe UI',sans-serif;
                transition:background 0.2s;
            }
            .refund-btn-cancel:hover { background:rgba(239,68,68,0.1); color:#ef4444; border-color:#ef4444; }
        </style>

        <div class="refund-box">
            <div class="refund-title">
                <i class="fas fa-undo"></i> تأكيد الاسترداد
            </div>

            <!-- معلومات الطلب -->
            <div class="refund-row">
                <span class="label"><i class="fas fa-hashtag"></i> رقم الطلب</span>
                <span class="value" style="font-family:monospace;color:#f97316;">${order.order_number || '#' + orderId.substring(0,8)}</span>
            </div>

            <div class="refund-row">
                <span class="label"><i class="fas fa-box"></i> المنتج</span>
                <span class="value">${order.product_name || '—'} ${order.label ? `<span style="color:#f97316;font-size:12px;">(${order.label})</span>` : ''}</span>
            </div>

            <div class="refund-row">
                <span class="label"><i class="fas fa-user"></i> العميل</span>
                <span class="value">${order.customer_name || '—'}</span>
            </div>

            ${order.customer_phone ? `
            <div class="refund-row">
                <span class="label"><i class="fas fa-phone"></i> الهاتف</span>
                <span class="value" style="font-family:monospace;direction:ltr;">${order.customer_phone}</span>
            </div>` : ''}

            <div class="refund-row">
                <span class="label"><i class="fas fa-credit-card"></i> طريقة الدفع</span>
                <span class="value">${pm || '—'}</span>
            </div>

            <!-- المبلغ -->
            <div class="refund-amount-box">
                <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">المبلغ الذي سيُسترد</div>
                <div style="font-size:28px;font-weight:900;color:#f59e0b;">${refundAmount} <span style="font-size:14px;font-weight:600;">MRU</span></div>
                ${order.quantity > 1 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${order.price} MRU × ${order.quantity} قطعة</div>` : ''}
            </div>

            <!-- الإيصال -->
            ${receiptUrl ? `
            <div class="refund-receipt-box" onclick="window.open('${receiptUrl}','_blank')">
                <img src="${receiptUrl}" alt="إيصال الدفع" onerror="this.parentElement.style.display='none'">
                <div class="refund-receipt-label">
                    <i class="fas fa-receipt" style="color:#f97316;"></i>
                    إيصال الدفع — انقر للتكبير
                </div>
            </div>` : ''}

            <!-- ملاحظة -->
            <div class="refund-note">
                <i class="fas fa-${isWallet ? 'wallet' : 'exclamation-triangle'}" style="margin-top:2px;flex-shrink:0;"></i>
                <span>${isWallet
                    ? `سيتم إعادة <strong>${refundAmount} MRU</strong> تلقائياً إلى محفظة العميل فور التأكيد.`
                    : `طريقة الدفع يدوية — ستحتاج إلى إعادة المبلغ يدوياً عبر <strong>${pm}</strong>.`
                }</span>
            </div>

            <button class="refund-btn-confirm" id="refund-confirm-btn"
                onclick="executeRefund('${orderId}', '${pm}', ${refundAmount}, '${order.user_id}')">
                <i class="fas fa-check-circle"></i> تأكيد الاسترداد
            </button>
            <button class="refund-btn-cancel" onclick="document.getElementById('refund-modal').remove()">
                إلغاء
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

// ==================== تنفيذ الاسترداد ====================
window.executeRefund = async (orderId, pm, refundAmount, userId) => {
    const btn = document.getElementById('refund-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الاسترداد...'; }

    await supabase.from('orders').update({ status: 'مسترد' }).eq('id', orderId);

    const isWallet = pm === 'المحفظة' || pm === 'محفظة';
    if (isWallet && userId) {
        const { data: userData } = await supabase.from('users').select('balance').eq('id', userId).single();
        const newBalance = (userData?.balance || 0) + refundAmount;
        await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('wallet_transactions').insert({
            user_id: userId, type: 'charge', amount: refundAmount,
            payment_method: 'استرداد طلب', status: 'مكتمل',
            created_at: new Date().toISOString()
        });
        showToast(`✅ تم الاسترداد — أُضيف ${refundAmount} MRU للمحفظة`);
    } else {
        showToast('✅ تم تغيير الحالة إلى مسترد — الإرجاع يدوي');
    }

    document.getElementById('refund-modal')?.remove();
    loadOrders();
};

// ==================== استرداد المجموعة ====================
window.quickRefundGroup = async (ids, paymentMethod) => {
    if (ids.length === 1) {
        return window.quickRefund(ids[0], paymentMethod);
    }

    // جلب الطلبات
    const { data: orders } = await supabase
        .from('orders')
        .select('id, price, quantity, product_name, label, customer_name, customer_phone, order_number, payment_method, paymentMethod, user_id, receipt_url, receiptUrl')
        .in('id', ids);

    if (!orders?.length) { showToast('❌ خطأ في جلب الطلبات', 'error'); return; }

    const totalAmount = orders.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);
    const pm          = orders[0].paymentMethod || orders[0].payment_method || '';
    const isWallet    = pm === 'المحفظة' || pm === 'محفظة';
    const c           = getThemeColors();

    document.getElementById('refund-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'refund-modal';
    modal.style.cssText = `
        position:fixed; inset:0;
        background:rgba(0,0,0,0.75); backdrop-filter:blur(4px);
        z-index:99999; display:flex; align-items:center; justify-content:center;
        padding:20px; animation:refundFadeIn 0.2s ease;
        overflow-y:auto;
    `;

    modal.innerHTML = `
        <div style="background:${c.modalBg};border:1px solid ${c.border};border-radius:20px;
                    padding:28px;width:100%;max-width:500px;color:${c.text};
                    font-family:'Tajawal','Segoe UI',sans-serif;margin:auto;
                    animation:refundSlideUp 0.25s ease;">

            <div style="text-align:center;font-size:18px;font-weight:800;color:#f59e0b;margin-bottom:20px;">
                <i class="fas fa-undo"></i> استرداد مجموعة (${orders.length} طلب)
            </div>

            <!-- قائمة الطلبات -->
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;max-height:240px;overflow-y:auto;">
                ${orders.map(o => `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:10px 14px;border-radius:10px;
                            background:${c.deepBg};border:1px solid ${c.border};font-size:13px;">
                    <span style="color:${c.textMuted};">${o.product_name || '—'} ${o.label ? `<span style="color:#f97316;">(${o.label})</span>` : ''}</span>
                    <span style="font-weight:700;color:#f59e0b;">${(o.price || 0) * (o.quantity || 1)} MRU</span>
                </div>`).join('')}
            </div>

            <!-- إجمالي المبلغ -->
            <div style="background:rgba(245,158,11,0.1);border:2px solid #f59e0b;border-radius:12px;
                        padding:14px;text-align:center;margin-bottom:14px;">
                <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">إجمالي المبلغ المُسترد</div>
                <div style="font-size:26px;font-weight:900;color:#f59e0b;">${totalAmount} <span style="font-size:14px;font-weight:600;">MRU</span></div>
            </div>

            <!-- ملاحظة -->
            <div style="background:${isWallet ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)'};
                        border:1px solid ${isWallet ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'};
                        border-radius:10px;padding:10px 14px;font-size:12px;
                        color:${isWallet ? '#22c55e' : '#f59e0b'};margin-bottom:16px;
                        display:flex;align-items:flex-start;gap:8px;line-height:1.6;">
                <i class="fas fa-${isWallet ? 'wallet' : 'exclamation-triangle'}" style="margin-top:2px;flex-shrink:0;"></i>
                <span>${isWallet
                    ? `سيتم إعادة <strong>${totalAmount} MRU</strong> تلقائياً إلى محفظة العميل.`
                    : `طريقة الدفع يدوية — ستحتاج إلى الإرجاع يدوياً عبر <strong>${pm}</strong>.`
                }</span>
            </div>

            <button id="refund-confirm-btn"
                onclick="executeGroupRefund(${JSON.stringify(ids).replace(/"/g,'&quot;')}, '${pm}', ${totalAmount}, '${orders[0].user_id}')"
                style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#d97706);
                       color:white;border:none;border-radius:10px;font-size:15px;font-weight:800;
                       cursor:pointer;font-family:'Tajawal','Segoe UI',sans-serif;
                       box-shadow:0 4px 14px rgba(245,158,11,0.35);margin-bottom:8px;">
                <i class="fas fa-check-circle"></i> تأكيد استرداد ${orders.length} طلب
            </button>
            <button onclick="document.getElementById('refund-modal').remove()"
                style="width:100%;padding:11px;background:${c.deepBg};color:${c.textMuted};
                       border:1px solid ${c.border};border-radius:10px;font-size:14px;
                       cursor:pointer;font-family:'Tajawal','Segoe UI',sans-serif;">
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
        await supabase.from('orders').update({ status: 'مسترد' }).eq('id', id);
    }

    const isWallet = pm === 'المحفظة' || pm === 'محفظة';
    if (isWallet && userId) {
        const { data: userData } = await supabase.from('users').select('balance').eq('id', userId).single();
        const newBalance = (userData?.balance || 0) + totalAmount;
        await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('wallet_transactions').insert({
            user_id: userId, type: 'charge', amount: totalAmount,
            payment_method: 'استرداد طلب', status: 'مكتمل',
            created_at: new Date().toISOString()
        });
        showToast(`✅ تم استرداد ${ids.length} طلب — أُضيف ${totalAmount} MRU للمحفظة`);
    } else {
        showToast(`✅ تم تغيير ${ids.length} طلب إلى مسترد — الإرجاع يدوي`);
    }

    document.getElementById('refund-modal')?.remove();
    loadOrders();
};