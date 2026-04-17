import { supabase } from '../../js/supabase-config.js';

// ==================== تحميل الطلبات المكتملة ====================
async function loadCompletedOrders() {
    const ordersList = document.getElementById('completed-orders-list');
    if (!ordersList) return;

    ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">جاري التحميل...</td></tr>';

    let query = supabase
        .from('orders')
        .select('*, products(image)')
        .in('status', ['مكتمل', 'ملغي', 'مسترد'])
        .order('created_at', { ascending: false });

    const from = document.getElementById('date-from')?.value;
    const to   = document.getElementById('date-to')?.value;
    if (from) query = query.gte('created_at', from);
    if (to)   query = query.lte('created_at', to + 'T23:59:59');

    const { data: orders, error } = await query;

    if (error) {
        ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">❌ خطأ في جلب الطلبات</td></tr>';
        return;
    }

    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">📭 لا توجد طلبات</td></tr>';
        return;
    }

    updateSummary(orders);

    const statusStyle = {
        'مكتمل': 'background:#dcfce7; color:#16a34a;',
        'ملغي':  'background:#fee2e2; color:#dc2626;',
        'مسترد': 'background:#fef9c3; color:#ca8a04;',
    };

    ordersList.innerHTML = orders.map(order => {
const createdAt  = order.created_at ? new Date(order.created_at) : null;
const finishedAt = order.updated_at  ? new Date(order.updated_at)  : null;

const formatDate = (d) => d ? d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
}) : '-';

let timeDiff = '';
let timeColor = '#94a3b8';
if (createdAt && finishedAt && finishedAt > createdAt) {
    const diffMs  = finishedAt - createdAt;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr  = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60)       timeDiff = `${diffSec} ث`;
    else if (diffMin < 60)  timeDiff = `${diffMin} د`;
    else if (diffHr < 24)   timeDiff = `${diffHr}س ${diffMin % 60}د`;
    else                    timeDiff = `${diffDay} يوم`;

    timeColor = diffMin < 2 ? '#22c55e' : diffMin < 30 ? '#f97316' : '#ef4444';
}

