import { supabase } from '../../js/supabase-config.js';

let allOrders = [];

async function fetchOrders() {
    const tbody = document.getElementById('completed-orders-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري تحميل سجل المبيعات...</td></tr>';

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['completed', 'مكتمل'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" style="color:red; text-align:center;">فشل جلب البيانات.</td></tr>';
        return;
    }

    allOrders = orders || [];
    renderOrders(allOrders);
}

function renderOrders(ordersList) {
    const tbody = document.getElementById('completed-orders-body');
    if (!tbody) return;

    if (ordersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد مبيعات مكتملة.</td></tr>';
        return;
    }

    tbody.innerHTML = ordersList.map(order => {
        const dateObj = new Date(order.created_at);
        const dateStr = dateObj.toLocaleDateString('en-CA');
        const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        return `
            <tr>
                <td style="font-weight:bold; color:#3498db;">#${order.id.slice(-6).toUpperCase()}</td>
                <td>${order.product_name || 'بطاقة'}</td>
                <td>${order.customer_name || 'عميل StorCards'}</td>
                <td><b style="color:#27ae60;">${order.price} MRU</b></td>
                <td><small>${dateStr}<br>${timeStr}</small></td>
                <td><span class="status-badge status-completed">مكتمل</span></td>
            </tr>
        `;
    }).join('');
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const fromDate = document.getElementById('dateFrom').value;
    const toDate = document.getElementById('dateTo').value;

    const filtered = allOrders.filter(order => {
        const matchesSearch = 
            order.id.toLowerCase().includes(searchTerm) ||
            (order.product_name || '').toLowerCase().includes(searchTerm) ||
            (order.customer_name || '').toLowerCase().includes(searchTerm);

        const orderDate = new Date(order.created_at).toLocaleDateString('en-CA');
        const matchesDateFrom = !fromDate || orderDate >= fromDate;
        const matchesDateTo = !toDate || orderDate <= toDate;

        return matchesSearch && matchesDateFrom && matchesDateTo;
    });

    renderOrders(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchOrders();

    const searchInput = document.getElementById('searchInput');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const clearBtn = document.getElementById('clearFilters');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            dateFrom.value = '';
            dateTo.value = '';
            renderOrders(allOrders);
        });
    }
});