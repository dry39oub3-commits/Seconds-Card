import { supabase } from '../../js/supabase-config.js';

async function loadOrders() {
    const ordersList = document.getElementById('admin-orders-list');
    if (!ordersList) return;

    ordersList.innerHTML = '<tr><td colspan="10" style="text-align:center;">جاري التحميل...</td></tr>';

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, products(image, prices)')
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
        const status = order.status || 'قيد الانتظار';
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

// فتح نافذة القبول
window.openOrderModal = (order) => {
    const product = order.products || {};
    const image = product.image || '';
    const prices = product.prices || [];
    
    // بناء خيارات الموردين من بيانات المنتج
    const priceItem = prices.find(p => p.value == order.price) || prices[0] || {};
    const suppliers = priceItem.suppliers || [];
    const supplierOptions = suppliers.map(s => 
        `<option value="${s.url}">${s.name}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'order-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.7); z-index:9999;
        display:flex; align-items:center; justify-content:center;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border-radius:16px; padding:30px; width:90%; max-width:500px; color:#e2e8f0; position:relative;">
            
            <button onclick="document.getElementById('order-modal').remove()" 
                    style="position:absolute; top:15px; left:15px; background:#ef4444; color:white; border:none; border-radius:8px; padding:6px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>

            <h2 style="text-align:center; margin-bottom:20px; color:#f97316;">تفاصيل الطلب</h2>

            <!-- بطاقة تفاصيل الطلب -->
            <div style="background:#0f172a; border-radius:12px; padding:20px; margin-bottom:20px; display:flex; gap:15px; align-items:center;">
                <img src="${image}" style="width:80px; height:80px; object-fit:contain; background:white; border-radius:10px; padding:5px;" onerror="this.style.display='none'">
                <div style="flex:1;">
                    <h3 style="margin:0 0 8px; font-size:16px;">${order.product_name || 'غير محدد'}</h3>
                    <p style="margin:4px 0; color:#94a3b8; font-size:13px;">👤 ${order.customer_name || 'غير معروف'}</p>
                    <p style="margin:4px 0; color:#94a3b8; font-size:13px;">📱 ${order.customer_phone || '-'}</p>
                    <p style="margin:4px 0; font-size:13px;">💰 <strong style="color:#f97316;">${order.price} MRU</strong></p>
                    <p style="margin:4px 0; color:#94a3b8; font-size:13px;">🔢 الكمية: ${order.quantity || 1}</p>
                    <p style="margin:4px 0; color:#94a3b8; font-size:13px;">💳 ${order.payment_method || '-'}</p>
                </div>
            </div>

            <!-- حقل سعر التكلفة -->
            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">💵 سعر التكلفة ($)</label>
                <input type="number" id="modal-cost" placeholder="0.00" step="0.01"
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
            </div>

            <!-- حقل الكود -->
            <div style="margin-bottom:15px;">
                <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🔑 كود البطاقة</label>
                <input type="text" id="modal-code" placeholder="أدخل الكود هنا..."
                    style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
            </div>

            <!-- حقل معرف المورد -->
<div style="margin-bottom:15px;">
    <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🏪 معرف المورد</label>
    <input type="text" id="modal-supplier-id" placeholder="معرف المورد..."
        style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px; box-sizing:border-box;">
</div>

<!-- تحديد المورد -->
${suppliers.length > 0 ? `
<div style="margin-bottom:20px;">
    <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:6px;">🔗 اختر المورد</label>
    <div style="display:flex; gap:10px; align-items:center;">
        <select id="modal-supplier-select" onchange="onSupplierSelect(this)"
            style="flex:1; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; font-size:14px;">
            <option value="">-- اختر المورد --</option>
            ${supplierOptions}
        </select>
        <a id="supplier-buy-btn" href="#" target="_blank"
            style="display:none; background:#3b82f6; color:white; padding:10px 16px; border-radius:8px; text-decoration:none; font-size:13px; white-space:nowrap;">
            <i class="fas fa-external-link-alt"></i> شراء
        </a>
    </div>
</div>` : ''}

            <!-- زر القبول -->
            <button onclick="approveOrder('${order.id}')"
                style="width:100%; padding:14px; background:#22c55e; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-check-circle"></i> تأكيد القبول
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

window.onSupplierSelect = (select) => {
    const url = select.value;
    const name = select.options[select.selectedIndex].text;
    
    // ملء معرف المورد
    const supplierInput = document.getElementById('modal-supplier-id');
    if (supplierInput) supplierInput.value = name;

    // إظهار زر الشراء
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

    const { error } = await supabase
        .from('orders')
        .update({
            status: 'مكتمل',
            card_code: code,
            cost_price: parseFloat(cost) || 0,
            supplier_id: supplierId
        })
        .eq('id', orderId);

    if (error) {
        alert('خطأ: ' + error.message);
    } else {
        document.getElementById('order-modal').remove();
        alert('✅ تم قبول الطلب بنجاح!');
        loadOrders();
    }
};

window.filterOrders = () => {
    const search = document.getElementById('orderSearch').value.toLowerCase();
    document.querySelectorAll('#admin-orders-list tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
    });
};

document.addEventListener('DOMContentLoaded', loadOrders);