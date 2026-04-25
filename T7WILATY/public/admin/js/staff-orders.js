import { supabase } from '../../js/supabase-config.js';

let allOrders = [];

// ==================== تهيئة ====================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const nameEl = document.getElementById('staff-name-display');
        if (nameEl && window.STAFF_NAME) nameEl.textContent = window.STAFF_NAME;

        // إظهار/إخفاء الأقسام حسب الصلاحيات
        applyPermissionsUI();
    }, 400);

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('staff_name');
        localStorage.removeItem('staff_id');
        window.location.href = 'staff-login.html';
    });

    loadOrders();
});

// ==================== تطبيق الصلاحيات على الواجهة ====================
function applyPermissionsUI() {
    // إخفاء قسم الطلبات المكتملة إذا لم يكن عنده صلاحية
    const completedLink = document.getElementById('link-completed');
    if (completedLink) {
        completedLink.style.display = window.hasPerm?.('view_completed') ? '' : 'none';
    }

    // إخفاء قسم المخزون
    const stockLink = document.getElementById('link-stock');
    if (stockLink) {
        stockLink.style.display = window.hasPerm?.('manage_stock') ? '' : 'none';
    }
}

// ==================== تحميل الطلبات ====================
async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    // التحقق من صلاحية عرض الطلبات
    if (window.hasPerm && !window.hasPerm('approve_orders') && !window.hasPerm('refund_orders')) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div style="text-align:center;padding:60px;color:#ef4444;">
                    <i class="fas fa-lock" style="font-size:36px;margin-bottom:14px;display:block;opacity:0.5;"></i>
                    <p>ليس لديك صلاحية عرض الطلبات</p>
                </div>
            </td></tr>`;
        return;
    }

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*, products(image)')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")')
        .order('created_at', { ascending: false });

    if (error || !orders?.length) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div style="text-align:center;padding:60px;color:#475569;">
                    <i class="fas fa-inbox" style="font-size:36px;margin-bottom:14px;display:block;opacity:0.3;"></i>
                    <p>لا توجد طلبات حالياً</p>
                </div>
            </td></tr>`;
        document.getElementById('orders-count').textContent = '0';
        return;
    }

    // تجميع حسب order_number
    const groupedMap = {};
    orders.forEach(o => {
        const key = o.order_number || o.id;
        if (!groupedMap[key]) {
            groupedMap[key] = { ...o, items: [], totalPrice: 0 };
        }
        groupedMap[key].items.push(o);
        groupedMap[key].totalPrice += (o.price || 0) * (o.quantity || 1);
    });

    allOrders = Object.values(groupedMap);
    document.getElementById('orders-count').textContent = allOrders.length;
    renderOrders(allOrders);
}

