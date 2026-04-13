import { supabase } from './supabase-config.js';

// ===== تحميل بيانات المستخدم =====
async function loadWalletData() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { window.location.href = 'login.html'; return; }

    const { data: userData } = await supabase
        .from('users')
        .select('balance, full_name')
        .eq('id', user.id)
        .single();

    const balance = userData?.balance || 0;
    const balanceInUSD = (balance / 40).toFixed(2);

    const balanceEl = document.getElementById('wallet-balance');
    const usdEl = document.getElementById('wallet-usd');
    if (balanceEl) balanceEl.textContent = `MRU ${balance.toFixed(2)}`;
    if (usdEl) usdEl.textContent = `$${balanceInUSD}`;

    loadTransactions(user.id);
}

// ===== تحميل سجل المعاملات =====
async function loadTransactions(userId) {
    const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    const listContainer = document.getElementById('transactions-list');
    if (!listContainer) return;

    if (error || !transactions || transactions.length === 0) {
        listContainer.innerHTML = '<p class="empty-msg">لا توجد عمليات مضافة بعد.</p>';
        return;
    }

    listContainer.innerHTML = transactions.map(t => {
        const isCharge = t.type === 'charge';
        const date = new Date(t.created_at).toLocaleDateString('fr-FR');
        const statusColor = t.status === 'مكتمل' ? '#22c55e' : t.status === 'مرفوض' ? '#ef4444' : '#f97316';

        return `
            <div class="transaction-item">
                <div class="t-info">
                    <div class="t-icon ${isCharge ? 'plus' : 'minus'}">
                        <i class="fas ${isCharge ? 'fa-arrow-down' : 'fa-shopping-bag'}"></i>
                    </div>
                    <div class="t-details">
                        <strong>${isCharge ? 'شحن رصيد' : 'شراء بطاقة'} ${t.payment_method ? '(' + t.payment_method + ')' : ''}</strong>
                        <span>${date}</span>
                        <span style="font-size:11px; color:${statusColor};">${t.status}</span>
                    </div>
                </div>
                <div class="t-amount ${isCharge ? 'plus' : 'minus'}">
                    ${isCharge ? '+' : '-'} ${t.amount.toLocaleString()} MRU
                </div>
            </div>
        `;
    }).join('');
}

// ===== فتح modal الشحن =====
window.openChargeModal = async () => {
    document.getElementById('charge-modal')?.remove();

    const { data: methods } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    const modal = document.createElement('div');
    modal.id = 'charge-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.7); z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box; overflow-y:auto;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border-radius:16px; padding:24px; width:100%; max-width:440px; color:#e2e8f0; position:relative; margin:auto;">
            <button onclick="document.getElementById('charge-modal').remove()"
                style="position:absolute; top:14px; left:14px; background:#ef4444; color:white; border:none; border-radius:8px; padding:5px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>

            <h3 style="text-align:center; color:#22c55e; margin-bottom:20px;">💳 شحن الرصيد</h3>

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">المبلغ (MRU)</label>
            <input type="number" id="charge-amount" placeholder="0"
                style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; margin-bottom:14px; box-sizing:border-box;">

            <input type="hidden" id="charge-method-selected">

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:8px;">اختر طريقة الدفع</label>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;" id="methods-container">
                ${methods && methods.length > 0 ? methods.map(m => `
                    <div onclick="selectChargeMethod('${m.name}', '${m.account_number || ''}', this)"
                        style="border:2px solid #334155; border-radius:10px; padding:12px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:0.2s;">
                        <img src="${m.logo_url || ''}" style="width:40px; height:40px; object-fit:contain; background:white; border-radius:6px; padding:3px;" onerror="this.style.display='none'">
                        <span style="font-weight:bold;">${m.name}</span>
                    </div>
                `).join('') : '<p style="color:#64748b; text-align:center;">لا توجد بوابات دفع متاحة</p>'}
            </div>

            <div id="account-display" style="display:none; background:#0f172a; border-radius:8px; padding:12px; margin-bottom:14px; text-align:center;">
                <p style="margin:0; color:#94a3b8; font-size:13px;">حوّل المبلغ إلى:</p>
                <strong id="account-number-text" style="color:#f97316; font-size:16px;"></strong>
            </div>

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">إيصال التحويل</label>
            <input type="file" id="charge-receipt" accept="image/*"
                style="width:100%; padding:8px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; margin-bottom:16px; box-sizing:border-box;">

            <button onclick="submitCharge()"
                style="width:100%; padding:13px; background:#22c55e; color:white; border:none; border-radius:10px; font-size:15px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-paper-plane"></i> إرسال طلب الشحن
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

window.selectChargeMethod = (name, account, el) => {
    document.querySelectorAll('#methods-container > div').forEach(d => {
        d.style.borderColor = '#334155';
        d.style.background = '';
    });
    el.style.borderColor = '#22c55e';
    el.style.background = 'rgba(34,197,94,0.1)';

    document.getElementById('charge-method-selected').value = name;

    const accountDisplay = document.getElementById('account-display');
    const accountText = document.getElementById('account-number-text');
    if (account) {
        accountDisplay.style.display = 'block';
        accountText.textContent = account;
    } else {
        accountDisplay.style.display = 'none';
    }
};

// ===== إرسال طلب الشحن =====
window.submitCharge = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const amount = parseFloat(document.getElementById('charge-amount')?.value);
    const method = document.getElementById('charge-method-selected')?.value;
    const receiptFile = document.getElementById('charge-receipt')?.files[0];

    if (!amount || amount <= 0) { alert('⚠️ أدخل مبلغاً صحيحاً'); return; }
    if (!method) { alert('⚠️ اختر طريقة الدفع'); return; }
    if (!receiptFile) { alert('⚠️ يرجى رفع إيصال التحويل'); return; }

    let receipt_url = null;

    const fileName = `receipts/${user.id}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

    if (uploadError) { alert('خطأ في رفع الإيصال: ' + uploadError.message); return; }

    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
    receipt_url = urlData?.publicUrl;

    const { error } = await supabase.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'charge',
        amount,
        payment_method: method,
        receipt_url,
        status: 'قيد المراجعة'
    });

    if (error) { alert('خطأ: ' + error.message); return; }

    document.getElementById('charge-modal').remove();
    alert('✅ تم إرسال طلب الشحن! سيتم مراجعته من الإدارة.');
    loadWalletData();
};

// ===== Dark Mode =====
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = themeToggle.querySelector('i');
    if (icon) icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };
}

// ===== User Menu =====
function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (!userBtn || !dropdown) return;
    userBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
}


// ===== تشغيل =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    loadWalletData();
});