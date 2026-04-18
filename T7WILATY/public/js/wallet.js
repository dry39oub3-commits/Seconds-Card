import { supabase } from './supabase-config.js';

// ===== تهيئة الصفحة =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    loadWalletData();
});

// ===== Dark Mode =====
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    };
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ===== User Menu =====
function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (!userBtn || !dropdown) return;
    userBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); };
    window.addEventListener('click', () => dropdown.classList.remove('show'));
}

// ===== تحميل بيانات المحفظة =====
async function loadWalletData() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
        localStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.replace('login.html');
        return;
    }

    // تحديث أيقونة المستخدم
    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon) userIcon.className = 'fas fa-user-check';

    // جلب الرصيد
    const { data: userData } = await supabase
        .from('users')
        .select('balance, full_name')
        .eq('id', user.id)
        .single();

    const balance = userData?.balance || 0;
    const balanceUSD = (balance / 43).toFixed(2);

    const mruEl = document.getElementById('mruBalance');
    const usdEl = document.getElementById('usdBalance');
    if (mruEl) mruEl.textContent = `MRU ${balance.toFixed(2)}`;
    if (usdEl) usdEl.textContent = `$${balanceUSD}`;

    // جلب المعاملات
    loadTransactions(user.id);
}

// ===== سجل المعاملات =====
async function loadTransactions(userId) {
    const list = document.getElementById('transactions-list');
    if (!list) return;

    const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error || !transactions || transactions.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">لا توجد عمليات بعد.</p>';
        return;
    }

    list.innerHTML = transactions.map(t => {
        const isCharge   = t.type === 'charge' || t.type === 'deposit';
        const isPurchase = t.type === 'purchase' || t.type === 'withdraw';

        const date = new Date(t.created_at).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const statusColor = t.status === 'مكتمل' ? '#22c55e'
                          : t.status === 'مرفوض' ? '#ef4444' : '#f97316';

        let extraDetails = '';

        if (isPurchase) {
            const productName = (t.payment_method || '').replace('المحفظة - ', '').replace('محفظة - ', '');
            extraDetails = `
                <div style="margin-top:8px; background:rgba(249,115,22,0.08);
                    border:1px solid rgba(249,115,22,0.2); border-radius:8px;
                    padding:8px 12px; font-size:12px; color:#cbd5e1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:#94a3b8;">🛍️ المنتج</span>
                <span style="color:#f97316; font-weight:600;">
                    ${productName || '-'}${label ? ' — ' + label : ''}
                </span>
            </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:#94a3b8;">💰 المبلغ</span>
                        <span style="color:#ef4444; font-weight:600;">${t.amount.toLocaleString()} MRU</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:#94a3b8;">📅 التاريخ</span>
                        <span>${date}</span>
                    </div>
                    ${t.id ? `
                    <div style="display:flex; justify-content:space-between; margin-top:4px;">
                        <span style="color:#94a3b8;">🔖 رقم المعاملة</span>
                        <span style="font-family:monospace; font-size:11px; color:#60a5fa;">
                            #${t.id.substring(0, 8)}
                        </span>
                    </div>` : ''}
                </div>`;
        }

        if (isCharge) {
            extraDetails = `
                <div style="margin-top:8px; background:rgba(34,197,94,0.08);
                    border:1px solid rgba(34,197,94,0.2); border-radius:8px;
                    padding:8px 12px; font-size:12px; color:#cbd5e1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:#94a3b8;">🏦 طرق الدفع</span>
                        <span style="color:#22c55e; font-weight:600;">${t.payment_method || '-'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:#94a3b8;">💰 المبلغ</span>
                        <span style="color:#22c55e; font-weight:600;">+${t.amount.toLocaleString()} MRU</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:#94a3b8;">📅 التاريخ</span>
                        <span>${date}</span>
                    </div>
                    ${t.receipt_url ? `
                    <div style="margin-top:6px;">
                        <a href="${t.receipt_url}" target="_blank"
                            style="display:inline-flex; align-items:center; gap:6px;
                                background:#1e293b; color:#60a5fa; padding:5px 10px;
                                border-radius:6px; font-size:11px; text-decoration:none;
                                border:1px solid #334155;">
                            <i class="fas fa-receipt"></i> عرض الإيصال
                        </a>
                    </div>` : ''}
                </div>`;
        }

        return `
        <div class="transaction-item" style="flex-direction:column; align-items:stretch; gap:0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="t-info">
                    <div class="t-icon ${isCharge ? 'plus' : 'minus'}">
                        <i class="fas ${isCharge ? 'fa-arrow-down' : 'fa-shopping-bag'}"></i>
                    </div>
                    <div class="t-details">
                        <strong>${isCharge ? 'شحن رصيد' : 'سحب'}</strong>
                        <span style="font-size:11px; color:${statusColor};">${t.status}</span>
                    </div>
                </div>
                <div class="t-amount ${isCharge ? 'plus' : 'minus'}">
                    ${isCharge ? '+' : '-'}${t.amount.toLocaleString()} MRU
                </div>
            </div>
            ${extraDetails}
        </div>`;
    }).join('');
}

