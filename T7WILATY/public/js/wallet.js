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

    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon) userIcon.className = 'fas fa-user-check';

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

    loadTransactions(user.id);
}

// ===== مساعد الحالة =====
function getStatusStyle(status) {
    const map = {
        'مكتمل':        { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)',    icon: 'fa-check-circle' },
        'مرفوض':        { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)',    icon: 'fa-times-circle' },
        'ملغي':         { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)',    icon: 'fa-ban' },
        'قيد المراجعة': { color: '#f97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.25)',   icon: 'fa-clock' },
        'قيد الانتظار': { color: '#f97316', bg: 'rgba(249,115,22,0.1)',   border: 'rgba(249,115,22,0.25)',   icon: 'fa-hourglass-half' },
        'مسترد':        { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)',  icon: 'fa-undo' },
    };
    return map[status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', icon: 'fa-circle' };
}

// ===== سجل المعاملات =====
async function loadTransactions(userId) {
    const list = document.getElementById('transactions-list');
    if (!list) return;

    const { data: walletTx } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    const { data: ordersTx } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .or('paymentMethod.eq.المحفظة,payment_method.eq.المحفظة,paymentMethod.eq.محفظة,payment_method.eq.محفظة')
        .order('created_at', { ascending: false });

    const ordersAsTx = (ordersTx || []).map(o => ({
        id:             o.id,
        user_id:        userId,
        type:           'purchase',
        amount:         (o.price || 0) * (o.quantity || 1),
        status:         o.status || 'مكتمل',
        payment_method: o.paymentMethod || o.payment_method || 'المحفظة',
        product_name:   o.product_name,
        label:          o.label,
        order_number:   o.order_number,
        reject_reason:  o.reject_reason,
        created_at:     o.created_at
    }));

    const filteredWalletTx = (walletTx || []).filter(t => {
        if (t.type === 'charge' || t.type === 'deposit') return true;
        if (t.type === 'refund' || t.payment_method === 'استرداد طلب') return true;
        if (t.type === 'withdraw' || t.type === 'purchase') return false;
        return true;
    });

    const all = [...filteredWalletTx, ...ordersAsTx]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (all.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:30px;">لا توجد عمليات بعد.</p>';
        return;
    }

    list.innerHTML = all.map(t => {
        const isCharge   = t.type === 'charge' || t.type === 'deposit';
        const isPurchase = t.type === 'purchase' || t.type === 'withdraw';
        const isOrder    = !!t.order_number;
        const isAdminEdit = t.payment_method === 'تعديل أدمن';

        const date = new Date(t.created_at).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const { color, bg, border, icon } = getStatusStyle(t.status);

        // شارة الحالة المشتركة
        const statusBadge = `
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;
                        padding-bottom:8px; border-bottom:1px solid ${color}22;">
                <i class="fas ${icon}" style="color:${color};"></i>
                <span style="color:${color}; font-weight:700; font-size:13px;">${t.status}</span>
            </div>`;

        // سبب الرفض المشترك
        const rejectBlock = t.reject_reason ? `
            <div style="margin-top:8px; background:rgba(239,68,68,0.08);
                        border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:8px 10px;">
                <div style="color:#94a3b8; font-size:11px; margin-bottom:4px;">
                    <i class="fas fa-exclamation-circle" style="color:#ef4444;"></i> سبب الرفض
                </div>
                <div style="color:#fca5a5; font-weight:600; font-size:13px;">${t.reject_reason}</div>
            </div>` : '';

        // ملاحظة التعديل
        const noteBlock = (t.note && isAdminEdit) ? `
            <div style="margin-top:8px; background:rgba(96,165,250,0.08);
                        border:1px solid rgba(96,165,250,0.3); border-radius:6px; padding:8px 10px;">
                <div style="color:#94a3b8; font-size:11px; margin-bottom:4px;">
                    <i class="fas fa-pen" style="color:#60a5fa;"></i> ملاحظة
                </div>
                <div style="color:#93c5fd; font-weight:600; font-size:13px;">${t.note}</div>
            </div>` : '';

        let extraDetails = '';

        // ===== تفاصيل الشحن =====
        if (isCharge) {
    extraDetails = `
    <div style="margin-top:8px; background:${bg};
        border:1px solid ${border}; border-radius:8px; padding:8px 12px; font-size:12px; color:#cbd5e1;">

        ${statusBadge}

        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="color:#94a3b8;">🏦 طريقة الدفع</span>
            <span style="color:#e2e8f0; font-weight:600;">${t.payment_method || '-'}</span>
        </div>

        ${t.order_number ? `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="color:#94a3b8;">🔢 رقم الطلب</span>
            <span style="color:#60a5fa; font-weight:700; font-family:monospace;">${t.order_number}</span>
        </div>` : ''}

        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="color:#94a3b8;">💰 المبلغ</span>
            <span style="color:${color}; font-weight:600;">+${t.amount.toLocaleString()} MRU</span>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="color:#94a3b8;">📅 التاريخ</span>
            <span>${date}</span>
        </div>

        ${rejectBlock}
        ${noteBlock}

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

        // ===== تفاصيل الشراء =====
        if (isPurchase) {
            const productName = t.product_name
                || (t.payment_method || '').replace('المحفظة - ', '').replace('محفظة - ', '');

            extraDetails = `
            <div style="margin-top:8px; background:${bg};
                border:1px solid ${border}; border-radius:8px; padding:8px 12px; font-size:12px; color:#cbd5e1;">

                ${statusBadge}

                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">🛍️ المنتج</span>
                    <span style="color:#f97316; font-weight:600;">${productName || '-'}</span>
                </div>

                ${t.label ? `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">🏷️ الفئة</span>
                    <span style="color:#f97316; font-weight:600;">${t.label}</span>
                </div>` : ''}

                ${t.order_number ? `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">🔢 رقم الطلب</span>
                    <span style="color:#60a5fa; font-weight:600;">${t.order_number}</span>
                </div>` : ''}

                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:#94a3b8;">📅 التاريخ</span>
                    <span>${date}</span>
                </div>

                ${rejectBlock}

                
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
                        <strong>${isCharge ? (isAdminEdit ? 'تعديل رصيد' : 'شحن رصيد') : (isOrder ? (t.product_name || 'شراء') : 'سحب')}</strong>
                        <span style="font-size:11px; color:${color}; display:flex; align-items:center; gap:4px;">
                            <i class="fas ${icon}" style="font-size:10px;"></i> ${t.status}
                        </span>
                    </div>
                </div>
                <div class="t-amount ${isCharge ? 'plus' : 'minus'}" style="color:${color};">
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
        .eq('show_in_wallet', true);

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
    navigator.clipboard.writeText(account).then(() => showToast('✅ تم نسخ رقم الحساب!'));
};

// ===== إرسال طلب الشحن =====
window.submitCharge = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const amount      = parseFloat(document.getElementById('charge-amount').value);
    const method      = document.getElementById('charge-method-selected').value;
    const receiptFile = document.getElementById('charge-receipt').files[0];

    if (!amount || amount <= 0) { showToast('⚠️ أدخل مبلغاً صحيحاً'); return; }
    if (!method)                { showToast('⚠️ اختر طريقة الدفع أولاً'); return; }
    if (!receiptFile)           { showToast('⚠️ يرجى رفع إيصال التحويل'); return; }

    let receipt_url = null;

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

    // توليد رقم طلب فريد يبدأ بـ S
    const chargeOrderNumber = `S${Math.floor(100000 + Math.random() * 900000)}`;

    const { error } = await supabase.from('wallet_transactions').insert({
        user_id:        user.id,
        type:           'charge',
        amount,
        payment_method: method,
        receipt_url,
        status:         'قيد المراجعة',
        order_number:   chargeOrderNumber
    });

    if (error) { showToast('❌ خطأ: ' + error.message); return; }

    showToast('✅ تم إرسال طلب الشحن! سيتم مراجعته وإضافة الرصيد خلال دقائق.');
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

// ===== Toast =====
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
        position: fixed;
        bottom: 28px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#ef4444' : '#22c55e'};
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 700;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        pointer-events: none;
        white-space: nowrap;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}