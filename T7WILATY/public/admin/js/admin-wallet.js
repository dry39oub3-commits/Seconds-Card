import { supabase } from '../../js/supabase-config.js';

let allTransactions = [];
let allUsers = [];
let currentEditUserId = null;
let activeTab = 'pending';

async function loadAll() {
    await Promise.all([loadTransactions(), loadUsers()]);
    updateStats();
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
    const pending = allTransactions.filter(t => t.status === 'قيد المراجعة');
    const charges = allTransactions.filter(t => t.type === 'charge' && t.status === 'مكتمل');
    const withdraws = allTransactions.filter(t => t.type === 'withdraw' && t.status === 'مكتمل');
    const usersWithBalance = allUsers.filter(u => u.balance > 0);

    document.getElementById('stat-pending').textContent = pending.length;
    document.getElementById('stat-total-charge').textContent = charges.reduce((s, t) => s + t.amount, 0);
    document.getElementById('stat-total-withdraw').textContent = withdraws.reduce((s, t) => s + t.amount, 0);
    document.getElementById('stat-users').textContent = usersWithBalance.length;
    document.getElementById('pending-count').textContent = pending.length;
}

function renderAll() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;

    const filtered = allTransactions.filter(t => {
        const matchSearch = t.user_id?.toLowerCase().includes(search) ||
            (t.payment_method || '').toLowerCase().includes(search);
        const matchStatus = !statusFilter || t.status === statusFilter;
        return matchSearch && matchStatus;
    });

    renderList('pending-list', filtered.filter(t => t.status === 'قيد المراجعة'));
    renderList('charge-list', filtered.filter(t => t.type === 'charge'));
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
        const isCharge = tx.type === 'charge';
        const date = new Date(tx.created_at).toLocaleString('fr-FR');
        const isPending = tx.status === 'قيد المراجعة';

        return `
        <div class="tx-card">
            <div class="tx-icon ${isCharge ? 'charge' : 'withdraw'}">
                <i class="fas fa-arrow-${isCharge ? 'up' : 'down'}"></i>
            </div>
            <div class="tx-info">
                <h4>${isCharge ? 'شحن رصيد' : 'سحب رصيد'} • ${tx.payment_method || '-'}</h4>
                <p>${tx.user_id?.substring(0, 12)}... • ${date}</p>
                ${tx.withdraw_account ? `<p>حساب الاستلام: <strong style="color:#e2e8f0;">${tx.withdraw_account}</strong></p>` : ''}
                <span class="status-badge status-${tx.status === 'مكتمل' ? 'completed' : tx.status === 'مرفوض' ? 'rejected' : 'pending'}">
                    ${tx.status}
                </span>
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
                    <button class="btn-reject" onclick="rejectTransaction('${tx.id}')">
                        <i class="fas fa-times"></i> رفض
                    </button>
                </div>
            ` : ''}
        </div>`;
    }).join('');
}

function renderUsers(list) {
    const container = document.getElementById('users-list');
    if (!container) return;
    if (!list || list.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px;">لا توجد بيانات</p>';
        return;
    }

    container.innerHTML = list.map(user => `
        <div class="tx-card">
            <div class="tx-icon" style="background:rgba(249,115,22,0.15); color:#f97316;">
                <i class="fas fa-user"></i>
            </div>
            <div class="tx-info">
                <h4>${user.fullName || user.email || 'مستخدم'}</h4>
                <p style="font-size:11px;">${user.id?.substring(0, 16)}...</p>
            </div>
            
            <div class="tx-amount" style="color:#f97316;">
                ${user.balance || 0} MRU
            </div>
            <button onclick="openEditModal('${user.id}', ${user.balance || 0})"
                style="background:#334155; color:white; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-size:13px;">
                <i class="fas fa-edit"></i> تعديل
            </button>
        </div>
    `).join('');
}

async function loadPaymentMethods() {
    const { data, error } = await supabase
        .from('payment_methods')
        .select('id, email, balance, fullName')
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

window.approveTransaction = async (txId, userId, amount, type) => {
    if (!confirm(`هل تريد ${type === 'charge' ? 'إضافة' : 'خصم'} ${amount} MRU ${type === 'charge' ? 'لرصيد' : 'من رصيد'} المستخدم؟`)) return;

    try {
        const { data: userData } = await supabase
            .from('users').select('balance').eq('id', userId).single();

        const currentBalance = userData?.balance || 0;
        const newBalance = type === 'charge' ? currentBalance + amount : currentBalance - amount;

        if (newBalance < 0) { alert('⚠️ رصيد المستخدم غير كافٍ للسحب!'); return; }

        await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
        await supabase.from('wallet_transactions').update({ status: 'مكتمل' }).eq('id', txId);

        alert('✅ تمت الموافقة وتحديث الرصيد!');
        loadAll();
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
};

window.rejectTransaction = async (txId) => {
    if (!confirm('هل تريد رفض هذا الطلب؟')) return;
    const { error } = await supabase.from('wallet_transactions').update({ status: 'مرفوض' }).eq('id', txId);
    if (error) alert('خطأ: ' + error.message);
    else { alert('تم رفض الطلب.'); loadAll(); }
};

window.openEditModal = (userId, balance) => {
    currentEditUserId = userId;
    document.getElementById('edit-user-id').textContent = userId.substring(0, 16) + '...';
    document.getElementById('edit-balance-input').value = balance;
    document.getElementById('edit-note-input').value = '';
    document.getElementById('edit-modal').classList.add('active');
};

window.closeEditModal = () => {
    document.getElementById('edit-modal').classList.remove('active');
};

window.saveBalance = async () => {
    const newBalance = parseFloat(document.getElementById('edit-balance-input').value);
    const note = document.getElementById('edit-note-input').value.trim() || 'تعديل يدوي من الأدمن';
    if (isNaN(newBalance) || newBalance < 0) { alert('⚠️ أدخل رصيداً صحيحاً'); return; }

    // جلب الرصيد القديم
    const { data: userData } = await supabase
        .from('users').select('balance').eq('id', currentEditUserId).single();
    const oldBalance = userData?.balance || 0;
    const diff = newBalance - oldBalance;

    // تحديث الرصيد
    const { error } = await supabase.from('users')
        .update({ balance: newBalance }).eq('id', currentEditUserId);
    if (error) { alert('خطأ: ' + error.message); return; }

    // تسجيل العملية في السجل
    await supabase.from('wallet_transactions').insert({
        user_id: currentEditUserId,
        type: diff >= 0 ? 'charge' : 'withdraw',
        amount: Math.abs(diff),
        payment_method: 'تعديل أدمن',
        status: 'مكتمل',
        note: note
    });

    closeEditModal();
    alert('✅ تم تحديث الرصيد!');
    loadAll();
};

window.viewReceipt = (url) => {
    document.getElementById('receipt-full-img').src = url;
    document.getElementById('receipt-modal').classList.add('active');
};

window.toggleMethod = async (id, current) => {
    await supabase.from('payment_methods').update({ is_active: !current }).eq('id', id);
    loadPaymentMethods();
};

window.deleteMethod = async (id) => {
    if (!confirm('هل تريد حذف هذه البوابة؟')) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    loadPaymentMethods();
};

window.switchTab = (tab) => {
    activeTab = tab;
    const tabs = ['pending', 'charge', 'withdraw', 'users', 'methods'];
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
        b.classList.toggle('active', tabs[i] === tab);
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    if (tab === 'methods') loadPaymentMethods();
};

window.applyFilter = () => renderAll();

loadAll();
setInterval(loadAll, 30000);