const date = `
    <div style="font-size:11px;color:#94a3b8;">🕐 ${formatDate(createdAt)}</div>
    ${timeDiff ? `
    <div style="text-align:center;margin:3px 0;">
        <span style="display:inline-flex;align-items:center;gap:3px;
            background:rgba(0,0,0,0.3);color:${timeColor};
            border:1px solid ${timeColor}50;
            padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;">
            <i class="fas fa-clock"></i> ${timeDiff}
        </span>
    </div>` : ''}
    <div style="font-size:11px;color:#64748b;">✅ ${formatDate(finishedAt)}</div>
`;

        const image = order.products?.image;
        const totalPrice = order.price * (order.quantity || 1);
        const paymentMethod = order.paymentMethod || order.payment_method || '-';
        const status = order.status || '-';
        const style = statusStyle[status] || '';

        const imageCell = image
            ? `<img src="${image}"
                style="width:38px;height:38px;object-fit:contain;background:white;border-radius:5px;padding:2px;cursor:pointer;"
                onclick="showOrderPopup('${order.id}')"
                title="اضغط لعرض التفاصيل">`
            : `<span style="cursor:pointer;font-size:20px;" onclick="showOrderPopup('${order.id}')">🎴</span>`;

        const receiptUrl = order.receiptUrl || order.receipt_url;
        const receiptBtn = receiptUrl
            ? `<a href="${receiptUrl}" target="_blank"
                style="background:#3b82f6;color:white;padding:5px 10px;border-radius:6px;font-size:12px;text-decoration:none;">
                <i class="fas fa-receipt"></i> عرض</a>`
            : '<span style="color:#64748b;">—</span>';

        return `
            <tr id="row-${order.id}" data-status="${status}">
                <td style="color:#f97316;font-weight:bold;">${order.order_number || '#' + order.id.substring(0,7)}</td>
                <td>
                    <div>${order.customer_name || 'غير معروف'}</div>
                    <div style="font-size:11px;color:#94a3b8;">${order.customer_phone || ''}</div>
                </td>
                <td>${imageCell}</td>
                <td>
                    <div>${order.product_name || '-'}</div>
                    <div style="font-size:11px;color:#f97316;">${order.label || ''}</div>
                </td>
                <td><strong>${totalPrice} MRU</strong></td>
                <td style="text-align:center;">${order.quantity || 1}</td>
                <td>${date}</td>
                <td>${paymentMethod}</td>
                <td>${receiptBtn}</td>
                <td>
                    <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;${style}">
                        ${status}
                    </span>
                    ${status === 'ملغي' && order.reject_reason
                        ? `<div style="font-size:11px;color:#ef4444;margin-top:4px;">السبب: ${order.reject_reason}</div>`
                        : ''}
                    ${status === 'مكتمل'
                        ? order.auto_approved
                            ? `<div style="margin-top:5px;">
                                <span style="display:inline-flex;align-items:center;gap:4px;
                                    background:rgba(59,130,246,0.12);color:#60a5fa;
                                    border:1px solid rgba(59,130,246,0.3);
                                    padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">
                                    <i class="fas fa-box"></i> المخزون 
                                </span>
                               </div>`
                            : `<div style="margin-top:5px;">
                                <span style="display:inline-flex;align-items:center;gap:4px;
                                    background:rgba(168,85,247,0.12);color:#c084fc;
                                    border:1px solid rgba(168,85,247,0.3);
                                    padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">
                                    <i class="fas fa-hand-paper"></i> يدوي
                                </span>
                               </div>`
                        : ''}
                </td>
                <td>
                    ${status === 'مكتمل' ? `
                    <button onclick="refundOrder('${order.id}')"
                        style="background:#f59e0b;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;width:100%;">
                        <i class="fas fa-undo"></i> استرداد
                    </button>` : ''}
                </td>
            </tr>
        `;
    }).join('');

    // حفظ الطلبات في الذاكرة للـ popup
    window._completedOrders = orders;
}

