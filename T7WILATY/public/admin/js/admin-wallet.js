import { supabase } from '../../js/supabase-config.js';

let allTransactions = [];
let allUsers = [];
let currentEditUserId = null;
let activeTab = 'pending';

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
    try {
        // ✅ تحميل المستخدمين أولاً، ثم المعاملات
        await loadUsers();
        await loadTransactions();
        updateStats();
    } catch (err) {
        console.warn('loadAll error:', err.message);
    }
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
        .select('id, email, balance, full_name')
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
    const totalBalances    = allUsers.reduce((s, u) => s + (u.balance || 0), 0);

    const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);

    document.getElementById('stat-pending').textContent        = pending.length;
    document.getElementById('stat-total-charge').textContent   = fmt(charges.reduce((s, t) => s + t.amount, 0));
    document.getElementById('stat-total-withdraw').textContent = fmt(withdraws.reduce((s, t) => s + t.amount, 0));
    document.getElementById('stat-users').textContent          = usersWithBalance.length;
    document.getElementById('pending-count').textContent       = pending.length;

    // ===== عداد قيد المراجعة على زر التاب =====
    const pendingTabBtn = document.querySelector('.tab-btn[onclick*="pending"]');
    if (pendingTabBtn) {
        const existingBadge = pendingTabBtn.querySelector('.pending-count-badge');
        if (existingBadge) existingBadge.remove();
        if (pending.length > 0) {
            const badge = document.createElement('span');
            badge.className = 'pending-count-badge';
            badge.textContent = pending.length;
            badge.style.cssText = `
                background:#ef4444; color:white; border-radius:50%;
                font-size:10px; font-weight:800; min-width:18px; height:18px;
                display:inline-flex; align-items:center; justify-content:center;
                padding:0 4px; margin-right:6px; line-height:1;
            `;
            pendingTabBtn.appendChild(badge);
        }
    }

    // ===== عداد إجمالي أرصدة المستخدمين =====
    const totalBalEl = document.getElementById('stat-total-balances');
    if (totalBalEl) totalBalEl.textContent = fmt(totalBalances) + ' MRU';

    // ===== تحديث عنوان التبويب بعدد الطلبات المعلقة =====
    document.title = pending.length > 0
        ? `(${pending.length}) قيد المراجعة | إدارة المحافظ`
        : 'إدارة المحافظ | SecondsCard';
}

