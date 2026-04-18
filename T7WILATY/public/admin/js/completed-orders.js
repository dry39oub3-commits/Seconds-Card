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

    // حفظ في الذاكرة
    window._completedOrders = orders;

    updateSummary(orders);

    // ===== تجميع بنفس order_number =====
    const groupedMap = {};
    orders.forEach(order => {
        const key = order.order_number || order.id;
        if (!groupedMap[key]) {
            groupedMap[key] = {
                order_number:   order.order_number || order.id,
                customer_name:  order.customer_name,
                customer_phone: order.customer_phone,
                created_at:     order.created_at,
                updated_at:     order.updated_at,
                paymentMethod:  order.paymentMethod || order.payment_method,
                payment_method: order.payment_method,
                receiptUrl:     order.receiptUrl || order.receipt_url,
                receipt_url:    order.receipt_url,
                items:          [],
                totalPrice:     0,
                statuses:       new Set()
            };
        }
        groupedMap[key].items.push(order);
        groupedMap[key].totalPrice += (order.price || 0) * (order.quantity || 1);
        groupedMap[key].statuses.add(order.status);
    });

    const groups = Object.values(groupedMap);

    const statusStyle = {
        'مكتمل':  'background:#dcfce7; color:#16a34a;',
        'ملغي':   'background:#fee2e2; color:#dc2626;',
        'مسترد':  'background:#fef9c3; color:#ca8a04;',
        'مختلط':  'background:#e0f2fe; color:#0284c7;',
    };

    ordersList.innerHTML = groups.map(group => {
        const createdAt  = group.created_at ? new Date(group.created_at) : null;
        const finishedAt = group.updated_at  ? new Date(group.updated_at) : null;

        const formatDate = (d) => d ? d.toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : '-';

        let timeDiff  = '';
        let timeColor = '#94a3b8';
        if (createdAt && finishedAt && finishedAt > createdAt) {
            const diffMs  = finishedAt - createdAt;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHr  = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHr / 24);
            if (diffSec < 60)      timeDiff = `${diffSec} ث`;
            else if (diffMin < 60) timeDiff = `${diffMin} د`;
            else if (diffHr < 24)  timeDiff = `${diffHr}س ${diffMin % 60}د`;
            else                   timeDiff = `${diffDay} يوم`;
            timeColor = diffMin < 2 ? '#22c55e' : diffMin < 30 ? '#f97316' : '#ef4444';
        }

        const dateCell = `
            <div style="font-size:11px;color:#94a3b8;">🕐 ${formatDate(createdAt)}</div>
            ${timeDiff ? `<div style="text-align:center;margin:3px 0;">
                <span style="display:inline-flex;align-items:center;gap:3px;
                    background:rgba(0,0,0,0.3);color:${timeColor};
                    border:1px solid ${timeColor}50;
                    padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;">
                    <i class="fas fa-clock"></i> ${timeDiff}
                </span>
            </div>` : ''}
            <div style="font-size:11px;color:#64748b;">✅ ${formatDate(finishedAt)}</div>
        `;

        const paymentMethod = group.paymentMethod || group.payment_method || '-';
        const receiptUrl    = group.receiptUrl || group.receipt_url;
        const receiptBtn    = receiptUrl
            ? `<a href="${receiptUrl}" target="_blank"
                style="background:#3b82f6;color:white;padding:5px 10px;border-radius:6px;font-size:12px;text-decoration:none;">
                <i class="fas fa-receipt"></i> عرض</a>`
            : '<span style="color:#64748b;">—</span>';

        // تحديد الحالة الإجمالية للمجموعة
        let groupStatus;
        if (group.statuses.size === 1) {
            groupStatus = [...group.statuses][0];
        } else {
            groupStatus = 'مختلط';
        }
        const style = statusStyle[groupStatus] || '';

        const itemCount = group.items.length;
        const totalQty  = group.items.reduce((s, o) => s + (o.quantity || 1), 0);
        const isSingle  = itemCount === 1;

        // صور
        const imagesCell = group.items.map(item => {
            const img = item.products?.image;
            return img
                ? `<img src="${img}" style="width:34px;height:34px;object-fit:contain;background:white;border-radius:4px;padding:2px;margin:1px;cursor:pointer;"
                    onclick="showOrderPopup('${item.id}')" title="${item.product_name || ''}">`
                : `<span style="cursor:pointer;font-size:18px;" onclick="showOrderPopup('${item.id}')">🎴</span>`;
        }).join('');

        // عرض المنتجات
        const productsCell = isSingle
            ? `<div>${group.items[0].product_name || '-'}</div>
               <div style="font-size:11px;color:#f97316;">${group.items[0].label || ''}</div>`
            : group.items.map(item => `
                <div style="font-size:12px;margin-bottom:3px;display:flex;align-items:center;gap:4px;">
                    <span style="color:#e2e8f0;">${item.product_name || '-'}</span>
                    ${item.label ? `<span style="color:#f97316;">(${item.label})</span>` : ''}
                    <span style="color:#64748b;">× ${item.quantity || 1}</span>
                    <span style="font-size:10px;padding:1px 6px;border-radius:10px;${statusStyle[item.status] || ''}">
                        ${item.status}
                    </span>
                </div>`
            ).join('');

        // شارة المجموعة
        const groupBadge = !isSingle
            ? `<div style="margin-bottom:4px;">
                <span style="display:inline-flex;align-items:center;gap:3px;background:rgba(59,130,246,0.12);
                    color:#60a5fa;border:1px solid rgba(59,130,246,0.3);
                    padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;">
                    <i class="fas fa-layer-group"></i> ${itemCount} طلبات
                </span>
               </div>`
            : '';

        // شارة المخزون/يدوي
        const autoApprovedCount = group.items.filter(i => i.auto_approved).length;
        const manualCount       = group.items.filter(i => i.status === 'مكتمل' && !i.auto_approved).length;
        let approvalBadge = '';
        if (autoApprovedCount > 0) {
            approvalBadge += `<div style="margin-top:4px;">
                <span style="display:inline-flex;align-items:center;gap:4px;
                    background:rgba(59,130,246,0.12);color:#60a5fa;
                    border:1px solid rgba(59,130,246,0.3);
                    padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">
                    <i class="fas fa-box"></i> مخزون${autoApprovedCount > 1 ? ' (' + autoApprovedCount + ')' : ''}
                </span></div>`;
        }
        if (manualCount > 0) {
            approvalBadge += `<div style="margin-top:4px;">
                <span style="display:inline-flex;align-items:center;gap:4px;
                    background:rgba(168,85,247,0.12);color:#c084fc;
                    border:1px solid rgba(168,85,247,0.3);
                    padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">
                    <i class="fas fa-hand-paper"></i> يدوي${manualCount > 1 ? ' (' + manualCount + ')' : ''}
                </span></div>`;
        }

        // زر الاسترداد — زر واحد يشمل جميع العناصر المكتملة
        const completedItems = group.items.filter(i => i.status === 'مكتمل');
        const completedIds   = JSON.stringify(completedItems.map(i => i.id)).replace(/"/g, '&quot;');
        const refundBtn = completedItems.length > 0
            ? `<button onclick="refundGroupOrders(${completedIds})"
                style="background:#f59e0b;color:white;border:none;padding:6px 12px;border-radius:6px;
                       cursor:pointer;font-size:12px;width:100%;display:flex;
                       align-items:center;gap:4px;justify-content:center;">
                <i class="fas fa-undo"></i> استرداد
               </button>`
            : '';

        return `
            <tr data-status="${groupStatus}" data-order-number="${group.order_number}">
                <td style="color:#f97316;font-weight:bold;">
                    ${groupBadge}
                    ${group.order_number}
                </td>
                <td>
                    <div>${group.customer_name || 'غير معروف'}</div>
                    <div style="font-size:11px;color:#94a3b8;">${group.customer_phone || ''}</div>
                </td>
                <td>${imagesCell || '-'}</td>
                <td>${productsCell}</td>
                <td><strong>${group.totalPrice} MRU</strong></td>
                <td style="text-align:center;">${totalQty}</td>
                <td>${dateCell}</td>
                <td>${paymentMethod}</td>
                <td>${receiptBtn}</td>
                <td>
                    <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;${style}">
                        ${groupStatus}
                    </span>
                    ${approvalBadge}
                    ${groupStatus === 'ملغي' && isSingle && group.items[0].reject_reason
                        ? `<div style="font-size:11px;color:#ef4444;margin-top:4px;">السبب: ${group.items[0].reject_reason}</div>`
                        : ''}
                </td>
                <td>${refundBtn}</td>
            </tr>
        `;
    }).join('');
}

