import { supabase } from '../../js/supabase-config.js';

const USD_TO_MRU = 43; // سعر الدولار بالأوقية

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

    ordersList.innerHTML = orders.map(order => {
        const date = order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : 'غير محدد';
        const receiptUrl = order.receiptUrl || order.receipt_url;
        const receiptBtn = receiptUrl ?
            `<a href="${receiptUrl}" target="_blank" class="btn-check" title="عرض الإيصال"><i class="fas fa-receipt"></i></a>` : '-';
        const image = order.products?.image;
        const imageCell = image ?
            `<img src="${image}" style="width:40px; height:40px; object-fit:contain; background:white; border-radius:5px; padding:2px;">` : '-';
        const paymentMethod = order.paymentMethod || order.payment_method || '-';
        const totalPrice = order.price * (order.quantity || 1);

        return `
            <tr id="order-row-${order.id}">
                <td style="color:#f97316; font-weight:bold;">${order.order_number || '#' + order.id.substring(0, 7)}</td>
                <td>${order.customer_name || 'غير معروف'}</td>
                <td>${imageCell}</td>
                <td>${order.product_name || 'غير محدد'}</td>
                <td>${order.label || '-'}</td>
                <td><strong>${totalPrice} MRU</strong></td>
                <td>${order.quantity || 1}</td>
                <td><small>${date}</small></td>
                <td>${paymentMethod}</td>
                <td>${receiptBtn}</td>
                <td>
                    <button onclick="openOrderModal(${JSON.stringify(order).replace(/"/g, '&quot;')})"
                            style="background:#22c55e; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px;">
                        <i class="fas fa-check-circle"></i> قبول
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ==================== فتح Modal الطلب ====================
window.openOrderModal = (order) => {
    const product = order.products || {};
    const image = product.image || '';
    const prices = product.prices || [];
    const priceItem = prices.find(p => p.value == order.price) || prices[0] || {};
    const suppliers = priceItem.suppliers || [];
    const totalPrice = order.price * (order.quantity || 1);

    document.getElementById('order-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'order-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.85); z-index:9999;
        display:flex; align-items:flex-start; justify-content:center;
        overflow-y:auto; padding:20px; box-sizing:border-box;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border-radius:16px; padding:30px; width:100%; max-width:750px; color:#e2e8f0; position:relative; margin:auto;">
            <button onclick="document.getElementById('order-modal').remove()"
                    style="position:absolute; top:15px; left:15px; background:#ef4444; color:white; border:none; border-radius:8px; padding:6px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>
            <h2 style="text-align:center; margin-bottom:20px; color:#f97316;">تفاصيل الطلب</h2>

            <div style="background:#0f172a; border-radius:12px; padding:20px; margin-bottom:20px; display:flex; gap:15px; align-items:center;">
                <img src="${image}" style="width:90px; height:90px; object-fit:contain; background:white; border-radius:10px; padding:5px; flex-shrink:0;" onerror="this.style.display='none'">
                <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <h3 style="margin:0 0 4px; font-size:17px; grid-column:1/-1;">${order.product_name || 'غير محدد'}</h3>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">👤 ${order.customer_name || 'غير معروف'}</p>
                    <p style="margin:0; font-size:13px;">🏷️ الفئة: <strong style="color:#f97316;">${order.label || '-'}</strong></p>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">📱 ${order.customer_phone || '-'}</p>
                    <p style="margin:0; font-size:13px;">💰 <strong style="color:#f97316;">${totalPrice} MRU</strong></p>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">🔢 الكمية: ${order.quantity || 1}</p>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">💳 ${order.paymentMethod || order.payment_method || '-'}</p>
                </div>
            </div>

           <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                <div>
                    <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">💵 سعر التكلفة ($) — لكود واحد</label>
                    <input type="number" id="modal-cost" placeholder="0.00" step="0.01"
                        oninput="calcProfit(${totalPrice})"
                        style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">

                    <button onclick="loadFromStock('${order.product_id}', '${order.label}', ${order.quantity || 1}, ${totalPrice})"
                        style="width:100%; margin-top:10px; padding:10px; background:rgba(59,130,246,0.15);
                            color:#3b82f6; border:1px solid #3b82f6; border-radius:8px;
                            cursor:pointer; font-size:13px; font-weight:bold; transition:0.2s;"
                        onmouseover="this.style.background='rgba(59,130,246,0.3)'"
                        onmouseout="this.style.background='rgba(59,130,246,0.15)'">
                        <i class="fas fa-box-open"></i> سحب من المخزون
                    </button>
                    <p id="stock-status" style="font-size:11px; color:#94a3b8; margin-top:5px; text-align:center;"></p>
                </div>

                <div>
                    <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">
                        🔑 أكواد البطاقة (${order.quantity || 1} كود) — كود في كل سطر
                    </label>
                    <textarea id="modal-code" placeholder="كود 1&#10;كود 2&#10;كود 3..."
                        rows="${Math.max(3, order.quantity || 1)}"
                        style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box; resize:vertical; font-family:monospace; line-height:1.8;"></textarea>
                    <p style="font-size:11px; color:#64748b; margin-top:4px;">أدخل كل كود في سطر منفصل</p>
                </div>
            </div>

            <div id="profit-display" style="display:none; margin-bottom:15px; background:#0f172a; border-radius:8px; padding:12px; text-align:center;">
                <span style="color:#94a3b8; font-size:13px;">الربح: </span>
                <span id="profit-value" style="color:#22c55e; font-size:18px; font-weight:bold;"></span>
                <span style="color:#94a3b8; font-size:13px;"> MRU</span>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🏪 اسم المورد</label>
                <input type="text" id="modal-supplier-id" placeholder="اسم المورد..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🔖 Order ID المورد</label>
                <input type="text" id="modal-supplier-order-id" placeholder="أدخل Order ID من المورد..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
            </div>

            ${suppliers.length > 0 ? `
            <div style="margin-bottom:20px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:8px;">🔗 اختر المورد</label>
                <div id="suppliers-list" style="display:flex; flex-direction:column; gap:8px;">
                    ${suppliers.map(s => `
                        <button onclick="selectSupplier('${s.url}', '${s.name}', this)"
                            style="width:100%; padding:12px 16px; background:#0f172a; border:2px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                            <a href="${s.url}" target="_blank" onclick="event.stopPropagation()"
                                style="color:#3b82f6; font-size:12px; text-decoration:none;">
                                <i class="fas fa-external-link-alt"></i> شراء
                            </a>
                            <span>${s.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>` : ''}

            <div style="margin-bottom:12px;">
                <input type="text" id="reject-reason" placeholder="سبب الرفض..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #ef4444; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box; margin-bottom:8px;">
                <button onclick="rejectOrder('${order.id}')"
                    style="width:100%; padding:14px; background:#ef4444; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer; font-weight:bold;">
                    <i class="fas fa-times-circle"></i> رفض الطلب
                </button>
            </div>

            <button onclick="approveOrder('${order.id}', ${order.quantity || 1})"
                style="width:100%; padding:14px; background:#22c55e; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-check-circle"></i> تأكيد القبول
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

// ==================== دوال مساعدة ====================
window.selectSupplier = (url, name, btn) => {
    document.querySelectorAll('#suppliers-list button').forEach(b => {
        b.style.borderColor = '#334155';
        b.style.background = '#0f172a';
    });
    btn.style.borderColor = '#f97316';
    btn.style.background = 'rgba(249,115,22,0.1)';
    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput) supplierInput.value = name;
};

// ✅ الربح = السعر الكلي - (تكلفة كود × عدد الأكواد × 43)
// ✅ الربح = السعر الكلي - (تكلفة كود واحد × الكمية × 43)
window.calcProfit = (orderPrice) => {
    const cost = parseFloat(document.getElementById('modal-cost').value) || 0;
    const codesText = document.getElementById('modal-code').value.trim();
    const quantity = codesText ? codesText.split('\n').filter(c => c.trim() !== '').length : 1;
    const profitDisplay = document.getElementById('profit-display');
    const profitValue = document.getElementById('profit-value');

    if (cost > 0) {
        const totalCost = cost * USD_TO_MRU * quantity; // ✅ ضرب الكمية
        const profit = orderPrice - totalCost;

        profitValue.textContent = profit.toFixed(0);
        profitValue.style.color = profit >= 0 ? '#22c55e' : '#ef4444';
        profitDisplay.style.display = 'block';

        // ✅ عرض تفاصيل التكلفة
        profitDisplay.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:12px; color:#64748b; margin-bottom:6px;">
                <span>التكلفة: $${cost} × ${quantity} كود × ${USD_TO_MRU} = ${totalCost.toFixed(0)} MRU</span>
            </div>
            <span style="color:#94a3b8; font-size:13px;">الربح: </span>
            <span id="profit-value" style="color:${profit >= 0 ? '#22c55e' : '#ef4444'}; font-size:18px; font-weight:bold;">${profit.toFixed(0)}</span>
            <span style="color:#94a3b8; font-size:13px;"> MRU</span>
        `;
    } else {
        profitDisplay.style.display = 'none';
    }
};

// ==================== قبول الطلب ====================
window.approveOrder = async (orderId, quantity) => {
    const codesRaw = document.getElementById('modal-code').value.trim();
    const codes = codesRaw.split('\n').map(c => c.trim()).filter(c => c !== '');
    const cost = document.getElementById('modal-cost').value.trim();
    const supplierId = document.getElementById('modal-supplier-id').value.trim();
    const supplierOrderId = document.getElementById('modal-supplier-order-id')?.value.trim() || '';

    if (codes.length === 0) { alert('⚠️ يرجى إدخال كود البطاقة!'); return; }
    
    if (codes.length !== quantity) {
        alert(`⚠️ عدد الأكواد (${codes.length}) لا يطابق الكمية المطلوبة (${quantity})!\n\nيجب إدخال ${quantity} كود بالضبط.`);
        return;
    }

    if (!cost || parseFloat(cost) <= 0) { alert('⚠️ يرجى إدخال سعر التكلفة!'); return; }
    if (!supplierId) { alert('⚠️ يرجى إدخال أو اختيار اسم المورد!'); return; }

    for (const c of codes) {
        const { data: existingCode } = await supabase
            .from('used_codes').select('id').eq('code', c).maybeSingle();
        if (existingCode) { alert(`⚠️ الكود "${c}" مستخدم بالفعل!`); return; }
    }

    const { data: orderData, error } = await supabase
        .from('orders')
        .update({
            status: 'مكتمل',
            card_code: codes.join('\n'),
            cost_price: parseFloat(cost) || 0,
            supplier_id: supplierId,
            supplier_order_id: supplierOrderId
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) { alert('خطأ: ' + error.message); return; }

    for (const c of codes) {
        await supabase.from('used_codes').insert({
            code: c, order_id: orderId, product_name: orderData.product_name
        });
    }

    // ===== حذف الأكواد المستخدمة من المخزون =====
    // ===== حذف الأكواد المستخدمة من المخزون =====
const { data: productData } = await supabase
    .from('products')
    .select('prices')
    .eq('id', orderData.product_id)
    .single();

if (productData?.prices) {
    const updatedPrices = productData.prices.map(p => {
        if (p.label === orderData.label) {
            const remainingCodes = (p.codes || []).filter(
                stockItem => !codes.includes(
                    (typeof stockItem === 'string' ? stockItem : stockItem.code).trim()
                )
            );
            return { ...p, codes: remainingCodes };
        }
        return p;
    });

    await supabase
        .from('products')
        .update({ prices: updatedPrices })
        .eq('id', orderData.product_id);
}

    document.getElementById('order-modal').remove();
    alert('✅ تم قبول الطلب بنجاح!');
    loadOrders();
};

// ==================== رفض الطلب ====================
window.rejectOrder = async (orderId) => {
    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) { alert('⚠️ يرجى إدخال سبب الرفض!'); return; }
    if (!confirm(`هل تريد رفض هذا الطلب؟\nالسبب: ${reason}`)) return;

    const { error } = await supabase
        .from('orders')
        .update({ status: 'ملغي', reject_reason: reason })
        .eq('id', orderId);

    if (error) { alert('خطأ: ' + error.message); return; }
    document.getElementById('order-modal').remove();
    alert('تم رفض الطلب.');
    loadOrders();
};

// ==================== عداد الطلبات الجديدة ====================
async function checkNewOrders() {
    const { data: orders } = await supabase
        .from('orders').select('id')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")');

    const count = orders?.length || 0;
    const badge = document.getElementById('orders-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
    document.title = count > 0 ? `(${count}) طلب جديد | إدارة الطلبات` : 'إدارة الطلبات | SecondsCard';
}

// ==================== فلتر البحث ====================
window.filterOrders = () => {
    const search = document.getElementById('orderSearch').value.trim().toLowerCase();
    document.querySelectorAll('#admin-orders-list tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(search) ? '' : 'none';
    });
};

// ==================== تشغيل عند التحميل ====================
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    checkNewOrders();
    setInterval(() => { loadOrders(); checkNewOrders(); }, 30000);
});

// ==================== سحب من المخزون ====================
window.loadFromStock = async (productId, label, quantity, orderPrice) => {
    const statusEl = document.getElementById('stock-status');

    if (!productId || productId === 'null' || productId === 'undefined') {
        statusEl.textContent = '⚠️ لا يوجد منتج مرتبط';
        statusEl.style.color = '#ef4444';
        return;
    }

    statusEl.textContent = '⏳ جاري البحث في المخزون...';
    statusEl.style.color = '#94a3b8';

    const { data: product, error } = await supabase
        .from('products')
        .select('prices, name')
        .eq('id', productId)
        .single();

    if (error || !product) {
        statusEl.textContent = '❌ تعذر جلب بيانات المنتج';
        statusEl.style.color = '#ef4444';
        return;
    }

    const prices = product.prices || [];
    const priceObj = label ? prices.find(p => p.label === label) : prices[0];

    if (!priceObj) {
        statusEl.textContent = `❌ لم يتم إيجاد الفئة "${label}"`;
        statusEl.style.color = '#ef4444';
        return;
    }

    const codes = priceObj.codes || [];

    if (codes.length === 0) {
        statusEl.textContent = '❌ لا توجد أكواد في المخزون لهذه الفئة';
        statusEl.style.color = '#ef4444';
        return;
    }

    const selectedCodes = codes.slice(0, quantity);

    if (selectedCodes.length < quantity) {
        statusEl.textContent = `⚠️ يوجد ${selectedCodes.length} كود فقط من أصل ${quantity} مطلوب`;
        statusEl.style.color = '#f97316';
    } else {
        statusEl.textContent = `✅ تم سحب ${selectedCodes.length} كود من المخزون`;
        statusEl.style.color = '#22c55e';
    }

    // ✅ وضع الأكواد
    document.getElementById('modal-code').value = selectedCodes.map(c => c.code).join('\n');

    // ✅ تعبئة تكلفة كود واحد + حساب الربح تلقائياً بالكمية
    const firstCode = selectedCodes[0];
    const costField = document.getElementById('modal-cost');
    if (costField && firstCode?.costPrice) {
        costField.value = firstCode.costPrice;
        calcProfit(orderPrice);
    }

    // ✅ تعبئة اسم المورد
    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput && firstCode?.supplierName) {
        supplierInput.value = firstCode.supplierName;
    }

    // ✅ تعبئة Order ID
    const supplierOrderInput = document.getElementById('modal-supplier-order-id');
    if (supplierOrderInput && firstCode?.supplierOrderId) {
        supplierOrderInput.value = firstCode.supplierOrderId;
    }
};