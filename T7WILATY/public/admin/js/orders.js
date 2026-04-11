import { supabase } from '../../js/supabase-config.js';

// 1. جلب وعرض الطلبات
async function loadOrders() {
    const ordersList = document.getElementById('admin-orders-list');
    if (!ordersList) return;

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('timestamp', { ascending: false });

    if (error) {
        ordersList.innerHTML = '<tr><td colspan="7" style="text-align:center;">❌ خطأ في جلب الطلبات</td></tr>';
        return;
    }

    if (!orders || orders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="7" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>';
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const date = order.timestamp ? new Date(order.timestamp).toLocaleString('ar-EG') : 'غير محدد';
        const status = order.status || 'قيد الانتظار';
        const receiptBtn = order.receiptUrl ? 
            `<a href="${order.receiptUrl}" target="_blank" class="btn-check" title="عرض الإيصال"><i class="fas fa-receipt"></i></a>` : '';

        return `
            <tr id="order-row-${order.id}">
                <td>#${order.id.substring(0, 7)}</td>
                <td>${order.userId?.substring(0, 8) || 'غير معروف'}</td>
                <td>${order.cardName}</td>
                <td><strong>${order.price} MRU</strong></td>
                <td><small>${date}</small></td>
                <td>
                    <span class="status-badge ${getStatusClass(status)}">
                        ${status}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        ${receiptBtn}
                        <button onclick="updateOrderStatus('${order.id}', 'مكتمل')" class="btn-check" title="اعتماد كطلب ناجح">
                            <i class="fas fa-check-circle"></i>
                        </button>
                        <button onclick="deleteOrder('${order.id}')" class="btn-delete" title="حذف الطلب">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusClass(status) {
    if (status === 'مكتمل') return 'status-completed';
    if (status === 'ملغي') return 'status-cancelled';
    return 'status-pending';
}

window.updateOrderStatus = async (orderId, newStatus) => {
    const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

    if (error) {
        alert('⚠️ فشل تحديث الحالة: ' + error.message);
    } else {
        loadOrders();
    }
};

window.deleteOrder = async (orderId) => {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الطلب؟')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
        alert('⚠️ خطأ في الحذف: ' + error.message);
    } else {
        loadOrders();
    }
};

window.filterOrders = () => {
    const search = document.getElementById('orderSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#admin-orders-list tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
    });
};

loadOrders();