// ==================== RENDER TRANSACTIONS ====================
function renderAll() {
    const search       = document.getElementById('search-input')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('status-filter')?.value || '';

    const filtered = allTransactions.filter(t => {
        const matchSearch =
            t.user_id?.toLowerCase().includes(search) ||
            (t.payment_method || '').toLowerCase().includes(search) ||
            (t.id || '').toLowerCase().includes(search) ||           // ← رقم المعاملة
            (t.withdraw_account || '').toLowerCase().includes(search); // ← رقم الحساب

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
        const isCharge  = tx.type === 'charge';
        const date      = new Date(tx.created_at).toLocaleString('fr-FR');
        const isPending = tx.status === 'قيد المراجعة';
        const isRejected = tx.status === 'مرفوض';
        const scId      = tx.user_id ? generateSCId(tx.user_id) : '---';

        // جلب بيانات المستخدم من allUsers
        const user = allUsers.find(u => u.id === tx.user_id);
        const userName  = user?.full_name || user?.fullName || 'مستخدم';
        const userEmail = user?.email || '';
        const userAvatar = user?.avatar_url || '';

        return `
        <div class="tx-card" style="
            border-right: 3px solid ${isCharge ? '#22c55e' : '#f97316'};
            transition: transform 0.15s, box-shadow 0.15s;
            position: relative;
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.3)'"
           onmouseout="this.style.transform='';this.style.boxShadow=''">
        ${tx.status === 'قيد المراجعة' ? `
            <div style="position:absolute; top:10px; left:10px;
                background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.4);
                color:#f97316; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px;">
                🔔 بانتظار المراجعة
            </div>` : ''}
            
            <!-- صورة البروفيل -->
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0;">
                ${userAvatar
                    ? `<img src="${userAvatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #334155;">`
                    : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;color:#f97316;font-size:18px;"><i class="fas fa-user"></i></div>`
                }
            </div>

            <div class="tx-icon ${isCharge ? 'charge' : 'withdraw'}">
                <i class="fas fa-arrow-${isCharge ? 'up' : 'down'}"></i>
            </div>

            <div class="tx-info" style="flex:1;">
                <!-- اسم العميل والإيميل -->
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span style="font-weight:700; color:#f1f5f9; font-size:14px;">${userName}</span>
                    <span style="font-size:11px; color:#94a3b8; background:#0f172a; padding:2px 7px; border-radius:5px;">${userEmail}</span>
                </div>

                <h4 style="margin:0 0 4px;">${isCharge ? 'شحن رصيد' : 'سحب رصيد'} • ${tx.payment_method || '-'}</h4>

                <p style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:4px 0;">
                    <span onclick="openUserOrders('${tx.user_id}')"
                          style="font-family:monospace; color:#f97316; font-size:12px;
                                 background:rgba(249,115,22,0.1); padding:2px 6px;
                                 border-radius:5px; cursor:pointer; border:1px solid rgba(249,115,22,0.2);"
                          title="انقر لعرض طلبات العميل">
                        ${scId}
                    </span>
                    ${tx.order_number ? `
                    <span style="font-family:monospace; color:#60a5fa; font-size:12px;
                                 background:rgba(96,165,250,0.1); padding:2px 8px;
                                 border-radius:5px; border:1px solid rgba(96,165,250,0.2);">
                        🔖 ${tx.order_number}
                    </span>` : ''}
                    <span style="color:#64748b; font-size:11px;">${date}</span>
                </p>

                ${tx.withdraw_account ? `
                    <p style="font-size:13px;">حساب الاستلام: <strong style="color:#e2e8f0;">${tx.withdraw_account}</strong></p>
                ` : ''}

                <span class="status-badge status-${tx.status === 'مكتمل' ? 'completed' : tx.status === 'مرفوض' ? 'rejected' : 'pending'}">
                    ${tx.status}
                </span>

                <!-- سبب الرفض -->
                ${isRejected && tx.reject_reason ? `
                    <div style="margin-top:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3);
                                border-radius:8px; padding:8px 12px; font-size:13px; color:#fca5a5;">
                        <i class="fas fa-exclamation-circle"></i> سبب الرفض: ${tx.reject_reason}
                    </div>
                ` : ''}
            </div>

            <div class="tx-amount ${isCharge ? 'credit' : 'debit'}">
                ${isCharge ? '+' : '-'}${tx.amount} MRU
            </div>

            ${tx.receipt_url ? `
                <img src="${tx.receipt_url}" class="receipt-img" onclick="viewReceipt('${tx.receipt_url}')">
            ` : ''}

            ${isPending ? `
                <div class="tx-actions">
                    <button class="btn-approve" onclick="approveTransaction('${tx.id}', '${tx.user_id}', ${tx.amount}, '${tx.type}')">
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
        const scId = generateSCId(user.id);
        const name = user.full_name || user.fullName || user.email || 'مستخدم';
        const userAvatar = user.avatar_url || '';

        const lastEdit = allTransactions
            .filter(t => t.user_id === user.id && t.payment_method === 'تعديل أدمن')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

        return `
        <div class="tx-card" style="
            border-right: 3px solid #f97316;
            transition: transform 0.15s, box-shadow 0.15s;
            position: relative;
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.3)'"
           onmouseout="this.style.transform='';this.style.boxShadow=''">

            ${userAvatar
                ? `<img src="${userAvatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #334155; flex-shrink:0;">`
                : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(249,115,22,0.15);display:flex;align-items:center;justify-content:center;color:#f97316;font-size:18px;flex-shrink:0;"><i class="fas fa-user"></i></div>`
            }

            <div class="tx-icon" style="background:rgba(249,115,22,0.15); color:#f97316;">
                <i class="fas fa-user"></i>
            </div>

            <div class="tx-info" style="flex:1;">
                <h4>${name}</h4>
                <p style="font-size:12px; color:#94a3b8;">${user.email || ''}</p>

                <span onclick="openUserOrders('${user.id}')"
                      style="font-family:monospace; font-size:12px; color:#f97316;
                             background:rgba(249,115,22,0.1); padding:2px 7px;
                             border-radius:5px; border:1px solid rgba(249,115,22,0.2);
                             cursor:pointer; display:inline-block; margin-top:4px;"
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

            <div class="tx-amount" style="color:#f97316;">
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
// ==================== REJECT WITH REASON ====================
let rejectTxId = null;

window.openRejectModal = (txId) => {
    rejectTxId = txId;
    document.getElementById('reject-reason-input').value = '';
    document.getElementById('reject-modal').classList.add('active');
};

window.closeRejectModal = () => {
    document.getElementById('reject-modal').classList.remove('active');
    rejectTxId = null;
};

window.confirmReject = async () => {
    if (!rejectTxId) return;
    const reason = document.getElementById('reject-reason-input').value.trim();
    if (!reason) { showToast('⚠️ يرجى كتابة سبب الرفض'); return; }

    const { error } = await supabase
        .from('wallet_transactions')
        .update({ status: 'مرفوض', reject_reason: reason })
        .eq('id', rejectTxId);

    if (error) { showToast('خطأ: ' + error.message); return; }
    closeRejectModal();
    loadAll();
};

// ==================== USER ORDERS MODAL ====================
window.openUserOrders = async (userId) => {
    const modal = document.getElementById('user-orders-modal');
    const body  = document.getElementById('user-orders-body');
    const scId  = generateSCId(userId);
    const user  = allUsers.find(u => u.id === userId);

    document.getElementById('user-orders-title').textContent =
        `طلبات ${user?.full_name || user?.email || scId}`;

    body.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">جاري التحميل...</p>';
    modal.classList.add('active');

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['مكتمل', 'ملغي', 'مرفوض', 'مسترد'])
        .order('created_at', { ascending: false });

    if (error || !orders || orders.length === 0) {
        body.innerHTML = '<p style="text-align:center;color:#64748b;padding:30px;">لا توجد طلبات</p>';
        return;
    }

    body.innerHTML = orders.map(o => {
        const statusColor = {
            'مكتمل': '#22c55e', 'ملغي': '#ef4444',
            'مرفوض': '#ef4444', 'مسترد': '#f59e0b'
        }[o.status] || '#94a3b8';

        return `
        <div style="background:#0f172a; border-radius:12px; padding:16px; border:1px solid #1e293b; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
                <div>
                    <div style="font-weight:700; color:#f1f5f9; font-size:14px; margin-bottom:4px;">
                        ${o.product_name || 'منتج'}
                        ${o.label ? `<span style="background:#1e293b;color:#94a3b8;font-size:11px;padding:2px 8px;border-radius:5px;margin-right:6px;">${o.label}</span>` : ''}
                    </div>
                    <div style="font-size:12px; color:#64748b;">
                        <i class="fas fa-hashtag"></i> ${o.order_number || '---'}
                        &nbsp;•&nbsp;
                        <i class="fas fa-calendar"></i> ${new Date(o.created_at).toLocaleString('fr-FR')}
                    </div>
                    <div style="margin-top:6px; font-size:12px; color:#94a3b8;">
                        الكمية: <strong style="color:#e2e8f0;">${o.quantity || 1}</strong>
                        &nbsp;|&nbsp;
                        طريقة الدفع: <strong style="color:#e2e8f0;">${o.paymentMethod || o.payment_method || '---'}</strong>
                    </div>
                    ${o.card_code ? `
                        <div style="margin-top:8px; background:#0a0f1a; border-radius:6px; padding:8px 10px; font-family:monospace; font-size:12px; color:#22c55e; border:1px solid #1e293b;">
                            ${o.card_code.replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}
                    ${o.reject_reason ? `
                        <div style="margin-top:8px;background:rgba(239,68,68,0.1);border-radius:6px;padding:8px;font-size:12px;color:#fca5a5;">
                            <i class="fas fa-exclamation-circle"></i> سبب الرفض: ${o.reject_reason}
                        </div>
                    ` : ''}
                </div>
                <div style="text-align:left;">
                    <div style="font-size:1.1rem; font-weight:800; color:#f97316;">${o.price} MRU</div>
                    <span style="font-size:12px; font-weight:600; color:${statusColor};
                                 background:${statusColor}22; padding:3px 10px; border-radius:20px; display:inline-block; margin-top:4px;">
                        ${o.status}
                    </span>
                </div>
            </div>
        </div>`;
    }).join('');
};

window.closeUserOrdersModal = () => {
    document.getElementById('user-orders-modal').classList.remove('active');
};
// ==================== USERS FILTER ====================
window.applyUsersFilter = function() {
    const search = document.getElementById('users-search-input').value.toLowerCase().trim();

    if (!search) {
        renderUsers(allUsers);
        return;
    }

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
                 style="width:50px;height:50px;object-fit:contain;background:white;border-radius:8px;padding:4px;"
                 onerror="this.style.display='none'">
            <div class="tx-info">
                <h4>${m.name}</h4>
                <p><i class="fas fa-hashtag"></i> ${m.account_number || 'لا يوجد رقم حساب'}</p>
            </div>
            <div style="display:flex; gap:8px; margin-right:auto;">
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

// ==================== APPROVE / REJECT ====================
window.approveTransaction = async (txId, userId, amount, type) => {
    const confirmed = await showConfirm(`هل تريد ${type === 'charge' ? 'إضافة' : 'خصم'} ${amount} MRU ${type === 'charge' ? 'لرصيد' : 'من رصيد'} المستخدم؟`);
    if (!confirmed) return;

    try {
        const { data: userData } = await supabase
            .from('users').select('balance').eq('id', userId).single();

        const currentBalance = userData?.balance || 0;
        const newBalance     = type === 'charge' ? currentBalance + amount : currentBalance - amount;

        if (newBalance < 0) { showToast('⚠️ رصيد المستخدم غير كافٍ للسحب!'); return; }

        // ✅ توليد رقم مرجعي
        const refNumber = `S${Math.floor(100000 + Math.random() * 900000)}`;

        await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('wallet_transactions')
            .update({ status: 'مكتمل', order_number: refNumber })
            .eq('id', txId);

        showToast('✅ تمت الموافقة وتحديث الرصيد!');
        loadAll();
    } catch (err) {
        showToast('❌ خطأ: ' + err.message);
    }
};

window.rejectTransaction = async (txId) => {
    if (!await showConfirm('هل تريد رفض هذا الطلب؟')) return;
    const { error } = await supabase.from('wallet_transactions').update({ status: 'مرفوض' }).eq('id', txId);
    if (error) showToast('❌ خطأ: ' + error.message);
    else { showToast('✅    تم رفض الطلب.'); loadAll(); }
};

// ==================== EDIT BALANCE MODAL ====================
window.openEditModal = (userId, balance) => {
    currentEditUserId = userId;
    const scId = generateSCId(userId);
    document.getElementById('edit-user-id').textContent   = userId.substring(0, 16) + '...';
    document.getElementById('edit-user-scid').textContent = scId;
    document.getElementById('edit-balance-input').value   = balance;
    document.getElementById('edit-note-input').value      = '';
    document.getElementById('edit-modal').classList.add('active');
};

window.closeEditModal = () => {
    document.getElementById('edit-modal').classList.remove('active');
};

window.saveBalance = async () => {
    const newBalance = parseFloat(document.getElementById('edit-balance-input').value);
    const note       = document.getElementById('edit-note-input').value.trim() || 'تعديل يدوي من الأدمن';
    if (isNaN(newBalance) || newBalance < 0) { showToast('⚠️ أدخل رصيداً صحيحاً'); return; }

    const { data: userData } = await supabase
        .from('users').select('balance').eq('id', currentEditUserId).single();
    const oldBalance = userData?.balance || 0;
    const diff       = newBalance - oldBalance;

    const { error } = await supabase.from('users')
        .update({ balance: newBalance }).eq('id', currentEditUserId);
    if (error) { showToast('❌ خطأ: ' + error.message); return; }

    await supabase.from('wallet_transactions').insert({
        user_id:        currentEditUserId,
        type:           diff >= 0 ? 'charge' : 'withdraw',
        amount:         Math.abs(diff),
        payment_method: 'تعديل أدمن',
        status:         'مكتمل',
        note:           note
    });

    closeEditModal();
    showToast('✅ تم تحديث الرصيد!');
    loadAll();
};

// ==================== RECEIPT ====================
window.viewReceipt = (url) => {
    document.getElementById('receipt-full-img').src = url;
    document.getElementById('receipt-modal').classList.add('active');
};

// ==================== METHODS ====================
window.toggleMethod = async (id, current) => {
    await supabase.from('payment_methods').update({ is_active: !current }).eq('id', id);
    loadPaymentMethods();
};

window.deleteMethod = async (id) => {
    if (!await showConfirm('هل تريد حذف هذه البوابة؟')) return;
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

    // إظهار / إخفاء شريط البحث المناسب
    const txFilterBar    = document.getElementById('tx-filter-bar');
    const usersFilterBar = document.getElementById('users-filter-bar');
    if (tab === 'users') {
        txFilterBar.style.display    = 'none';
        usersFilterBar.style.display = 'flex';
    } else {
        txFilterBar.style.display    = 'flex';
        usersFilterBar.style.display = 'none';
    }

    if (tab === 'methods') loadPaymentMethods();
};

window.applyFilter = () => renderAll();

// ==================== INIT ====================
loadAll();

// منع التعارض — نتأكد أن الطلب السابق انتهى قبل البدء بطلب جديد
let isLoading = false;
setInterval(async () => {
    if (isLoading) return;
    isLoading = true;
    try {
        await loadAll();
    } finally {
        isLoading = false;
    }
}, 30000);


// ===== Toast =====
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
        position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
        background:${isError ? '#ef4444' : '#22c55e'}; color:white;
        padding:12px 28px; border-radius:10px; font-size:14px; font-weight:700;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.4);
        pointer-events:none; white-space:nowrap;
        animation:slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// ===== Confirm Modal =====
function showConfirm(message) {
    return new Promise(resolve => {
        document.getElementById('custom-confirm-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.7);
            z-index:99998; display:flex; align-items:center; justify-content:center;
            padding:20px;
        `;
        modal.innerHTML = `
            <div style="background:#1e293b; border:1px solid #334155; border-radius:16px;
                        padding:28px; max-width:400px; width:100%; text-align:center; color:#e2e8f0;">
                <div style="font-size:32px; margin-bottom:14px;">❓</div>
                <p style="font-size:15px; font-weight:600; margin-bottom:24px; line-height:1.6;">
                    ${message}
                </p>
                <div style="display:flex; gap:12px; justify-content:center;">
                    <button id="confirm-yes"
                        style="padding:10px 32px; background:#22c55e; color:white; border:none;
                               border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                        تأكيد
                    </button>
                    <button id="confirm-no"
                        style="padding:10px 32px; background:#334155; color:#e2e8f0; border:none;
                               border-radius:8px; font-size:14px; font-weight:700; cursor:pointer;">
                        إلغاء
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('confirm-yes').onclick = () => { modal.remove(); resolve(true); };
        document.getElementById('confirm-no').onclick  = () => { modal.remove(); resolve(false); };
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
    });
}

// ==================== تحديث badge المحافظ في الهيدر ====================
function updateWalletBadge(count) {
    // البحث عن رابط المحافظ في كل القوائم
    document.querySelectorAll('a[href="admin-wallet.html"]').forEach(link => {
        // احذف القديم إن وجد
        link.querySelector('.wallet-badge')?.remove();

        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'wallet-badge';
            badge.textContent = count;
            badge.style.cssText = `
                background: #ef4444;
                color: white;
                border-radius: 50%;
                font-size: 10px;
                font-weight: 800;
                min-width: 17px;
                height: 17px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                margin-right: 4px;
                line-height: 1;
            `;
            link.appendChild(badge);
        }
    });
}