// ===== فتح Modal الشحن =====
window.openDepositModal = async () => {
    document.getElementById('depositModal').style.display = 'flex';
    await loadPaymentMethods();
};

window.closeDepositModal = () => {
    document.getElementById('depositModal').style.display = 'none';
    document.getElementById('charge-amount').value = '';
    document.getElementById('charge-receipt').value = '';
    document.getElementById('charge-method-selected').value = '';
    document.getElementById('method-info').style.display = 'none';
    document.querySelectorAll('#payment-methods-container > div').forEach(d => {
        d.style.borderColor = '#334155';
        d.style.background = '#0f172a';
    });
};

// ===== جلب بوابات الدفع =====
async function loadPaymentMethods() {
    const container = document.getElementById('payment-methods-container');

    const { data: methods, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true)
    .eq('show_in_wallet', true)

    if (error || !methods || methods.length === 0) {
        container.innerHTML = '<p style="color:#64748b; text-align:center; grid-column:1/-1;">لا توجد بوابات دفع متاحة حالياً</p>';
        return;
    }

    container.innerHTML = methods.map(m => `
        <div onclick="selectMethod('${m.name}', '${m.account_number || ''}', this)"
            style="background:#0f172a; border:2px solid #334155; border-radius:10px; padding:14px;
                   text-align:center; cursor:pointer; transition:all 0.2s;">
            <img src="${m.logo_url || ''}" alt="${m.name}"
                style="height:40px; object-fit:contain; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;"
                onerror="this.style.display='none'">
            <div style="font-weight:bold; font-size:14px; color:#e2e8f0;">${m.name}</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${m.account_number || ''}</div>
        </div>
    `).join('');
}

// ===== اختيار بوابة =====
window.selectMethod = (name, account, el) => {
    document.querySelectorAll('#payment-methods-container > div').forEach(d => {
        d.style.borderColor = '#334155';
        d.style.background = '#0f172a';
    });
    el.style.borderColor = '#f97316';
    el.style.background = 'rgba(249,115,22,0.1)';
    document.getElementById('charge-method-selected').value = name;
    document.getElementById('method-account-display').textContent = account;
    document.getElementById('method-info').style.display = 'block';
};

// ===== نسخ رقم الحساب =====
window.copyMethodAccount = () => {
    const account = document.getElementById('method-account-display').textContent;
    navigator.clipboard.writeText(account).then(() => alert('✅ تم نسخ رقم الحساب!'));
};

// ===== إرسال طلب الشحن =====
window.submitCharge = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const amount = parseFloat(document.getElementById('charge-amount').value);
    const method = document.getElementById('charge-method-selected').value;
    const receiptFile = document.getElementById('charge-receipt').files[0];

    if (!amount || amount <= 0) { alert('⚠️ أدخل مبلغاً صحيحاً'); return; }
    if (!method) { alert('⚠️ اختر طريقة الدفع أولاً'); return; }
    if (!receiptFile) { alert('⚠️ يرجى رفع إيصال التحويل'); return; }

    let receipt_url = null;

    // رفع الإيصال
    try {
        const fileName = `receipts/${user.id}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(fileName, receiptFile);

        if (!uploadError) {
            const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(fileName);
            receipt_url = urlData?.publicUrl;
        }
    } catch (e) {
        console.warn('تعذر رفع الإيصال:', e);
    }

    // إنشاء معاملة شحن
    const { error } = await supabase.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'charge',
        amount,
        payment_method: method,
        receipt_url,
        status: 'قيد المراجعة'
    });

    if (error) { alert('❌ خطأ: ' + error.message); return; }

    alert('✅ تم إرسال طلب الشحن! سيتم مراجعته وإضافة الرصيد خلال دقائق.');
    closeDepositModal();
    loadWalletData();
};

// ===== تسجيل الخروج =====
window.handleLogout = async () => {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.replace('index.html');
    }
};