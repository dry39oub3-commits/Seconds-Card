import { supabase } from '../../js/supabase-config.js';

const USD_TO_MRU = 43;

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

    // ✅ معالجة طلبات المحفظة تلقائياً
    for (const order of orders) {
        const paymentMethod = order.paymentMethod || order.payment_method || '';
        if (paymentMethod === 'المحفظة' || paymentMethod === 'محفظة') {
            await tryAutoApproveFromStock(order);
        }
    }

    // إعادة جلب الطلبات بعد المعالجة التلقائية
    const { data: remainingOrders } = await supabase
        .from('orders')
        .select('*, products(image, prices)')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")')
        .order('created_at', { ascending: false });

    if (!remainingOrders || remainingOrders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="11" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>';
        return;
    }

    ordersList.innerHTML = remainingOrders.map(order => {
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

// ==================== قبول تلقائي من المخزون ====================
async function tryAutoApproveFromStock(order) {
    const quantity  = order.quantity || 1;
    const productId = order.product_id;
    const label     = order.label;
    if (!productId || !label) return false;

    const { data: availableCodes, error } = await supabase
        .from('stocks')
        .select('*')
        .eq('product_id', productId)
        .eq('price_label', label)
        .eq('status', 'available')
        .order('created_at', { ascending: true })
        .limit(quantity);

    if (error || !availableCodes || availableCodes.length < quantity) return false;

    const codes    = availableCodes.map(c => c.code);
    const stockIds = availableCodes.map(c => c.id);

    // ✅ cost_per_card_usd هو الحقل الصحيح
    const costPerCode    = availableCodes[0]?.cost_per_card_usd || 0;
    const supplierName   = availableCodes[0]?.supplier_name || 'تلقائي';
    const supplierOrderId = availableCodes[0]?.order_id || '';

    const suppliersMap = {};
    availableCodes.forEach(c => {
        const name = c.supplier_name || 'غير محدد';
        if (!suppliersMap[name]) {
            suppliersMap[name] = { supplier_name: name, supplier_order_id: c.order_id || '' };
        }
    });

    for (const code of codes) {
        const { data: existing } = await supabase
            .from('used_codes').select('id').eq('code', code).maybeSingle();
        if (existing) return false;
    }

    const { error: updateError } = await supabase
        .from('orders')
        .update({
            status:            'مكتمل',
            card_code:         codes.join('\n'),
            cost_price:        costPerCode,
            supplier_id:       supplierName,
            supplier_order_id: supplierOrderId,
            suppliers_details: Object.values(suppliersMap),
            auto_approved:     true
        })
        .eq('id', order.id);

    if (updateError) { console.error('فشل القبول التلقائي:', updateError.message); return false; }

    for (const code of codes) {
        await supabase.from('used_codes').insert({
            code, order_id: order.id, product_name: order.product_name
        });
    }

    await supabase
        .from('stocks')
        .update({ status: 'sold', sold_at: new Date().toISOString(), order_id: order.id })
        .in('id', stockIds);

    console.log(`✅ تم قبول الطلب ${order.order_number || order.id} تلقائياً`);
    return true;
}

// ==================== فتح Modal الطلب ====================
window.openOrderModal = (order) => {
    const product    = order.products || {};
    const image      = product.image || '';
    const totalPrice = order.price * (order.quantity || 1);

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

            <div id="profit-display" style="display:none; margin-bottom:15px; background:#0f172a; border-radius:8px; padding:12px; text-align:center;"></div>

            <!-- قسم موردو المخزون — يظهر فقط بعد السحب -->
            <div id="stock-suppliers-section" style="display:none; margin-bottom:15px;">
                <div style="background:#0f172a; border:1px solid #1e3a5f; border-radius:12px; padding:16px;">
                    <p style="font-size:13px; color:#3b82f6; font-weight:700; margin:0 0 12px; display:flex; align-items:center; gap:6px;">
                        <i class="fas fa-boxes"></i> موردو هذا الكود في المخزون
                    </p>
                    <div id="stock-suppliers-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                </div>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🏪 اسم المورد</label>
                <input type="text" id="modal-supplier-id" placeholder="اسم المورد..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🔖 Order ID المورد</label>
                <input type="text" id="modal-supplier-order-id" placeholder="أدخل Order ID من المورد..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
            </div>

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

window.calcProfit = (orderPrice) => {
    const cost         = parseFloat(document.getElementById('modal-cost').value) || 0;
    const codesText    = document.getElementById('modal-code').value.trim();
    const quantity     = codesText ? codesText.split('\n').filter(c => c.trim() !== '').length : 1;
    const profitDisplay = document.getElementById('profit-display');

    if (cost > 0) {
        const totalCost = cost * USD_TO_MRU * quantity;
        const profit    = orderPrice - totalCost;
        profitDisplay.style.display = 'block';
        profitDisplay.innerHTML = `
            <div style="font-size:12px; color:#64748b; margin-bottom:6px;">
                التكلفة: $${cost} × ${quantity} كود × ${USD_TO_MRU} = ${totalCost.toFixed(0)} MRU
            </div>
            <span style="color:#94a3b8; font-size:13px;">الربح: </span>
            <span style="color:${profit >= 0 ? '#22c55e' : '#ef4444'}; font-size:18px; font-weight:bold;">${profit.toFixed(0)}</span>
            <span style="color:#94a3b8; font-size:13px;"> MRU</span>
        `;
    } else {
        profitDisplay.style.display = 'none';
    }
};

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

    // ✅ استخدام cost_per_card_usd — الحقل الصحيح في جدول stocks
    const { data: availableCodes, error } = await supabase
        .from('stocks')
        .select('id, code, price_value, supplier_name, order_id, cost_per_card_usd')
        .eq('product_id', productId)
        .eq('price_label', label)
        .eq('status', 'available')
        .order('created_at', { ascending: true })
        .limit(quantity);

    if (error) {
        statusEl.textContent = '❌ خطأ: ' + error.message;
        statusEl.style.color = '#ef4444';
        document.getElementById('stock-suppliers-section').style.display = 'none';
        return;
    }

    if (!availableCodes || availableCodes.length === 0) {
        statusEl.textContent = `❌ لا توجد أكواد متاحة للفئة "${label}"`;
        statusEl.style.color = '#ef4444';
        document.getElementById('stock-suppliers-section').style.display = 'none';
        return;
    }

    statusEl.textContent = availableCodes.length < quantity
        ? `⚠️ يوجد ${availableCodes.length} كود فقط من أصل ${quantity} مطلوب`
        : `✅ تم سحب ${availableCodes.length} كود من المخزون`;
    statusEl.style.color = availableCodes.length < quantity ? '#f97316' : '#22c55e';

    document.getElementById('modal-code').value = availableCodes.map(c => c.code).join('\n');
    window._reservedStockIds = availableCodes.map(c => c.id);
    window._stockCodesData   = availableCodes.map(c => ({
        id:           c.id,
        code:         c.code,
        supplier_name: c.supplier_name || 'غير محدد',
        order_id:     c.order_id || '',
        // ✅ cost_per_card_usd بدلاً من cost_price
        cost_per_card_usd: c.cost_per_card_usd || 0
    }));

    // تعبئة حقل التكلفة من cost_per_card_usd
    const costField  = document.getElementById('modal-cost');
    const firstCost  = availableCodes[0]?.cost_per_card_usd;
    if (costField && firstCost > 0) {
        costField.value = parseFloat(firstCost).toFixed(4);
        calcProfit(orderPrice);
    }

    // بناء قائمة الموردين
    const suppliersMap = {};
    availableCodes.forEach(c => {
        const name = c.supplier_name || 'غير محدد';
        if (!suppliersMap[name]) {
            suppliersMap[name] = { name, order_id: c.order_id || '', count: 0 };
        }
        suppliersMap[name].count++;
    });

    const suppliers = Object.values(suppliersMap);
    const section   = document.getElementById('stock-suppliers-section');
    const list      = document.getElementById('stock-suppliers-list');

    list.innerHTML = suppliers.map(s => `
        <div style="width:100%; padding:12px 16px;
               background:rgba(249,115,22,0.08); border:2px solid #f97316;
               border-radius:8px; color:#e2e8f0; font-size:13px;
               display:flex; justify-content:space-between; align-items:center;">
            <span style="display:flex; align-items:center; gap:8px;">
                ${s.order_id ? `<span style="color:#94a3b8;">🔖 ${s.order_id}</span>` : ''}
                <span style="color:#22c55e; background:rgba(34,197,94,0.1); padding:2px 8px; border-radius:10px;">
                    ${s.count} كود
                </span>
            </span>
            <span style="font-weight:700; font-size:14px;">🏪 ${s.name}</span>
        </div>
    `).join('');

    // تعبئة حقلي المورد تلقائياً
    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput) supplierInput.value = suppliers.map(s => s.name).join(' / ');
    const orderInput = document.getElementById('modal-supplier-order-id');
    if (orderInput) orderInput.value = suppliers.map(s => s.order_id).filter(Boolean).join(' / ');

    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ==================== قبول الطلب ====================
window.approveOrder = async (orderId, quantity) => {
    const codesRaw = document.getElementById('modal-code').value.trim();
    const codes    = codesRaw.split('\n').map(c => c.trim()).filter(c => c !== '');
    const cost     = document.getElementById('modal-cost').value.trim();
    const supplierId      = document.getElementById('modal-supplier-id').value.trim();
    const supplierOrderId = document.getElementById('modal-supplier-order-id')?.value.trim() || '';

    if (codes.length === 0)          { alert('⚠️ يرجى إدخال كود البطاقة!'); return; }
    if (codes.length !== quantity)   { alert(`⚠️ عدد الأكواد (${codes.length}) لا يطابق الكمية (${quantity})!`); return; }
    if (!cost || parseFloat(cost) <= 0) { alert('⚠️ يرجى إدخال سعر التكلفة!'); return; }
    if (!supplierId)                 { alert('⚠️ يرجى إدخال اسم المورد!'); return; }

    for (const c of codes) {
        const { data: existing } = await supabase
            .from('used_codes').select('id').eq('code', c).maybeSingle();
        if (existing) { alert(`⚠️ الكود "${c}" مستخدم بالفعل!`); return; }
    }

    // ✅ بناء suppliersDetails من _stockCodesData بشكل صحيح
    const stockCodesData   = window._stockCodesData || [];
    const suppliersDetails = stockCodesData.map(c => ({
        code:              c.code,
        supplier_name:     c.supplier_name,
        supplier_order_id: c.order_id
    }));

    // ✅ إصلاح: المتغيرات كانت غير معرّفة — نستخدم cost و supplierId المُدخَلَين
    const { data: orderData, error } = await supabase
        .from('orders')
        .update({
            status:            'مكتمل',
            card_code:         codes.join('\n'),
            cost_price:        parseFloat(cost),       // ✅ من حقل الإدخال
            supplier_id:       supplierId,             // ✅ من حقل الإدخال
            supplier_order_id: supplierOrderId,
            suppliers_details: suppliersDetails.length > 0 ? suppliersDetails : null
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) { alert('خطأ: ' + error.message); return; }

    for (const c of codes) {
        await supabase.from('used_codes').insert({
            code: c, order_id: orderId, product_name: orderData?.product_name || ''
        });
    }

    // ✅ تحديث stocks بـ status = 'sold'
    const reservedIds = window._reservedStockIds;
    if (reservedIds && reservedIds.length > 0) {
        await supabase
            .from('stocks')
            .update({ status: 'sold', sold_at: new Date().toISOString(), order_id: orderId })
            .in('id', reservedIds);
        window._reservedStockIds = null;
        window._stockCodesData   = null;
    } else {
        for (const code of codes) {
            await supabase
                .from('stocks')
                .update({ status: 'sold', sold_at: new Date().toISOString(), order_id: orderId })
                .eq('code', code)
                .eq('status', 'available');
        }
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
    window._reservedStockIds = null;
    window._stockCodesData   = null;
    document.getElementById('order-modal').remove();
    alert('تم رفض الطلب.');
    loadOrders();
};

// ==================== عداد الطلبات ====================
async function checkNewOrders() {
    const { data: orders } = await supabase
        .from('orders').select('id')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")');

    const count = orders?.length || 0;
    const badge = document.getElementById('orders-badge');
    if (badge) {
        badge.textContent  = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
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

    // ✅ تحديث فوري عبر Realtime بدل setInterval
    const channel = supabase
        .channel('orders-realtime')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            (payload) => {
                console.log('📡 تغيير في الطلبات:', payload.eventType);
                loadOrders();
                checkNewOrders();
            }
        )
        .subscribe();

    
    setInterval(() => { checkNewOrders(); }, 30000);
});