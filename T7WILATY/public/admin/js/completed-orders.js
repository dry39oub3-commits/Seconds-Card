import { supabase } from '../../js/supabase-config.js';

// ==================== تحميل الطلبات المكتملة ====================
async function loadCompletedOrders() {
    const ordersList = document.getElementById('completed-orders-list');
    if (!ordersList) return;

    ordersList.innerHTML = '<tr><td colspan="12" style="text-align:center;">جاري التحميل...</td></tr>';

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
        ordersList.innerHTML = '<tr><td colspan="12" style="text-align:center;">❌ خطأ في جلب الطلبات</td></tr>';
        return;
    }

    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="12" style="text-align:center;">📭 لا توجد طلبات</td></tr>';
        return;
    }

    updateSummary(orders);

    const statusStyle = {
        'مكتمل': 'background:#dcfce7; color:#16a34a;',
        'ملغي':  'background:#fee2e2; color:#dc2626;',
        'مسترد': 'background:#fef9c3; color:#ca8a04;',
    };

    ordersList.innerHTML = orders.map(order => {
        const date = order.created_at ? new Date(order.created_at).toLocaleString('ar-EG') : '-';
        const image = order.products?.image;
        const imageCell = image
            ? `<img src="${image}" style="width:38px;height:38px;object-fit:contain;background:white;border-radius:5px;padding:2px;">`
            : '-';
        const totalPrice = order.price * (order.quantity || 1);
        const paymentMethod = order.paymentMethod || order.payment_method || '-';
        const status = order.status || '-';
        const style = statusStyle[status] || 'background:#e2e8f0; color:#334155;';

        // ✅ داخل الـ map
        const receiptUrl = order.receiptUrl || order.receipt_url;
        const receiptBtn = receiptUrl
            ? `<a href="${receiptUrl}" target="_blank"
                  style="background:#3b82f6;color:white;padding:5px 10px;border-radius:6px;font-size:12px;text-decoration:none;">
                   <i class="fas fa-receipt"></i> عرض
               </a>`
            : '<span style="color:#64748b;">—</span>';

        const codesHtml = order.card_code
            ? `<button onclick="toggleCode('${order.id}')"
                   id="btn-${order.id}"
                   style="background:#1e40af;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;white-space:nowrap;">
                   <i class="fas fa-key"></i> عرض الكود
               </button>
               <div id="codes-${order.id}" style="display:none; margin-top:8px;">
                   ${order.card_code.split('\n').filter(c => c.trim()).map(c => `
                       <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                           <span style="background:#0f172a;padding:4px 10px;border-radius:4px;font-family:monospace;font-size:12px;color:#22c55e;">
                               ${c.trim()}
                           </span>
                           <button onclick="copyText('${c.trim().replace(/'/g, "\\'")}')"
                               style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;" title="نسخ">
                               <i class="fas fa-copy"></i>
                           </button>
                       </div>
                   `).join('')}
               </div>`
            : '<span style="color:#64748b;">—</span>';

        return `
            <tr>
                <td style="color:#f97316;font-weight:bold;">${order.order_number || '#' + order.id.substring(0,7)}</td>
                <td>${order.customer_name || 'غير معروف'}</td>
                <td>${imageCell}</td>
                <td>${order.product_name || '-'}</td>
                <td><strong>${totalPrice} MRU</strong></td>
                <td>${order.quantity || 1}</td>
                <td><small>${date}</small></td>
                <td>${paymentMethod}</td>
                <td>${receiptBtn}</td>
                <td>
                    <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;${style}">
                        ${status}
                    </span>
                    ${status === 'ملغي' && order.reject_reason
                        ? `<div style="font-size:11px;color:#ef4444;margin-top:4px;">السبب: ${order.reject_reason}</div>`
                        : ''}
                </td>
                <td>${codesHtml}</td>
                ${status === 'مكتمل' ? `
                <td>
                    <button onclick="refundOrder('${order.id}')"
                        style="background:#f59e0b;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">
                        <i class="fas fa-undo"></i> استرداد
                    </button>
                </td>` : '<td>—</td>'}
            </tr>
        `;
    }).join('');
}

// ===== toggle الكود =====
window.toggleCode = (orderId) => {
    const div = document.getElementById(`codes-${orderId}`);
    const btn = document.getElementById(`btn-${orderId}`);
    if (!div || !btn) return;

    if (div.style.display === 'none') {
        div.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i> إخفاء الكود';
        btn.style.background = '#374151';
    } else {
        div.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-key"></i> عرض الكود';
        btn.style.background = '#1e40af';
    }
};

// ==================== ملخص الإجماليات ====================
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
    if (!confirm('هل تريد تحديد هذا الطلب كمسترد؟')) return;
    const { error } = await supabase
        .from('orders')
        .update({ status: 'مسترد' })
        .eq('id', orderId);
    if (error) { alert('خطأ: ' + error.message); return; }
    alert('✅ تم تحديث الطلب كمسترد.');
    loadCompletedOrders();
};

// ==================== نسخ الكود ====================
window.copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('✅ تم نسخ الكود!'));
};

// ==================== فلتر البحث ====================
window.filterOrders = () => {
    const search = document.getElementById('orderSearch')?.value.trim().toLowerCase() || '';
    document.querySelectorAll('#completed-orders-list tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(search) ? '' : 'none';
    });
};

// ==================== إعادة تعيين الفلتر ====================
window.resetFilter = () => {
    const from = document.getElementById('date-from');
    const to   = document.getElementById('date-to');
    if (from) from.value = '';
    if (to)   to.value = '';
    loadCompletedOrders();
};

// ==================== تشغيل ====================
document.addEventListener('DOMContentLoaded', () => {
    loadCompletedOrders();
    setInterval(loadCompletedOrders, 60000);
});



(function(){
    // تطبيق الثيم المحفوظ فوراً
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    document.getElementById('theme-toggle').onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };
})();