// ==================== عرض الطلبات ====================
function renderOrders(list) {
    const tbody = document.getElementById('orders-tbody');

    if (!list.length) {
        tbody.innerHTML = `
            <tr><td colspan="8">
                <div style="text-align:center;padding:60px;color:#475569;">
                    <i class="fas fa-inbox" style="font-size:36px;margin-bottom:14px;display:block;opacity:0.3;"></i>
                    <p>لا توجد طلبات</p>
                </div>
            </td></tr>`;
        return;
    }

    const canApprove = !window.hasPerm || window.hasPerm('approve_orders');
    const canRefund  = !window.hasPerm || window.hasPerm('refund_orders');

    tbody.innerHTML = list.map(group => {
        const isSingle = group.items.length === 1;
        const date = new Date(group.created_at).toLocaleString('fr-FR', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit'
        });
        const pm = group.paymentMethod || group.payment_method || '—';

        const productsCell = isSingle
            ? `<div style="font-weight:600;color:#e2e8f0;">${group.items[0].product_name || '—'}</div>
               <div style="font-size:11px;color:#f97316;">${group.items[0].label || ''}</div>`
            : group.items.map(i => `
                <div style="font-size:12px;color:#e2e8f0;margin-bottom:2px;">
                    ${i.product_name || '—'}
                    ${i.label ? `<span style="color:#f97316;">(${i.label})</span>` : ''}
                    <span style="color:#64748b;">× ${i.quantity||1}</span>
                </div>`).join('');

        const totalQty = group.items.reduce((s,o) => s + (o.quantity||1), 0);

        // أزرار حسب الصلاحيات
        let actionBtns = '';

        if (isSingle) {
            if (canApprove) {
                actionBtns += `
                    <button class="btn-action btn-green"
                        onclick="openApproveModal('${group.items[0].id}', ${group.items[0].quantity||1})">
                        <i class="fas fa-check-circle"></i> قبول
                    </button>`;
            }
            if (canRefund) {
                actionBtns += `
                    <button class="btn-action btn-orange"
                        onclick="openRefundConfirm('${group.items[0].id}', '${group.paymentMethod || group.payment_method || ''}')">
                        <i class="fas fa-undo"></i> استرداد
                    </button>`;
            }
        } else {
            if (canApprove) {
                actionBtns += `
                    <button class="btn-action btn-blue"
                        onclick="openGroupApproveModal('${group.order_number}')">
                        <i class="fas fa-layer-group"></i> قبول (${group.items.length})
                    </button>`;
            }
            if (canRefund) {
                actionBtns += `
                    <button class="btn-action btn-orange"
                        onclick="openRefundConfirm('${group.items.map(i=>i.id).join(',')}', '${group.paymentMethod || group.payment_method || ''}', true)">
                        <i class="fas fa-undo"></i> استرداد
                    </button>`;
            }
        }

        if (!actionBtns) {
            actionBtns = `<span style="font-size:12px;color:#475569;">لا صلاحية</span>`;
        }

        return `
            <tr data-search="${(group.order_number+' '+(group.customer_name||'')+' '+group.items.map(i=>i.product_name||'').join(' ')).toLowerCase()}">
                <td style="color:#f97316;font-weight:700;font-family:monospace;">
                    ${group.order_number || '#'+group.id.substring(0,7)}
                </td>
                <td>
                    <div style="font-weight:600;">${group.customer_name || '—'}</div>
                    <div style="font-size:11px;color:#64748b;">${group.customer_phone || ''}</div>
                </td>
                <td>${productsCell}</td>
                <td style="color:#22c55e;font-weight:700;">${group.totalPrice} MRU</td>
                <td style="text-align:center;">${totalQty}</td>
                <td>
                    <span style="background:#1e293b;color:#94a3b8;border:1px solid #334155;
                                 padding:3px 10px;border-radius:20px;font-size:11px;">
                        ${pm}
                    </span>
                </td>
                <td style="font-size:12px;color:#64748b;">${date}</td>
                <td>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        ${actionBtns}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

// ==================== فلتر ====================
window.filterTable = () => {
    const q = document.getElementById('search-input').value.toLowerCase().trim();
    document.querySelectorAll('#orders-tbody tr[data-search]').forEach(row => {
        row.style.display = row.dataset.search.includes(q) ? '' : 'none';
    });
};

// ==================== Modal قبول طلب ====================
window.openApproveModal = (orderId, quantity) => {
    if (!window.hasPerm?.('approve_orders') && window.hasPerm) {
        showToast('❌ ليس لديك صلاحية قبول الطلبات'); return;
    }
    document.getElementById('staff-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'staff-modal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;`;

    modal.innerHTML = `
        <div style="background:#1e293b;border-radius:16px;padding:28px;width:100%;max-width:460px;
                    color:#e2e8f0;margin:auto;border:1px solid #334155;position:relative;">
            <button onclick="document.getElementById('staff-modal').remove()"
                style="position:absolute;top:14px;left:14px;background:#ef4444;color:white;
                       border:none;border-radius:8px;padding:5px 12px;cursor:pointer;">✕</button>
            <h3 style="text-align:center;color:#22c55e;margin-bottom:20px;">
                <i class="fas fa-check-circle"></i> تأكيد إتمام الطلب
            </h3>
            <div style="background:#0f172a;border-radius:10px;padding:12px;margin-bottom:16px;
                        border:1px solid #1e2d42;text-align:center;font-size:13px;color:#94a3b8;">
                <i class="fas fa-user-hard-hat" style="color:#3b82f6;margin-left:6px;"></i>
                سيُسجَّل باسمك:
                <strong style="color:#60a5fa;display:block;margin-top:4px;font-size:15px;">
                    ${window.STAFF_NAME || 'العامل'}
                </strong>
            </div>
            <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:6px;">
                🔑 أكواد البطاقة (${quantity} كود) — كود في كل سطر
            </label>
            <textarea id="staff-code-input" rows="${Math.max(3,quantity)}"
                placeholder="كود 1&#10;كود 2&#10;كود 3..."
                style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;
                       border-radius:8px;color:#e2e8f0;font-size:13px;font-family:monospace;
                       resize:vertical;outline:none;margin-bottom:14px;box-sizing:border-box;
                       line-height:1.8;"></textarea>
            <button onclick="confirmApprove('${orderId}', ${quantity})"
                style="width:100%;padding:13px;background:linear-gradient(135deg,#22c55e,#16a34a);
                       color:white;border:none;border-radius:10px;font-size:15px;font-weight:800;
                       cursor:pointer;font-family:'Tajawal',sans-serif;
                       box-shadow:0 4px 14px rgba(34,197,94,0.35);">
                <i class="fas fa-check-double"></i> تأكيد الإتمام
            </button>
        </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    setTimeout(() => document.getElementById('staff-code-input')?.focus(), 100);
};

window.confirmApprove = async (orderId, quantity) => {
    const codesRaw = document.getElementById('staff-code-input')?.value.trim() || '';
    const codes    = codesRaw.split('\n').map(c => c.trim()).filter(c => c);

    if (!codes.length)            { showToast('⚠️ أدخل كود البطاقة'); return; }
    if (codes.length !== quantity){ showToast(`⚠️ عدد الأكواد (${codes.length}) لا يطابق الكمية (${quantity})`); return; }

    for (const c of codes) {
        const { data: ex } = await supabase.from('used_codes').select('id').eq('code', c).maybeSingle();
        if (ex) { showToast(`⚠️ الكود "${c}" مستخدم بالفعل!`); return; }
    }

    const staffName = window.STAFF_NAME || 'عامل';
    const staffId   = window.STAFF_ID   || null;

    const { error } = await supabase.from('orders').update({
        status:            'مكتمل',
        card_code:         codes.join('\n'),
        completed_by_name: staffName,
        completed_by_id:   staffId,
    }).eq('id', orderId);

    if (error) { showToast('❌ ' + error.message); return; }

    for (const c of codes) {
        await supabase.from('used_codes').insert({ code: c, order_id: orderId });
    }

    document.getElementById('staff-modal')?.remove();
    showToast(`✅ تم إتمام الطلب — ${staffName}`);
    loadOrders();
};

// ==================== Modal قبول مجموعة ====================
window.openGroupApproveModal = (orderNumber) => {
    if (!window.hasPerm?.('approve_orders') && window.hasPerm) {
        showToast('❌ ليس لديك صلاحية قبول الطلبات'); return;
    }
    const group = allOrders.find(g => g.order_number === orderNumber);
    if (!group) return;

    document.getElementById('staff-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'staff-modal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;
        display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;`;

    modal.innerHTML = `
        <div style="background:#1e293b;border-radius:16px;padding:28px;width:100%;max-width:520px;
                    color:#e2e8f0;margin:auto;border:1px solid #334155;position:relative;">
            <button onclick="document.getElementById('staff-modal').remove()"
                style="position:absolute;top:14px;left:14px;background:#ef4444;color:white;
                       border:none;border-radius:8px;padding:5px 12px;cursor:pointer;">✕</button>
            <h3 style="text-align:center;color:#3b82f6;margin-bottom:20px;">
                <i class="fas fa-layer-group"></i> قبول مجموعة (${group.items.length})
            </h3>
            <div style="background:#0f172a;border-radius:10px;padding:12px;margin-bottom:16px;
                        border:1px solid #1e2d42;text-align:center;font-size:13px;color:#94a3b8;">
                سيُسجَّل باسمك: <strong style="color:#60a5fa;">${window.STAFF_NAME || 'العامل'}</strong>
            </div>
            ${group.items.map((item, idx) => `
                <div style="background:#0f172a;border-radius:10px;padding:14px;margin-bottom:12px;border:1px solid #1e2d42;">
                    <div style="font-weight:700;color:#f97316;margin-bottom:8px;">
                        ${item.product_name || '—'} ${item.label ? `(${item.label})` : ''} × ${item.quantity||1}
                    </div>
                    <label style="font-size:12px;color:#94a3b8;display:block;margin-bottom:5px;">
                        🔑 الأكواد (${item.quantity||1})
                    </label>
                    <textarea id="group-code-${idx}" rows="${Math.max(2,item.quantity||1)}"
                        placeholder="كود 1&#10;كود 2..."
                        style="width:100%;padding:9px;background:#1e293b;border:1px solid #334155;
                               border-radius:7px;color:#e2e8f0;font-size:12px;font-family:monospace;
                               resize:vertical;outline:none;box-sizing:border-box;line-height:1.8;"></textarea>
                </div>`).join('')}
            <button onclick="confirmGroupApprove('${orderNumber}')"
                style="width:100%;padding:13px;background:linear-gradient(135deg,#22c55e,#16a34a);
                       color:white;border:none;border-radius:10px;font-size:15px;font-weight:800;
                       cursor:pointer;font-family:'Tajawal',sans-serif;">
                <i class="fas fa-check-double"></i> تأكيد إتمام المجموعة
            </button>
        </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window.confirmGroupApprove = async (orderNumber) => {
    const group     = allOrders.find(g => g.order_number === orderNumber);
    if (!group) return;
    const staffName = window.STAFF_NAME || 'عامل';
    const staffId   = window.STAFF_ID   || null;

    for (let i = 0; i < group.items.length; i++) {
        const item  = group.items[i];
        const codes = (document.getElementById(`group-code-${i}`)?.value.trim() || '')
            .split('\n').map(c => c.trim()).filter(c => c);
        const qty = item.quantity || 1;
        if (!codes.length)        { showToast(`⚠️ الطلب ${i+1}: أدخل الأكواد`); return; }
        if (codes.length !== qty) { showToast(`⚠️ الطلب ${i+1}: عدد الأكواد لا يطابق الكمية`); return; }
        for (const c of codes) {
            const { data: ex } = await supabase.from('used_codes').select('id').eq('code', c).maybeSingle();
            if (ex) { showToast(`⚠️ الكود "${c}" مستخدم!`); return; }
        }
    }

    for (let i = 0; i < group.items.length; i++) {
        const item  = group.items[i];
        const codes = document.getElementById(`group-code-${i}`).value.trim()
            .split('\n').map(c => c.trim()).filter(c => c);
        await supabase.from('orders').update({
            status:            'مكتمل',
            card_code:         codes.join('\n'),
            completed_by_name: staffName,
            completed_by_id:   staffId,
        }).eq('id', item.id);
        for (const c of codes) {
            await supabase.from('used_codes').insert({ code: c, order_id: item.id });
        }
    }

    document.getElementById('staff-modal')?.remove();
    showToast(`✅ تم إتمام ${group.items.length} طلب — ${staffName}`);
    loadOrders();
};

// ==================== Confirm استرداد ====================
window.openRefundConfirm = (ids, pm, isGroup = false) => {
    if (!window.hasPerm?.('refund_orders') && window.hasPerm) {
        showToast('❌ ليس لديك صلاحية الاسترداد'); return;
    }
    const idList = isGroup ? ids.split(',') : [ids];
    if (!confirm(`هل تريد استرداد ${idList.length > 1 ? idList.length + ' طلبات' : 'هذا الطلب'}؟`)) return;
    executeRefund(idList, pm);
};

async function executeRefund(ids, pm) {
    for (const id of ids) {
        await supabase.from('orders').update({ status: 'مسترد' }).eq('id', id);
    }
    showToast(`✅ تم استرداد ${ids.length} طلب`);
    loadOrders();
}

// ==================== Realtime ====================
supabase.channel('staff-orders-rt')
    .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, loadOrders)
    .subscribe();

// ==================== Toast ====================
function showToast(msg) {
    document.getElementById('_st')?.remove();
    const t = document.createElement('div');
    t.id = '_st'; t.textContent = msg;
    t.style.cssText = `
        position:fixed;top:20px;left:50%;transform:translateX(-50%);
        background:#1e293b;color:white;border:1px solid #334155;
        padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;
        z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.4);
        font-family:'Tajawal',sans-serif;white-space:nowrap;`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}