// ==================== Popup تفاصيل الطلب ====================
window.showOrderPopup = (orderId) => {
    document.getElementById('order-detail-popup')?.remove();

    const order = (window._completedOrders || []).find(o => o.id === orderId);
    if (!order) return;

    const codes = order.card_code ? order.card_code.split('\n').filter(c => c.trim()) : [];
    const suppliersDetails = order.suppliers_details || [];
    const totalPrice = order.price * (order.quantity || 1);

    // بناء قسم الموردين
    let suppliersHtml = '';
    if (suppliersDetails.length > 0) {
        const suppliersMap = {};
        suppliersDetails.forEach(s => {
            const key = s.supplier_name || 'غير محدد';
            if (!suppliersMap[key]) suppliersMap[key] = { name: key, order_id: s.supplier_order_id || '', codes: [] };
            suppliersMap[key].codes.push(s.code);
        });

        suppliersHtml = `
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;font-weight:700;">
                    <i class="fas fa-boxes"></i> الموردون
                </div>
                ${Object.values(suppliersMap).map(s => `
                    <div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <span style="font-weight:700;color:#e2e8f0;">🏪 ${s.name}</span>
                            <span style="font-size:11px;background:rgba(34,197,94,0.1);color:#22c55e;padding:2px 8px;border-radius:10px;">
                                ${s.codes.length} كود
                            </span>
                        </div>
                        ${s.order_id ? `
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:12px;color:#94a3b8;">🔖 Order ID:</span>
                            <span style="font-family:monospace;font-size:12px;color:#60a5fa;">${s.order_id}</span>
                            <button onclick="copyText('${s.order_id}')"
                                style="background:#334155;color:white;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>` : ''}
                    </div>
                `).join('')}
            </div>`;
    } else if (order.supplier_id) {
        suppliersHtml = `
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;font-weight:700;">🏪 المورد</div>
                <div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;">
                    <div style="font-weight:700;color:#e2e8f0;">🏪 ${order.supplier_id}</div>
                    ${order.supplier_order_id ? `
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                        <span style="font-size:12px;color:#94a3b8;">🔖 Order ID:</span>
                        <span style="font-family:monospace;font-size:12px;color:#60a5fa;">${order.supplier_order_id}</span>
                        <button onclick="copyText('${order.supplier_order_id}')"
                            style="background:#334155;color:white;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>` : ''}
                </div>
            </div>`;
    }

    // حساب الربح
    let profitHtml = '';
    if (order.cost_price && order.cost_price > 0) {
        const costPerCard = order.cost_price;
        const totalCost = costPerCard * 43 * (order.quantity || 1);
        const profit = totalPrice - totalCost;
        profitHtml = `
            <div style="background:#0f172a;border-radius:8px;padding:12px;margin-bottom:16px;text-align:center;">
                <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">
                    التكلفة: $${costPerCard} × ${order.quantity||1} × 43 = ${totalCost.toFixed(0)} MRU
                </div>
                <span style="color:#94a3b8;font-size:13px;">الربح: </span>
                <span style="color:${profit >= 0 ? '#22c55e' : '#ef4444'};font-size:20px;font-weight:bold;">
                    ${profit.toFixed(0)} MRU
                </span>
                <span style="color:#94a3b8;font-size:12px;margin-right:4px;">
                    (${(profit/43).toFixed(2)} $)
                </span>
            </div>`;
    }

    const popup = document.createElement('div');
    popup.id = 'order-detail-popup';
    popup.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.85);
        z-index:9999; display:flex; align-items:center; justify-content:center;
        padding:20px; overflow-y:auto;
    `;

    popup.innerHTML = `
        <div style="background:#1e293b;border-radius:16px;padding:28px;width:100%;max-width:600px;color:#e2e8f0;position:relative;margin:auto;">
            <button onclick="document.getElementById('order-detail-popup').remove()"
                style="position:absolute;top:14px;left:14px;background:#ef4444;color:white;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;">
                ✕ إغلاق
            </button>

            <h3 style="text-align:center;color:#f97316;margin-bottom:20px;">
                تفاصيل الطلب ${order.order_number || '#' + order.id.substring(0,7)}
            </h3>

            <div style="background:#0f172a;border-radius:10px;padding:14px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><span style="color:#94a3b8;font-size:12px;">👤 العميل</span><div style="font-weight:600;">${order.customer_name || '-'}</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">📱 الهاتف</span><div>${order.customer_phone || '-'}</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">🛍️ المنتج</span><div style="color:#f97316;font-weight:600;">${order.product_name || '-'}</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">🏷️ الفئة</span><div>${order.label || '-'}</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">💰 المبلغ</span><div style="color:#22c55e;font-weight:700;">${totalPrice} MRU</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">🔢 الكمية</span><div>${order.quantity || 1}</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">💳 الدفع</span><div>${paymentMethod(order)}</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">📅 التاريخ</span><div style="font-size:12px;">${new Date(order.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div>
            </div>

            ${profitHtml}
            ${suppliersHtml}

            <div>
                <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;font-weight:700;">
                    🔑 الأكواد (${codes.length})
                </div>
                ${codes.length > 0 ? `
                <div style="background:#0f172a;border-radius:8px;padding:12px;">
                    ${codes.map(c => `
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="font-family:monospace;font-size:13px;color:#22c55e;flex:1;
                                background:#1e293b;padding:6px 10px;border-radius:6px;">
                                ${c.trim()}
                            </span>
                            <button onclick="copyText('${c.trim().replace(/'/g, "\\'")}')"
                                style="background:#334155;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    `).join('')}
                    <button onclick="copyText('${codes.join('\\n').replace(/'/g, "\\'")}')"
                        style="width:100%;margin-top:4px;padding:8px;background:#22c55e;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;">
                        <i class="fas fa-copy"></i> نسخ جميع الأكواد
                    </button>
                </div>` : '<span style="color:#64748b;">لا يوجد كود</span>'}
            </div>
        </div>
    `;

    popup.onclick = e => { if (e.target === popup) popup.remove(); };
    document.body.appendChild(popup);
};