// ==================== Popup تفاصيل الطلب ====================
window.showOrderPopup = (orderId) => {
    document.getElementById('order-detail-popup')?.remove();

    const order = (window._completedOrders || []).find(o => o.id === orderId);
    if (!order) return;

    const codes            = order.card_code ? order.card_code.split('\n').filter(c => c.trim()) : [];
    const suppliersDetails = order.suppliers_details || [];
    const totalPrice       = order.price * (order.quantity || 1);

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
                <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;font-weight:700;"><i class="fas fa-boxes"></i> الموردون</div>
                ${Object.values(suppliersMap).map(s => `
                    <div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <span style="font-weight:700;color:#e2e8f0;">🏪 ${s.name}</span>
                            <span style="font-size:11px;background:rgba(34,197,94,0.1);color:#22c55e;padding:2px 8px;border-radius:10px;">${s.codes.length} كود</span>
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

    let profitHtml = '';
    if (order.cost_price && order.cost_price > 0) {
        const totalCost = order.cost_price * 43 * (order.quantity || 1);
        const profit    = totalPrice - totalCost;
        profitHtml = `
            <div style="background:#0f172a;border-radius:8px;padding:12px;margin-bottom:16px;text-align:center;">
                <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">
                    التكلفة: $${order.cost_price} × ${order.quantity||1} × 43 = ${totalCost.toFixed(0)} MRU
                </div>
                <span style="color:#94a3b8;font-size:13px;">الربح: </span>
                <span style="color:${profit >= 0 ? '#22c55e' : '#ef4444'};font-size:20px;font-weight:bold;">${profit.toFixed(0)} MRU</span>
                <span style="color:#94a3b8;font-size:12px;margin-right:4px;">(${(profit/43).toFixed(2)} $)</span>
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
                <div><span style="color:#94a3b8;font-size:12px;">💳 الدفع</span><div>${order.paymentMethod || order.payment_method || '-'}</div></div>
                <div><span style="color:#94a3b8;font-size:12px;">📅 التاريخ</span><div style="font-size:12px;">${new Date(order.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div>
            </div>
            ${profitHtml}
            ${suppliersHtml}
            <div>
                <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;font-weight:700;">🔑 الأكواد (${codes.length})</div>
                ${codes.length > 0 ? `
                <div style="background:#0f172a;border-radius:8px;padding:12px;">
                    ${codes.map(c => `
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <span style="font-family:monospace;font-size:13px;color:#22c55e;flex:1;background:#1e293b;padding:6px 10px;border-radius:6px;">${c.trim()}</span>
                            <button onclick="copyText('${c.trim().replace(/'/g,"\\'")}')"
                                style="background:#334155;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    `).join('')}
                    <button onclick="copyText('${codes.join('\\n').replace(/'/g,"\\'")}')"
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

// ==================== استرداد مجموعة ====================
window.refundGroupOrders = async (ids) => {
    if (!confirm(`هل تريد استرداد ${ids.length} طلب وإرجاع الأكواد للمخزون؟`)) return;

    let totalCodesReturned = 0;
    let totalRefunded      = 0;

    for (const orderId of ids) {

        // ✅ جلب كل الحقول دفعة واحدة بما فيها user_id و price
        const { data: order } = await supabase
            .from('orders')
            .select('id, user_id, card_code, product_id, label, product_name, supplier_id, supplier_order_id, cost_price, price, quantity')
            .eq('id', orderId)
            .single();

        if (!order) continue;

        // تحديث حالة الطلب
        await supabase.from('orders').update({ status: 'مسترد' }).eq('id', orderId);

        // ✅ إرجاع المبلغ للمحفظة إذا كان الدفع بالمحفظة
        const refundAmount = (order.price || 0) * (order.quantity || 1);

        if (order.user_id && refundAmount > 0) {
            // جلب الرصيد الحالي
            const { data: userData } = await supabase
                .from('users')
                .select('balance')
                .eq('id', order.user_id)
                .single();

            const currentBalance = userData?.balance || 0;
            const newBalance     = currentBalance + refundAmount;

            // تحديث الرصيد
            await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', order.user_id);

            // تسجيل معاملة الاسترداد
          await supabase.from('wallet_transactions').insert({
                user_id:        order.user_id,
                type:           'deposit',
                amount:         refundAmount,
                payment_method: 'استرداد طلب',
                status:         'مكتمل',
                created_at:     new Date().toISOString()
            });

            totalRefunded += refundAmount;
        }

        // إرجاع الأكواد للمخزون
        if (order.card_code) {
            const codes = order.card_code.split('\n').map(c => c.trim()).filter(c => c);
            totalCodesReturned += codes.length;
            for (const code of codes) {
                await supabase.from('used_codes').delete().eq('code', code);
                await supabase.from('stocks').insert({
                    product_id:        order.product_id,
                    product_name:      order.product_name,
                    price_label:       order.label,
                    supplier_name:     order.supplier_id || 'غير محدد',
                    order_id:          order.supplier_order_id || null,
                    cost_per_card_usd: order.cost_price || 0,
                    code,
                    status:            'available',
                    notes:             '↩️ مسترد من طلب #' + orderId.substring(0, 7),
                    created_at:        new Date().toISOString()
                });
            }
        }
    }

    document.getElementById('order-detail-popup')?.remove();
    alert(`✅ تم استرداد ${ids.length} طلب\n💰 تم إرجاع ${totalRefunded.toLocaleString()} MRU للمحفظة\n🔑 تم إرجاع ${totalCodesReturned} كود للمخزون`);
    loadCompletedOrders();
};

// ==================== استرداد طلب واحد (legacy) ====================
window.refundOrder = async (orderId) => {
    const { data: mainOrder, error: fetchError } = await supabase
        .from('orders').select('order_number').eq('id', orderId).single();
    if (fetchError) { alert('خطأ: ' + fetchError.message); return; }

    const { data: allOrders } = await supabase
        .from('orders')
        .select('id, card_code, product_id, label, product_name, supplier_id, supplier_order_id, cost_price')
        .eq('order_number', mainOrder.order_number)
        .eq('status', 'مكتمل');

    if (!allOrders || allOrders.length === 0) { alert('لا توجد طلبات للاسترداد'); return; }
    await window.refundGroupOrders(allOrders.map(o => o.id));
};

// ==================== نسخ ====================
window.copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('✅ تم النسخ!'));
};

// ==================== فلاتر ====================
window.filterOrders = () => {
    const search       = document.getElementById('orderSearch')?.value.trim().toLowerCase() || '';
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
    if (to)   to.value   = '';
    loadCompletedOrders();
};

window.loadCompletedOrders = loadCompletedOrders;

// ==================== تشغيل ====================
document.addEventListener('DOMContentLoaded', () => {
    loadCompletedOrders();
    setInterval(loadCompletedOrders, 60000);
});