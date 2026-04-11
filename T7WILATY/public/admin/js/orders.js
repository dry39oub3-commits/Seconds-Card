import { supabase } from '../../js/supabase-config.js';

async function loadOrders() {
    const ordersList = document.getElementById('admin-orders-list');
    if (!ordersList) return;

    ordersList.innerHTML = '<tr><td colspan="10" style="text-align:center;">جاري التحميل...</td></tr>';

    const { data: orders, error } = await supabase
    .from('orders')
    .select('*, products(image, prices)')
    .not('status', 'in', '("مكتمل","ملغي","مسترد")')
    .order('created_at', { ascending: false });

    if (error) {
        ordersList.innerHTML = '<tr><td colspan="10" style="text-align:center;">❌ خطأ في جلب الطلبات</td></tr>';
        return;
    }

    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="10" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>';
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

        return `
            <tr id="order-row-${order.id}">
                <td>#${order.id.substring(0, 7)}</td>
                <td>${order.customer_name || 'غير معروف'}</td>
                <td>${imageCell}</td>
                <td>${order.product_name || 'غير محدد'}</td>
                <td><strong>${order.price} MRU</strong></td>
                <td>${order.quantity || 1}</td>
                <td><small>${date}</small></td>
                <td>${order.paymentMethod || order.payment_method || '-'}</td>
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

window.openOrderModal = (order) => {
    const product = order.products || {};
    const image = product.image || '';
    const prices = product.prices || [];
    const priceItem = prices.find(p => p.value == order.price) || prices[0] || {};
    const suppliers = priceItem.suppliers || [];

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

            <!-- بطاقة تفاصيل الطلب -->
            <div style="background:#0f172a; border-radius:12px; padding:20px; margin-bottom:20px; display:flex; gap:15px; align-items:center;">
                <img src="${image}" style="width:90px; height:90px; object-fit:contain; background:white; border-radius:10px; padding:5px; flex-shrink:0;" onerror="this.style.display='none'">
                <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <h3 style="margin:0 0 4px; font-size:17px; grid-column:1/-1;">${order.product_name || 'غير محدد'}</h3>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">👤 ${order.customer_name || 'غير معروف'}</p>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">📱 ${order.customer_phone || '-'}</p>
                    <p style="margin:0; font-size:13px;">💰 <strong style="color:#f97316;">${order.price} MRU</strong></p>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">🔢 الكمية: ${order.quantity || 1}</p>
                    <p style="margin:0; color:#94a3b8; font-size:13px;">💳 ${order.payment_method || '-'}</p>
                </div>
            </div>

            <!-- صفين جنب بعض -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                <!-- سعر التكلفة -->
                <div>
                    <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">💵 سعر التكلفة ($)</label>
                    <input type="number" id="modal-cost" placeholder="0.00" step="0.01"
                        oninput="calcProfit(${order.price})"
                        style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
                </div>

                <!-- كود البطاقة -->
                <div>
                    <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🔑 كود البطاقة</label>
                    <input type="text" id="modal-code" placeholder="أدخل الكود هنا..."
                        style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
                </div>
            </div>

            <!-- الربح -->
            <div id="profit-display" style="display:none; margin-bottom:15px; background:#0f172a; border-radius:8px; padding:12px; text-align:center;">
                <span style="color:#94a3b8; font-size:13px;">الربح: </span>
                <span id="profit-value" style="color:#22c55e; font-size:18px; font-weight:bold;"></span>
                <span style="color:#94a3b8; font-size:13px;"> MRU</span>
            </div>

            <!-- معرف المورد -->
            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🏪 معرف المورد</label>
                <input type="text" id="modal-supplier-id" placeholder="معرف المورد..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
            </div>

            <!-- اختر المورد -->
            ${suppliers.length > 0 ? `
            <div style="margin-bottom:20px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:8px;">🔗 اختر المورد</label>
                <div id="suppliers-list" style="display:flex; flex-direction:column; gap:8px;">
                    ${suppliers.map(s => `
                        <button onclick="selectSupplier('${s.url}', '${s.name}', this)"
                            style="width:100%; padding:12px 16px; background:#0f172a; border:2px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                            <a href="${s.url}" target="_blank" onclick="event.stopPropagation()"
                                style="color:#3b82f6; font-size:12px; white-space:nowrap; text-decoration:none;">
                                <i class="fas fa-external-link-alt"></i> شراء
                            </a>
                            <span>${s.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>` : ''}

            <!-- زر الرفض -->
            <div style="margin-bottom:12px;">
                <input type="text" id="reject-reason" placeholder="سبب الرفض..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #ef4444; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box; margin-bottom:8px;">
                <button onclick="rejectOrder('${order.id}')"
                    style="width:100%; padding:14px; background:#ef4444; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer; font-weight:bold;">
                    <i class="fas fa-times-circle"></i> رفض الطلب
                </button>
            </div>

            <!-- زر القبول -->
            <button onclick="approveOrder('${order.id}')"
                style="width:100%; padding:14px; background:#22c55e; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-check-circle"></i> تأكيد القبول
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

window.selectSupplier = (url, name, btn) => {
    document.querySelectorAll('#suppliers-list button').forEach(b => {
        b.style.borderColor = '#334155';
        b.style.background = '#0f172a';
    });
    btn.style.borderColor = '#f97316';
    btn.style.background = 'rgba(249,115,22,0.1)';
    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput) supplierInput.value = name;
    btn.dataset.url = url;
};

window.calcProfit = (orderPrice) => {
    const cost = parseFloat(document.getElementById('modal-cost').value) || 0;
    const profitDisplay = document.getElementById('profit-display');
    const profitValue = document.getElementById('profit-value');

    if (cost > 0) {
        const costInMRU = cost * 40;
        const profit = orderPrice - costInMRU;
        profitValue.textContent = profit.toFixed(0);
        profitValue.style.color = profit >= 0 ? '#22c55e' : '#ef4444';
        profitDisplay.style.display = 'block';
    } else {
        profitDisplay.style.display = 'none';
    }
};

window.onSupplierSelect = (select) => {
    const url = select.value;
    const name = select.options[select.selectedIndex].text;
    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput) supplierInput.value = name;
    const buyBtn = document.getElementById('supplier-buy-btn');
    if (buyBtn) {
        if (url) {
            buyBtn.href = url;
            buyBtn.style.display = 'inline-flex';
            buyBtn.style.alignItems = 'center';
            buyBtn.style.gap = '6px';
        } else {
            buyBtn.style.display = 'none';
        }
    }
};

