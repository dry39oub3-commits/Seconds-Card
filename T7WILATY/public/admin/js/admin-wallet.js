import { supabase } from '../../js/supabase-config.js';

let allTransactions = [];
let allUsers = [];
let currentEditUserId = null;
let activeTab = 'pending';
let rejectTxId = null;

// ==================== SC-ID ====================
function generateSCId(uuid) {
    const hash = uuid.replace(/-/g, '');
    let num = 0;
    for (let i = 0; i < hash.length; i++) {
        num = (num * 31 + hash.charCodeAt(i)) % 900000;
    }
    return `SC-${String(num + 100000).padStart(6, '0')}`;
}

// ==================== LOAD ALL ====================
async function loadAll() {
    await Promise.all([loadTransactions(), loadUsers()]);
    updateStats();
    renderUsers(allUsers)
}

async function loadTransactions() {
    const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }
    allTransactions = data || [];
    renderAll();
}

async function loadUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('id, email, balance, full_name, avatar_url')
        .order('balance', { ascending: false });

    if (error) { console.error(error); return; }
    allUsers = data || [];
    renderUsers(allUsers);
}

function updateStats() {
    const pending          = allTransactions.filter(t => t.status === 'قيد المراجعة');
    const charges          = allTransactions.filter(t => t.type === 'charge'   && t.status === 'مكتمل');
    const withdraws        = allTransactions.filter(t => t.type === 'withdraw' && t.status === 'مكتمل');
    const usersWithBalance = allUsers.filter(u => u.balance > 0);

    document.getElementById('stat-pending').textContent        = pending.length;
    document.getElementById('stat-total-charge').textContent   = charges.reduce((s, t) => s + t.amount, 0);
    document.getElementById('stat-total-withdraw').textContent = withdraws.reduce((s, t) => s + t.amount, 0);
    document.getElementById('stat-users').textContent          = usersWithBalance.length;
    document.getElementById('pending-count').textContent       = pending.length;
}

// ==================== RENDER TRANSACTIONS ====================
function renderAll() {
    const search       = document.getElementById('search-input')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || '';

    const filtered = allTransactions.filter(t => {
        const matchSearch = t.user_id?.toLowerCase().includes(search) ||
            (t.payment_method || '').toLowerCase().includes(search);
        const matchStatus = !statusFilter || t.status === statusFilter;
        return matchSearch && matchStatus;
    });

    renderList('pending-list',  filtered.filter(t => t.status === 'قيد المراجعة'));
    renderList('charge-list',   filtered.filter(t => t.type === 'charge'));
    renderList('withdraw-list', filtered.filter(t => t.type === 'withdraw'));
}

