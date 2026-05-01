import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
});

async function checkAuthState() {
    await fetchUserOrders();
    watchOrders();
}

window.handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = "index.html";
};

async function fetchUserOrders() {
    const ordersList = document.getElementById('orders-list');
    const noOrders   = document.getElementById('no-orders');
    if (!ordersList) return;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
        ordersList.style.display = 'none';
        if (noOrders) noOrders.style.display = 'block';
        return;
    }

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, products(image, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        ordersList.innerHTML = '<p style="color:red; text-align:center;">حدث خطأ أثناء تحميل الطلبات.</p>';
        return;
    }

    if (!orders || orders.length === 0) {
        ordersList.style.display = 'none';
        if (noOrders) noOrders.style.display = 'block';
        return;
    }

    ordersList.style.display = 'block';
    if (noOrders) noOrders.style.display = 'none';

    // ── تجميع بنفس order_number ──
    const groupedMap = {};
    orders.forEach(order => {
        const key = order.order_number || order.id;
        if (!groupedMap[key]) {
            groupedMap[key] = {
                order_number: order.order_number || order.id,
                created_at:   order.created_at,
                currency:     order.currency || 'MRU',
                status:       order.status,
                items:        [],
                totalPrice:   0,
            };
        }
        groupedMap[key].items.push(order);
        groupedMap[key].totalPrice += (order.price || 0) * (order.quantity || 1);

        // أولوية الحالة: قيد الانتظار أعلى
        const priority = { 'قيد الانتظار': 5, 'قيد المراجعة': 4, 'مكتمل': 3, 'مسترد': 2, 'ملغي': 1 };
        if ((priority[order.status] ?? 0) > (priority[groupedMap[key].status] ?? 0)) {
            groupedMap[key].status = order.status;
        }
    });

    const groups = Object.values(groupedMap);

    // ── عدادات الفلاتر ──
    const countAll     = groups.length;
    const countDone    = groups.filter(g => g.status === 'مكتمل').length;
    const countRefund  = groups.filter(g => g.status === 'مسترد').length;
    const countCancel  = groups.filter(g => g.status === 'ملغي').length;
    const countPending = groups.filter(g => !['مكتمل','ملغي','مسترد'].includes(g.status)).length;

    const btnAll     = document.querySelector('[onclick="setOrderFilter(\'all\', this)"]');
    const btnDone    = document.querySelector('[onclick="setOrderFilter(\'مكتمل\', this)"]');
    const btnRefund  = document.querySelector('[onclick="setOrderFilter(\'مسترد\', this)"]');
    const btnCancel  = document.querySelector('[onclick="setOrderFilter(\'ملغي\', this)"]');
    const btnPending = document.querySelector('[onclick="setOrderFilter(\'pending\', this)"]');

    if (btnAll)     btnAll.innerHTML     = `كل الحالات <span style="background:rgba(249,115,22,0.2);padding:1px 7px;border-radius:10px;font-size:11px;">${countAll}</span>`;
    if (btnDone)    btnDone.innerHTML    = `✅ مكتمل <span style="background:rgba(34,197,94,0.2);padding:1px 7px;border-radius:10px;font-size:11px;">${countDone}</span>`;
    if (btnRefund)  btnRefund.innerHTML  = `↩️ مسترد <span style="background:rgba(245,158,11,0.2);padding:1px 7px;border-radius:10px;font-size:11px;">${countRefund}</span>`;
    if (btnCancel)  btnCancel.innerHTML  = `❌ ملغي <span style="background:rgba(239,68,68,0.2);padding:1px 7px;border-radius:10px;font-size:11px;">${countCancel}</span>`;
    if (btnPending) btnPending.innerHTML = `⏳ قيد الانتظار <span style="background:rgba(148,163,184,0.2);padding:1px 7px;border-radius:10px;font-size:11px;">${countPending}</span>`;

    // ── رسم البطاقات ──
    ordersList.innerHTML = groups.map(group => {
        const first     = group.items[0];
        const date      = group.created_at ? new Date(group.created_at).toLocaleDateString('fr-FR') : '—';
        const orderNum  = group.order_number;
        const currency  = group.currency || 'MRU';
        const isSingle  = group.items.length === 1;
        const totalQty  = group.items.reduce((s, i) => s + (i.quantity || 1), 0);

        const isCompleted = group.status === 'مكتمل';
        const isCancelled = group.status === 'ملغي';
        const isRefunded  = group.status === 'مسترد';

        const statusClass = isCompleted ? 'status-completed'
                          : isCancelled ? 'status-cancelled'
                          : isRefunded  ? 'status-refunded'
                          : 'status-pending';

        const statusText = group.status || 'قيد الانتظار';
        const image      = first.products?.image || '';

        const clickAction = `window.location.href='order-details.html?id=${first.id}'`;

        // شارة عدد المنتجات — تظهر فقط إذا كان أكثر من منتج
        const multiProductBadge = !isSingle
            ? `<span style="
                display:inline-flex;align-items:center;gap:3px;
                background:rgba(59,130,246,0.12);color:#60a5fa;
                border:1px solid rgba(59,130,246,0.3);
                padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;
                margin-right:6px;">
                <i class="fas fa-layer-group" style="font-size:9px;"></i> ${group.items.length} منتجات
               </span>`
            : '';

        // سبب الرفض
        const rejectReason = group.items.find(i => i.reject_reason)?.reject_reason;
        const rejectBlock  = isCancelled && rejectReason
            ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;font-size:12px;color:#ef4444;">
                   <i class="fas fa-times-circle"></i> ${rejectReason}
               </div>` : '';

        return `
        <div class="order-card"
             data-status="${group.status || 'pending'}"
             data-order="${String(orderNum).toLowerCase()}"
             onclick="${clickAction}"
             style="cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;"
             onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 30px rgba(0,0,0,0.3)'"
             onmouseout="this.style.transform='';this.style.boxShadow=''">

            <div style="display:flex;align-items:center;gap:14px;">

                <!-- صورة المنتج الأول -->
                ${image
                    ? `<div style="flex-shrink:0;">
                           <img src="${image}" alt="${first.product_name}"
                               style="width:60px;height:60px;object-fit:contain;background:white;border-radius:10px;padding:5px;">
                       </div>`
                    : `<div style="width:60px;height:60px;background:#1e293b;border-radius:10px;
                                   display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                           <i class="fas fa-box" style="color:#475569;font-size:20px;"></i>
                       </div>`}

                <!-- معلومات الطلب -->
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:15px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${first.product_name || 'غير محدد'}
                    </div>
                    <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">
                        ${first.label ? `<span style="color:#f97316;margin-left:8px;">${first.label}</span>` : ''}
                        ${multiProductBadge}
                        Qty: ${totalQty}
                    </div>
                    <div style="font-size:12px;color:#64748b;font-family:monospace;">${orderNum}</div>
                </div>

                <!-- السعر والحالة والتاريخ -->
                <div style="text-align:left;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                    <span class="status-badge ${statusClass}" style="font-size:11px;">${statusText}</span>
                    <div style="font-size:15px;font-weight:800;color:#e2e8f0;">
                        ${group.totalPrice} ${currency}
                    </div>
                    <div style="font-size:11px;color:#64748b;">${date}</div>
                </div>

                <!-- سهم -->
                <div style="flex-shrink:0;color:#334155;font-size:14px;margin-right:4px;">
                    <i class="fas fa-chevron-left"></i>
                </div>
            </div>

            ${rejectBlock}
        </div>`;
    }).join('');
}

// ===== فلتر الطلبات =====
let currentOrderFilter = 'all';

window.setOrderFilter = (filter, btn) => {
    currentOrderFilter = filter;
    document.querySelectorAll('.order-filter-btn').forEach(b => {
        b.style.opacity    = '0.5';
        b.style.fontWeight = '600';
    });
    if (btn) { btn.style.opacity = '1'; btn.style.fontWeight = '800'; }
    filterOrders();
};

window.filterOrders = () => {
    const search = (document.getElementById('order-search')?.value || '').toLowerCase().trim();
    document.querySelectorAll('.order-card').forEach(card => {
        const status   = card.dataset.status || '';
        const orderNum = card.dataset.order  || '';
        const text     = card.innerText.toLowerCase();

        const matchSearch = !search || orderNum.includes(search) || text.includes(search);
        let matchFilter   = true;

        if (currentOrderFilter === 'pending') {
            matchFilter = !['مكتمل','ملغي','مسترد'].includes(status);
        } else if (currentOrderFilter !== 'all') {
            matchFilter = status === currentOrderFilter;
        }

        card.style.display = matchSearch && matchFilter ? '' : 'none';
    });
};

// ===== مراقبة الطلبات =====
async function watchOrders() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data: existing } = await supabase
        .from('orders').select('id').eq('user_id', user.id).eq('status', 'مكتمل');
    const notifiedIds = new Set((existing || []).map(o => o.id));

    supabase.channel('orders-watch')
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'orders',
            filter: `user_id=eq.${user.id}`
        }, (payload) => {
            const updated = payload.new;
            if (updated.status === 'مكتمل' && !notifiedIds.has(updated.id)) {
                notifiedIds.add(updated.id);
                playNotificationSound();
                showToast(`✅ طلبك "${updated.product_name}" تم بنجاح!`);
                fetchUserOrders();
            }
            if (updated.status === 'ملغي' && !notifiedIds.has('cancelled_' + updated.id)) {
                notifiedIds.add('cancelled_' + updated.id);
                showToast(`❌ تم رفض طلب "${updated.product_name}"`, '#ef4444');
                fetchUserOrders();
            }
        }).subscribe();
}

function playNotificationSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
}

function showToast(message, color = '#22c55e') {
    document.getElementById('order-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'order-toast';
    toast.style.cssText = `
        position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
        background:#1e293b; color:white; padding:16px 24px; border-radius:12px;
        border-right:4px solid ${color}; font-size:15px; font-family:'Cairo',sans-serif;
        z-index:99999; box-shadow:0 8px 30px rgba(0,0,0,0.4); cursor:pointer;
        max-width:90vw; text-align:center; animation:slideUp 0.3s ease;
    `;
    toast.textContent = message;
    toast.onclick = () => toast.remove();
    document.head.insertAdjacentHTML('beforeend', `<style>@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>`);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
}