function paymentMethod(order) {
    return order.paymentMethod || order.payment_method || '-';
}

// ==================== ملخص ====================
function updateSummary(orders) {
    const completed = orders.filter(o => o.status === 'مكتمل');
    const rejected  = orders.filter(o => o.status === 'ملغي');
    const refunded  = orders.filter(o => o.status === 'مسترد');
    const revenue   = completed.reduce((s, o) => s + (o.price * (o.quantity || 1)), 0);

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('summary-completed', completed.length);
    el('summary-rejected',  rejected.length);
    el('summary-refunded',  refunded.length);
    el('summary-revenue',   revenue + ' MRU');
}

// ==================== استرداد ====================
window.refundOrder = async (orderId) => {
    if (!confirm('هل تريد استرداد هذا الطلب وإرجاع الأكواد للمخزون؟')) return;

    // ✅ إصلاح: إزالة supplier_name و order_id (غير موجودين في جدول orders)
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('card_code, product_id, label, product_name, supplier_id, supplier_order_id, cost_price, quantity')
        .eq('id', orderId)
        .single();

    if (fetchError) { alert('خطأ: ' + fetchError.message); return; }

    // تحديث حالة الطلب
    const { error } = await supabase
        .from('orders')
        .update({ status: 'مسترد' })
        .eq('id', orderId);

    if (error) { alert('خطأ: ' + error.message); return; }

    // إرجاع الأكواد للمخزون
    if (order?.card_code) {
        const codes = order.card_code.split('\n').map(c => c.trim()).filter(c => c);

        for (const code of codes) {
            // حذف من used_codes
            await supabase.from('used_codes').delete().eq('code', code);

            // إرجاع للمخزون مع ملاحظة الاسترداد
            await supabase.from('stocks').insert({
                product_id:        order.product_id,
                product_name:      order.product_name,
                price_label:       order.label,                              // ✅ label بدل price_label
                supplier_name:     order.supplier_id || 'غير محدد',         // ✅ supplier_id بدل supplier_name
                order_id:          order.supplier_order_id || null,          // ✅ supplier_order_id فقط
                cost_per_card_usd: order.cost_price || 0,
                code:              code,
                status:            'available',
                notes:             '↩️ مسترد من طلب #' + orderId.substring(0, 7),
                created_at:        new Date().toISOString()
            });
        }
    }

    document.getElementById('order-detail-popup')?.remove();
    alert(`✅ تم الاسترداد وإرجاع ${order?.card_code?.split('\n').filter(c=>c.trim()).length || 0} كود للمخزون`);
    loadCompletedOrders();
};

// ==================== نسخ ====================
window.copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('✅ تم النسخ!'));
};

// ==================== فلاتر ====================
window.filterOrders = () => {
    const search = document.getElementById('orderSearch')?.value.trim().toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || '';
    document.querySelectorAll('#completed-orders-list tr').forEach(row => {
        const matchSearch = row.innerText.toLowerCase().includes(search);
        const matchStatus = !statusFilter || row.dataset.status === statusFilter;
        row.style.display = matchSearch && matchStatus ? '' : 'none';
    });
};

window.filterByStatus = () => filterOrders();

window.resetFilter = () => {
    const from = document.getElementById('date-from');
    const to   = document.getElementById('date-to');
    if (from) from.value = '';
    if (to)   to.value = '';
    loadCompletedOrders();
};

window.loadCompletedOrders = loadCompletedOrders;

// ==================== تشغيل ====================
document.addEventListener('DOMContentLoaded', () => {
    loadCompletedOrders();
    setInterval(loadCompletedOrders, 60000);
});