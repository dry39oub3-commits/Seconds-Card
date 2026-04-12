import { supabase } from '../../js/supabase-config.js';

let allCompleted = [];
let allRejected = [];
let allRefunded = [];

async function fetchAllOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['مكتمل', 'ملغي', 'مسترد'])
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    allCompleted = orders.filter(o => o.status === 'مكتمل');
    allRejected  = orders.filter(o => o.status === 'ملغي');
    allRefunded  = orders.filter(o => o.status === 'مسترد');

    renderCompleted(allCompleted);
    renderRejected(allRejected);
    renderRefunded(allRefunded);
}

function renderCompleted(list) {
    const tbody = document.getElementById('completed-orders-body');
    const count = document.getElementById('completed-count');
    if (count) count.textContent = list.length;
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">لا توجد طلبات مكتملة</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(order => {
        const date = new Date(order.created_at).toLocaleString('ar-EG');
        const receiptBtn = order.receipt_url ?
            `<a href="${order.receipt_url}" target="_blank" style="color:#3b82f6;"><i class="fas fa-receipt"></i></a>` : '-';
        return `
            <tr>
                <td style="color:#3b82f6; font-weight:bold;">#${order.id.slice(-6).toUpperCase()}</td>
                <td>${order.customer_name || '-'}</td>
                <td>${order.product_name || '-'}</td>
                <td><b style="color:#22c55e;">${order.price} MRU</b></td>
                <td>${order.quantity || 1}</td>
                <td><small>${date}</small></td>
                <td>${order.payment_method || '-'}</td>
                <td>${receiptBtn}</td>
                <td>${order.supplier_id || '-'}</td>
                <td>
                    <button onclick="markRefunded('${order.id}')" 
                        style="background:#f97316; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px;">
                        <i class="fas fa-undo"></i> استرداد
                    </button>
                </td>
            </tr>`;
    }).join('');
}

function renderRejected(list) {
    const tbody = document.getElementById('rejected-orders-body');
    const count = document.getElementById('rejected-count');
    if (count) count.textContent = list.length;
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">لا توجد طلبات مرفوضة</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(order => {
        const date = new Date(order.created_at).toLocaleString('ar-EG');
        return `
            <tr>
                <td style="color:#ef4444; font-weight:bold;">#${order.id.slice(-6).toUpperCase()}</td>
                <td>${order.customer_name || '-'}</td>
                <td>${order.product_name || '-'}</td>
                <td><b>${order.price} MRU</b></td>
                <td><small>${date}</small></td>
                <td style="color:#ef4444;">${order.reject_reason || '-'}</td>
                <td>
                    <button onclick="deleteOrder('${order.id}')"
                        style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px;">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>`;
    }).join('');
}

function renderRefunded(list) {
    const tbody = document.getElementById('refunded-orders-body');
    const count = document.getElementById('refunded-count');
    if (count) count.textContent = list.length;
    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">لا توجد طلبات مستردة</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(order => {
        const date = new Date(order.created_at).toLocaleString('ar-EG');
        return `
            <tr>
                <td style="color:#f97316; font-weight:bold;">#${order.id.slice(-6).toUpperCase()}</td>
                <td>${order.customer_name || '-'}</td>
                <td>${order.product_name || '-'}</td>
                <td><b style="color:#f97316;">${order.price} MRU</b></td>
                <td><small>${date}</small></td>
                <td>${order.reject_reason || '-'}</td>
                <td>
                    <button onclick="deleteOrder('${order.id}')"
                        style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px;">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>`;
    }).join('');
}

window.markRefunded = async (orderId) => {
    const note = prompt('أدخل ملاحظة الاسترداد (اختياري):') || '';
    if (!confirm('هل تريد تحويل هذا الطلب إلى مسترد؟')) return;

    const { error } = await supabase
        .from('orders')
        .update({ status: 'مسترد', reject_reason: note })
        .eq('id', orderId);

    if (error) alert('خطأ: ' + error.message);
    else fetchAllOrders();
};

window.deleteOrder = async (orderId) => {
    if (!confirm('هل تريد حذف هذا الطلب نهائياً؟')) return;
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) alert('خطأ: ' + error.message);
    else fetchAllOrders();
};

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const fromDate = document.getElementById('dateFrom').value;
    const toDate = document.getElementById('dateTo').value;

    const filter = (list) => list.filter(order => {
        const matchSearch =
            order.id.toLowerCase().includes(search) ||
            (order.product_name || '').toLowerCase().includes(search) ||
            (order.customer_name || '').toLowerCase().includes(search);
        const orderDate = new Date(order.created_at).toLocaleDateString('en-CA');
        const matchFrom = !fromDate || orderDate >= fromDate;
        const matchTo = !toDate || orderDate <= toDate;
        return matchSearch && matchFrom && matchTo;
    });

    renderCompleted(filter(allCompleted));
    renderRejected(filter(allRejected));
    renderRefunded(filter(allRefunded));
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAllOrders();

    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('dateFrom')?.addEventListener('change', applyFilters);
    document.getElementById('dateTo')?.addEventListener('change', applyFilters);
    document.getElementById('clearFilters')?.addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        renderCompleted(allCompleted);
        renderRejected(allRejected);
        renderRefunded(allRefunded);
    });
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