function renderList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px;">لا توجد بيانات</p>';
        return;
    }

    container.innerHTML = list.map(tx => {
        const isCharge   = tx.type === 'charge';
        const date       = new Date(tx.created_at).toLocaleString('fr-FR');
        const isPending  = tx.status === 'قيد المراجعة';
        const isRejected = tx.status === 'مرفوض';
        const scId       = tx.user_id ? generateSCId(tx.user_id) : '---';

        const user      = allUsers.find(u => u.id === tx.user_id);
        const userName  = user?.full_name || user?.fullName || 'مستخدم';
        const userEmail = user?.email || '';
        const userAvatar = user?.avatar_url || '';

        return `
        <div class="tx-card">
            <div style="flex-shrink:0;">
                ${userAvatar
                    ? `<img src="${userAvatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #334155;">`
                    : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;color:#f97316;font-size:18px;"><i class="fas fa-user"></i></div>`
                }
            </div>

            <div class="tx-icon ${isCharge ? 'charge' : 'withdraw'}">
                <i class="fas fa-arrow-${isCharge ? 'up' : 'down'}"></i>
            </div>

            <div class="tx-info" style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                    <span style="font-weight:700; color:#f1f5f9; font-size:14px;">${userName}</span>
                    <span style="font-size:11px; color:#94a3b8; background:#0f172a; padding:2px 7px; border-radius:5px;">${userEmail}</span>
                </div>

                <h4 style="margin:0 0 4px; font-size:13px;">${isCharge ? 'شحن رصيد' : 'سحب رصيد'} • ${tx.payment_method || '-'}</h4>

                <p style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 4px;">
                    <span onclick="openUserOrders('${tx.user_id}')"
                          style="font-family:monospace; color:#f97316; font-size:12px;
                                 background:rgba(249,115,22,0.1); padding:2px 6px; border-radius:5px; cursor:pointer;"
                          title="انقر لعرض طلبات العميل">
                        ${scId}
                    </span>
                    <span style="color:#64748b; font-size:12px;">• ${date}</span>
                </p>

                ${tx.withdraw_account ? `
                    <p style="font-size:13px; margin:0 0 4px;">
                        حساب الاستلام: <strong style="color:#e2e8f0;">${tx.withdraw_account}</strong>
                    </p>
                ` : ''}

                <span class="status-badge status-${tx.status === 'مكتمل' ? 'completed' : tx.status === 'مرفوض' ? 'rejected' : 'pending'}">
                    ${tx.status}
                </span>

                ${isRejected && tx.reject_reason ? `
                    <div style="margin-top:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);
                                border-radius:8px; padding:8px 12px; font-size:13px; color:#fca5a5;">
                        <i class="fas fa-exclamation-circle"></i> سبب الرفض: ${tx.reject_reason}
                    </div>
                ` : ''}
            </div>

            <div class="tx-amount ${isCharge ? 'credit' : 'debit'}" style="flex-shrink:0;">
                ${isCharge ? '+' : '-'}${tx.amount} MRU
            </div>

            ${tx.receipt_url ? `
                <img src="${tx.receipt_url}" class="receipt-img" onclick="viewReceipt('${tx.receipt_url}')"
                     style="cursor:pointer;">
            ` : ''}

            ${isPending ? `
                <div class="tx-actions" style="flex-shrink:0;">
                    <button class="btn-approve"
                            onclick="approveTransaction('${tx.id}', '${tx.user_id}', ${tx.amount}, '${tx.type}')">
                        <i class="fas fa-check"></i> قبول
                    </button>
                    <button class="btn-reject" onclick="openRejectModal('${tx.id}')">
                        <i class="fas fa-times"></i> رفض
                    </button>
                </div>
            ` : ''}
        </div>`;
    }).join('');
}

// ==================== RENDER USERS ====================
function renderUsers(list) {
    const container = document.getElementById('users-list');
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px;">لا توجد بيانات</p>';
        return;
    }

    container.innerHTML = list.map(user => {
        const scId       = generateSCId(user.id);
        const name       = user.full_name || user.fullName || user.email || 'مستخدم';
        const userAvatar = user.avatar_url || '';

        const lastEdit = allTransactions
            .filter(t => t.user_id === user.id && t.payment_method === 'تعديل أدمن')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

        return `
        <div class="tx-card">
            ${userAvatar
                ? `<img src="${userAvatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #334155;flex-shrink:0;">`
                : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;color:#f97316;font-size:18px;flex-shrink:0;"><i class="fas fa-user"></i></div>`
            }

            <div class="tx-info" style="flex:1; min-width:0;">
                <h4 style="margin:0 0 2px;">${name}</h4>
                <p style="font-size:12px; color:#94a3b8; margin:0 0 4px;">${user.email || ''}</p>

                <span onclick="openUserOrders('${user.id}')"
                      style="font-family:monospace; font-size:12px; color:#f97316;
                             background:rgba(249,115,22,0.1); padding:2px 7px;
                             border-radius:5px; border:1px solid rgba(249,115,22,0.2);
                             cursor:pointer; display:inline-block;"
                      title="انقر لعرض طلبات العميل">
                    ${scId} <i class="fas fa-external-link-alt" style="font-size:10px;"></i>
                </span>

                ${lastEdit?.note ? `
                    <div style="margin-top:6px; font-size:12px; color:#94a3b8;">
                        <i class="fas fa-pen" style="color:#f97316; font-size:10px;"></i>
                        آخر تعديل: <span style="color:#cbd5e1;">${lastEdit.note}</span>
                        <span style="color:#475569;"> • ${new Date(lastEdit.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                ` : ''}
            </div>

            <div class="tx-amount" style="color:#f97316; flex-shrink:0;">
                ${user.balance || 0} MRU
            </div>

            <button onclick="openEditModal('${user.id}', ${user.balance || 0})"
                style="background:#334155; color:white; border:none; padding:8px 14px;
                       border-radius:8px; cursor:pointer; font-size:13px; flex-shrink:0;">
                <i class="fas fa-edit"></i> تعديل
            </button>
        </div>`;
    }).join('');
}

// ==================== USERS FILTER ====================
window.applyUsersFilter = function() {
    const search = document.getElementById('users-search-input')?.value.toLowerCase().trim() || '';
    if (!search) { renderUsers(allUsers); return; }

    const filtered = allUsers.filter(user => {
        const name  = (user.full_name || user.fullName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const scId  = generateSCId(user.id).toLowerCase();
        return name.includes(search) || email.includes(search) || scId.includes(search);
    });
    renderUsers(filtered);
};

// ==================== PAYMENT METHODS ====================
async function loadPaymentMethods() {
    const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('created_at', { ascending: false });

    const list = document.getElementById('methods-list');
    if (!list) return;

    if (error || !data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:20px;">لا توجد بوابات دفع.</p>';
        return;
    }

    list.innerHTML = data.map(m => `
        <div class="tx-card" style="align-items:center;">
            <img src="${m.logo_url || ''}"
                 style="width:50px;height:50px;object-fit:contain;background:white;border-radius:8px;padding:4px;flex-shrink:0;"
                 onerror="this.style.display='none'">
            <div class="tx-info" style="flex:1;">
                <h4 style="margin:0 0 4px;">${m.name}</h4>
                <p style="margin:0; font-size:13px;"><i class="fas fa-hashtag"></i> ${m.account_number || 'لا يوجد رقم حساب'}</p>
            </div>
            <div style="display:flex; gap:8px; flex-shrink:0;">
                <button onclick="toggleMethod('${m.id}', ${m.is_active})"
                    style="padding:7px 14px; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:bold;
                           background:${m.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};
                           color:${m.is_active ? '#22c55e' : '#ef4444'};">
                    ${m.is_active ? '✅ مفعّل' : '❌ معطّل'}
                </button>
                <button onclick="deleteMethod('${m.id}')"
                    style="padding:7px 12px; background:rgba(239,68,68,0.15); color:#ef4444; border:none; border-radius:8px; cursor:pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==================== APPROVE ====================
window.approveTransaction = async (txId, userId, amount, type) => {
    if (!confirm(`هل تريد ${type === 'charge' ? 'إضافة' : 'خصم'} ${amount} MRU ${type === 'charge' ? 'لرصيد' : 'من رصيد'} المستخدم؟`)) return;

    try {
        const { data: userData } = await supabase
            .from('users').select('balance').eq('id', userId).single();

        const currentBalance = userData?.balance || 0;
        const newBalance     = type === 'charge' ? currentBalance + amount : currentBalance - amount;

        if (newBalance < 0) { alert('⚠️ رصيد المستخدم غير كافٍ للسحب!'); return; }

        await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('wallet_transactions').update({ status: 'مكتمل' }).eq('id', txId);

        alert('✅ تمت الموافقة وتحديث الرصيد!');
        loadAll();
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

// ==================== REJECT WITH REASON ====================
window.openRejectModal = (txId) => {
    rejectTxId = txId;
    const input = document.getElementById('reject-reason-input');
    if (input) input.value = '';
    const modal = document.getElementById('reject-modal');
    if (modal) modal.classList.add('active');
};

window.closeRejectModal = () => {
    const modal = document.getElementById('reject-modal');
    if (modal) modal.classList.remove('active');
    rejectTxId = null;
};

window.confirmReject = async () => {
    if (!rejectTxId) return;
    const reason = document.getElementById('reject-reason-input')?.value.trim();
    if (!reason) { alert('⚠️ يرجى كتابة سبب الرفض'); return; }

    const { error } = await supabase
        .from('wallet_transactions')
        .update({ status: 'مرفوض', reject_reason: reason })
        .eq('id', rejectTxId);

    if (error) { alert('خطأ: ' + error.message); return; }
    closeRejectModal();
    loadAll();
};

// ==================== EDIT BALANCE MODAL ====================
window.openEditModal = (userId, balance) => {
    currentEditUserId = userId;
    const scId = generateSCId(userId);
    const editUserId  = document.getElementById('edit-user-id');
    const editScId    = document.getElementById('edit-user-scid');
    const editBalance = document.getElementById('edit-balance-input');
    const editNote    = document.getElementById('edit-note-input');

    if (editUserId)  editUserId.textContent  = userId.substring(0, 16) + '...';
    if (editScId)    editScId.textContent    = scId;
    if (editBalance) editBalance.value       = balance;
    if (editNote)    editNote.value          = '';

    document.getElementById('edit-modal')?.classList.add('active');
};

window.closeEditModal = () => {
    document.getElementById('edit-modal')?.classList.remove('active');
};

window.saveBalance = async () => {
    const newBalance = parseFloat(document.getElementById('edit-balance-input')?.value);
    const note       = document.getElementById('edit-note-input')?.value.trim() || 'تعديل يدوي من الأدمن';
    if (isNaN(newBalance) || newBalance < 0) { alert('⚠️ أدخل رصيداً صحيحاً'); return; }

    const { data: userData } = await supabase
        .from('users').select('balance').eq('id', currentEditUserId).single();
    const oldBalance = userData?.balance || 0;
    const diff       = newBalance - oldBalance;

    const { error } = await supabase.from('users')
        .update({ balance: newBalance }).eq('id', currentEditUserId);
    if (error) { alert('خطأ: ' + error.message); return; }

    if (diff !== 0) {
        await supabase.from('wallet_transactions').insert({
            user_id:        currentEditUserId,
            type:           diff >= 0 ? 'charge' : 'withdraw',
            amount:         Math.abs(diff),
            payment_method: 'تعديل أدمن',
            status:         'مكتمل',
            note:           note
        });
    }

    closeEditModal();
    alert('✅ تم تحديث الرصيد!');
    loadAll();
};

// ==================== USER ORDERS MODAL ====================
window.openUserOrders = async (userId) => {
    const modal = document.getElementById('user-orders-modal');
    const body  = document.getElementById('user-orders-body');
    if (!modal || !body) return;

    const user = allUsers.find(u => u.id === userId);
    const scId = generateSCId(userId);
    document.getElementById('user-orders-title').textContent =
        `طلبات ${user?.full_name || user?.email || scId}`;

    body.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">جاري التحميل...</p>';
    modal.classList.add('active');

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['مكتمل', 'ملغي', 'مرفوض', 'مسترد', 'قيد الانتظار'])
        .order('created_at', { ascending: false });

    if (error || !orders || orders.length === 0) {
        body.innerHTML = '<p style="text-align:center;color:#64748b;padding:30px;">لا توجد طلبات</p>';
        return;
    }

    const statusColor = {
        'مكتمل': '#22c55e', 'ملغي': '#ef4444',
        'مرفوض': '#ef4444', 'مسترد': '#f59e0b',
        'قيد الانتظار': '#f97316'
    };

    body.innerHTML = orders.map(o => {
        const color = statusColor[o.status] || '#94a3b8';
        return `
        <div style="background:#0f172a; border-radius:12px; padding:16px; border:1px solid #1e293b; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; color:#f1f5f9; font-size:14px; margin-bottom:4px;">
                        ${o.product_name || 'منتج'}
                        ${o.label ? `<span style="background:#1e293b;color:#94a3b8;font-size:11px;padding:2px 8px;border-radius:5px;margin-right:6px;">${o.label}</span>` : ''}
                    </div>
                    <div style="font-size:12px; color:#64748b; margin-bottom:4px;">
                        <i class="fas fa-hashtag"></i> ${o.order_number || '---'}
                        &nbsp;•&nbsp;
                        <i class="fas fa-calendar"></i> ${new Date(o.created_at).toLocaleString('fr-FR')}
                    </div>
                    <div style="font-size:12px; color:#94a3b8; margin-bottom:6px;">
                        الكمية: <strong style="color:#e2e8f0;">${o.quantity || 1}</strong>
                        &nbsp;|&nbsp;
                        طريقة الدفع: <strong style="color:#e2e8f0;">${o.paymentMethod || o.payment_method || '---'}</strong>
                    </div>
                    ${o.card_code ? `
                        <div style="background:#0a0f1a;border-radius:6px;padding:8px 10px;font-family:monospace;font-size:12px;color:#22c55e;border:1px solid #1e293b;word-break:break-all;">
                            ${o.card_code.replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}
                    ${o.reject_reason ? `
                        <div style="margin-top:8px;background:rgba(239,68,68,0.1);border-radius:6px;padding:8px;font-size:12px;color:#fca5a5;">
                            <i class="fas fa-exclamation-circle"></i> سبب الرفض: ${o.reject_reason}
                        </div>
                    ` : ''}
                </div>
                <div style="text-align:left; flex-shrink:0;">
                    <div style="font-size:1.1rem;font-weight:800;color:#f97316;">${o.price} MRU</div>
                    <span style="font-size:12px;font-weight:600;color:${color};background:${color}22;
                                 padding:3px 10px;border-radius:20px;display:inline-block;margin-top:4px;">
                        ${o.status}
                    </span>
                </div>
            </div>
        </div>`;
    }).join('');
};

window.closeUserOrdersModal = () => {
    document.getElementById('user-orders-modal')?.classList.remove('active');
};

// ==================== RECEIPT ====================
window.viewReceipt = (url) => {
    const img   = document.getElementById('receipt-full-img');
    const modal = document.getElementById('receipt-modal');
    if (img)   img.src = url;
    if (modal) modal.classList.add('active');
};

// ==================== METHODS ====================
window.toggleMethod = async (id, current) => {
    await supabase.from('payment_methods').update({ is_active: !current }).eq('id', id);
    loadPaymentMethods();
};

window.deleteMethod = async (id) => {
    if (!confirm('هل تريد حذف هذه البوابة؟')) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    loadPaymentMethods();
};

// ==================== TABS ====================
window.switchTab = (tab) => {
    activeTab = tab;
    const tabs = ['pending', 'charge', 'withdraw', 'users', 'methods'];
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active', tabs[i] === tab);
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');

    const txFilterBar    = document.getElementById('tx-filter-bar');
    const usersFilterBar = document.getElementById('users-filter-bar');
    if (txFilterBar)    txFilterBar.style.display    = tab === 'users' ? 'none' : 'flex';
    if (usersFilterBar) usersFilterBar.style.display = tab === 'users' ? 'flex' : 'none';

    if (tab === 'methods') loadPaymentMethods();
};

window.applyFilter = () => renderAll();

// ==================== INIT ====================
loadAll();
setInterval(loadAll, 30000);