window.approveOrder = async (orderId) => {
    const code = document.getElementById('modal-code').value.trim();
    const cost = document.getElementById('modal-cost').value;
    const supplierId = document.getElementById('modal-supplier-id').value;

    if (!code) {
        alert('⚠️ يرجى إدخال كود البطاقة!');
        return;
    }

    const suppliersList = document.getElementById('suppliers-list');
    if (suppliersList) {
        const selected = suppliersList.querySelector('button[style*="f97316"]');
        if (!selected) {
            alert('⚠️ يرجى تحديد المورد أولاً!');
            return;
        }
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: existingCode } = await supabase
        .from('orders')
        .select('id')
        .eq('card_code', code)
        .gte('created_at', sixMonthsAgo.toISOString())
        .maybeSingle();

    if (existingCode) {
        alert('⚠️ هذا الكود مستخدم بالفعل خلال آخر 6 أشهر!');
        return;
    }

    // تحقق من الـ orderId
    console.log("Approving order:", orderId);
    console.log("Update data:", { status: 'مكتمل', card_code: code, cost_price: parseFloat(cost) || 0, supplier_id: supplierId });

    const { data, error } = await supabase
        .from('orders')
        .update({
            status: 'مكتمل',
            card_code: code,
            cost_price: parseFloat(cost) || 0,
            supplier_id: supplierId
        })
        .eq('id', orderId)
        .select();

    console.log("Result:", data, error);

    if (error) {
        alert('خطأ: ' + error.message);
    } else {
        document.getElementById('order-modal').remove();
        alert('✅ تم قبول الطلب بنجاح!');
        loadOrders();
    }
};

document.addEventListener('DOMContentLoaded', loadOrders);

window.rejectOrder = async (orderId) => {
    const reason = document.getElementById('reject-reason').value.trim();

    if (!reason) {
        alert('⚠️ يرجى إدخال سبب الرفض!');
        return;
    }

    if (!confirm(`هل تريد رفض هذا الطلب؟\nالسبب: ${reason}`)) return;

    const { error } = await supabase
        .from('orders')
        .update({
            status: 'ملغي',
            reject_reason: reason
        })
        .eq('id', orderId);

    if (error) {
        alert('خطأ: ' + error.message);
    } else {
        document.getElementById('order-modal').remove();
        alert('تم رفض الطلب.');
        loadOrders();
    }
};