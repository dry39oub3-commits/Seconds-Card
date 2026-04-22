import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
});



async function checkAuthState() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    fetchUserOrders();
    watchOrders(); // ← أضف هذا السطر فقط
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
        .select('*, products(image, name), refund_receipt_url')
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

    // ✅ تجميع الطلبات بنفس order_number
    const groupedMap = {};
    orders.forEach(order => {
        const key = order.order_number || order.id;
        if (!groupedMap[key]) {
            groupedMap[key] = {
                ...order,
                items:      [],
                totalPrice: 0
            };
        }
        groupedMap[key].items.push(order);
        groupedMap[key].totalPrice += (order.price || 0) * (order.quantity || 1);
    });

    const groupedOrders = Object.values(groupedMap);

    ordersList.style.display = 'block';
    if (noOrders) noOrders.style.display = 'none';

    // حساب عدد كل حالة
    const countAll     = groupedOrders.length;
    const countDone    = groupedOrders.filter(g => g.items.every(o => o.status === 'مكتمل')).length;
    const countRefund  = groupedOrders.filter(g => g.items.some(o => o.status === 'مسترد')).length;
    const countCancel  = groupedOrders.filter(g => g.items.every(o => o.status === 'ملغي')).length;
    const countPending = groupedOrders.filter(g => {
        const hasRefunded = g.items.some(o => o.status === 'مسترد');
        const allDone     = g.items.every(o => o.status === 'مكتمل');
        const allCancel   = g.items.every(o => o.status === 'ملغي');
        return !allDone && !allCancel && !hasRefunded;
    }).length;

    // تحديث النصوص على الأزرار
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
    
    ordersList.innerHTML = groupedOrders.map(group => {
        const date     = group.created_at
            ? new Date(group.created_at).toLocaleDateString('fr-FR')
            : 'تاريخ غير معروف';
        const orderNum = group.order_number || '#' + group.id.toString().substring(0, 8);
        const isMulti  = group.items.length > 1;

        // ✅ تحديد الحالة العامة للمجموعة
        const allCompleted = group.items.every(o => o.status === 'مكتمل');
        const allCancelled = group.items.every(o => o.status === 'ملغي');
        const allRefunded  = group.items.every(o => o.status === 'مسترد');
        const hasRefunded  = group.items.some(o => o.status === 'مسترد');

        const groupStatus = allCompleted ? 'مكتمل'
                          : allCancelled ? 'ملغي'
                          : allRefunded  ? 'مسترد'
                          : hasRefunded  ? 'مسترد جزئي'
                          : 'قيد الانتظار';

        const groupBadge  = allCompleted           ? 'status-completed'
                          : allCancelled           ? 'status-cancelled'
                          : (allRefunded || hasRefunded) ? 'status-refunded'
                          : 'status-pending';

        const itemsHtml = group.items.map((order, idx) => {
            const image       = order.products?.image || '';
            const isCompleted = order.status === 'مكتمل';
            const safeCode    = (order.card_code || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
            const isLast      = idx === group.items.length - 1;

            return `
            <div style="display:flex; align-items:center; gap:12px; padding:12px 0;
                ${!isLast ? 'border-bottom:1px solid rgba(255,255,255,0.06);' : ''}">
                ${image ? `<img src="${image}" alt="${order.product_name}"
                    style="width:52px;height:52px;object-fit:contain;background:white;border-radius:8px;padding:4px;flex-shrink:0;">` : ''}
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; font-size:14px;">${order.product_name || 'غير محدد'}</div>
                    ${order.label ? `<div style="font-size:12px;color:#f97316;">الفئة: ${order.label}</div>` : ''}
                    <div style="font-size:12px;color:#94a3b8;">
                        ${order.price * (order.quantity || 1)} MRU &nbsp;•&nbsp; الكمية: ${order.quantity || 1}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0;">
                    <span class="status-badge ${isCompleted ? 'status-completed' : order.status === 'ملغي' ? 'status-cancelled' : 'status-pending'}"
                        style="font-size:11px;">
                        ${order.status || 'قيد الانتظار'}
                    </span>
                    ${order.status === 'مسترد' && order.refund_receipt_url && order.refund_receipt_url !== 'null' && order.refund_receipt_url.startsWith('http') ? `
    <button onclick="showReceiptModal('${order.refund_receipt_url}')"
        style="font-size:11px; padding:5px 10px; background:#f59e0b; color:white;
               border-radius:6px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
        <i class="fas fa-receipt"></i> إيصال
    </button>` : ''}

                    ${isCompleted ? `
                        <button onclick="toggleCode('${order.id}', '${safeCode}', '${(order.product_name || '').replace(/'/g, "\\'")}')" class="copy-btn"
                            style="font-size:11px; padding:5px 10px;">
                            <i class="fas fa-key"></i> الكود
                        </button>` : ''}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="order-card">
            <div class="order-header">
                <span>
                    ${orderNum}
                
                </span>
                <span style="display:flex;align-items:center;gap:8px;">
                    <span class="status-badge ${groupBadge}" style="font-size:11px;">${groupStatus}</span>
                    ${date}
                </span>
            </div>
            <div style="padding:0 4px;">
                ${itemsHtml}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;
                padding-top:10px;margin-top:6px;border-top:1px solid rgba(255,255,255,0.07);">
                <span style="font-size:12px;color:#94a3b8;">
                    💳 ${group.paymentMethod || group.payment_method || 'غير محدد'}
                </span>
                <span style="font-weight:700;color:#f97316;font-size:15px;">
                    ${group.totalPrice} MRU
                </span>
            </div>
        </div>`;
    }).join('');
}

window.toggleCode = (orderId, cardCode, productName) => {
    document.getElementById('code-modal')?.remove();

    const codes = cardCode
        ? cardCode.replace(/\\n/g, '\n').split('\n').filter(c => c.trim() !== '')
        : [];

    const modal = document.createElement('div');
    modal.id = 'code-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.8); z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border-radius:16px; padding:28px; width:100%; max-width:480px; color:#e2e8f0; position:relative;">
            <button onclick="document.getElementById('code-modal').remove()"
                style="position:absolute; top:14px; left:14px; background:#ef4444; color:white; border:none; border-radius:8px; padding:5px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>
            <h3 style="text-align:center; color:#f97316; margin-bottom:20px;">🔑 ${productName || 'أكواد البطاقة'}</h3>
            <div style="display:flex; flex-direction:column; gap:10px; max-height:60vh; overflow-y:auto;">
                ${codes.length > 0 ? codes.map((code, i) => `
                    <div style="background:#0f172a; border-radius:10px; padding:14px 16px; display:flex; align-items:center; gap:10px;">
                        <span style="color:#94a3b8; font-size:13px; min-width:24px;">${i + 1})</span>
                        <span style="font-family:monospace; font-size:15px; color:#f97316; font-weight:bold; flex:1; text-align:center; word-break:break-all;">${code}</span>
                        <button onclick="copyCode('${code.replace(/'/g, "\\'")}')"
                            style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; flex-shrink:0;">
                            <i class="fas fa-copy"></i> نسخ
                        </button>
                    </div>
                `).join('') : `<p style="text-align:center; color:#64748b;">جاري المعالجة...</p>`}
            </div>
            ${codes.length > 1 ? `
                <button onclick="copyAllCodes('${codes.join('\\n').replace(/'/g, "\\'")}')"
                    style="width:100%; margin-top:16px; padding:12px; background:#f97316; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold; font-size:14px;">
                    <i class="fas fa-copy"></i> نسخ جميع الأكواد
                </button>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);
};

window.copyAllCodes = (codes) => {
    navigator.clipboard.writeText(codes).then(() => alert('✅ تم نسخ جميع الأكواد!'));
};

window.copyCode = (code) => {
    if (!code || code === 'undefined' || code === '') {
        alert('الكود غير متوفر بعد، يرجى الانتظار.');
        return;
    }
    navigator.clipboard.writeText(code).then(() => alert("✅ تم نسخ الكود بنجاح!"));
};



// ==================== إشعار صوتي ====================
function playNotificationSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    const notes = [523, 659, 784, 1047]; // Do Mi Sol Do
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
}

// ==================== مراقبة حالة الطلبات ====================
async function watchOrders() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // جلب الطلبات المكتملة الحالية لتجنب إشعار القديمة
    const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'مكتمل');

    const notifiedIds = new Set((existing || []).map(o => o.id));

    // الاشتراك في التغييرات
    supabase
        .channel('orders-watch')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
        }, (payload) => {
            const updated = payload.new;

            // إشعار فقط للطلبات المكتملة الجديدة
            if (updated.status === 'مكتمل' && !notifiedIds.has(updated.id)) {
                notifiedIds.add(updated.id);
                playNotificationSound();
                showToast(`✅ طلبك "${updated.product_name}" تم بنجاح! اضغط لعرض الكود`);
                fetchUserOrders(); // تحديث القائمة
            }

            // إشعار الرفض
            if (updated.status === 'ملغي' && !notifiedIds.has('cancelled_' + updated.id)) {
                notifiedIds.add('cancelled_' + updated.id);
                showToast(`❌ تم رفض طلب "${updated.product_name}"`, '#ef4444');
                fetchUserOrders();
            }
        })
        .subscribe();
}

// ==================== Toast إشعار ====================
function showToast(message, color = '#22c55e') {
    document.getElementById('order-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'order-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        border-right: 4px solid ${color};
        font-size: 15px;
        font-family: 'Cairo', sans-serif;
        z-index: 99999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        cursor: pointer;
        max-width: 90vw;
        text-align: center;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    toast.onclick = () => toast.remove();

    // CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 6000);
}


// ===== فلتر الطلبات =====
let currentOrderFilter = 'all';

window.setOrderFilter = (filter, btn) => {
    currentOrderFilter = filter;

    // تحديث الأزرار
    document.querySelectorAll('.order-filter-btn').forEach(b => {
        b.style.opacity = '0.5';
        b.style.fontWeight = '600';
    });
    if (btn) {
        btn.style.opacity = '1';
        btn.style.fontWeight = '800';
    }

    filterOrders();
};

window.filterOrders = () => {
    const search = (document.getElementById('order-search')?.value || '').toLowerCase().trim();
    const cards  = document.querySelectorAll('.order-card');

    cards.forEach(card => {
        const text        = card.innerText.toLowerCase();
        const orderNum    = card.querySelector('.order-header span')?.innerText?.toLowerCase() || '';
        const matchSearch = !search || orderNum.includes(search) || text.includes(search);

        let matchFilter = true;
        if (currentOrderFilter === 'pending') {
            // قيد الانتظار = ليس مكتمل ولا ملغي ولا مسترد
            matchFilter = text.includes('قيد الانتظار') || text.includes('قيد المراجعة');
            // استبعاد المسترد من قيد الانتظار
            if (text.includes('مسترد')) matchFilter = false;
        } else if (currentOrderFilter !== 'all') {
            matchFilter = text.includes(currentOrderFilter);
        }

        card.style.display = matchSearch && matchFilter ? '' : 'none';
    });
};

window.showReceiptModal = (url) => {
    document.getElementById('receipt-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'receipt-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.9);
        z-index:99999; display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box;
    `;
    modal.innerHTML = `
        <div style="position:relative; max-width:500px; width:100%;">
            <button onclick="document.getElementById('receipt-modal').remove()"
                style="position:absolute; top:-40px; left:0; background:#ef4444; color:white;
                       border:none; border-radius:8px; padding:6px 14px; cursor:pointer; font-size:14px;">
                ✕ إغلاق
            </button>
            <img src="${url}" style="width:100%; border-radius:12px; display:block;">
        </div>
    `;
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
};