import { supabase } from './supabase-config.js';

let totalAmount = 0;
let userBalance = 0;
let selectedPaymentMethod = null;
let cart = [];

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    checkAuthAndLoadData();

    document.getElementById('confirm-payment-btn')?.addEventListener('click', executePayment);

    document.getElementById('receipt-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('receipt-preview');
            if (preview) {
                preview.src = ev.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    });
});

// ===== جلب بوابات الدفع =====
async function loadPaymentMethods() {
    const { data: methods, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    const list = document.getElementById('payment-methods-list');
    if (!list) return;

    const walletCard = `
        <div class="payment-method-card" id="pm-wallet" onclick="selectMethod('wallet', '', 'المحفظة')"
            style="cursor:pointer; border:2px solid #334155; border-radius:12px; padding:12px 18px;
                   display:flex; flex-direction:column; align-items:center; gap:8px; min-width:120px; transition:0.3s;">
            <i class="fas fa-wallet" style="font-size:36px; color:#22c55e;"></i>
            <span style="font-size:14px; font-weight:bold;">محفظتي</span>
            <span style="font-size:12px; color:#94a3b8;">رصيد: ${userBalance} MRU</span>
        </div>
    `;

    if (error || !methods || methods.length === 0) {
        list.innerHTML = walletCard;
        return;
    }

    list.innerHTML = walletCard + methods.map(m => `
        <div class="payment-method-card" id="pm-${m.id}" onclick="selectMethod('${m.id}', '${m.account_number}', '${m.name}')"
            style="cursor:pointer; border:2px solid #334155; border-radius:12px; padding:12px 18px;
                   display:flex; flex-direction:column; align-items:center; gap:8px; min-width:120px; transition:0.3s;">
            <img src="${m.logo_url || ''}" alt="${m.name}" style="width:50px; height:50px; object-fit:contain;" onerror="this.style.display='none'">
            <span style="font-size:14px; font-weight:bold;">${m.name}</span>
        </div>
    `).join('');
}

// ===== اختيار طريقة الدفع =====
window.selectMethod = function(id, account, name) {
    document.querySelectorAll('.payment-method-card').forEach(c => {
        c.style.borderColor = '#334155';
        c.style.background = '';
    });

    const card = document.getElementById(`pm-${id}`);
    if (card) {
        card.style.borderColor = '#f97316';
        card.style.background = 'rgba(249,115,22,0.1)';
    }

    selectedPaymentMethod = { id, account, name };

    const infoDiv = document.getElementById('selected-method-info');
    const accountElem = document.getElementById('selected-account');
    const receiptSection = document.getElementById('receipt-upload-section');
    const statusMsg = document.getElementById('payment-status-msg');

    if (id === 'wallet') {
        if (infoDiv) infoDiv.style.display = 'none';
        if (receiptSection) receiptSection.style.display = 'none';
        if (statusMsg) {
            if (userBalance >= totalAmount) {
                statusMsg.innerHTML = `<p style="color:#22c55e;">✅ رصيدك كافٍ — سيتم الخصم فوراً (${userBalance} MRU)</p>`;
            } else {
                statusMsg.innerHTML = `<p style="color:#ef4444;">⚠️ رصيدك غير كافٍ (${userBalance} MRU) — اشحن محفظتك أو اختر طريقة دفع أخرى</p>`;
            }
        }
    } else {
        if (infoDiv && accountElem) {
            infoDiv.style.display = 'block';
            accountElem.textContent = account || 'غير متوفر';
        }
        if (receiptSection) receiptSection.style.display = 'block';
        if (statusMsg) statusMsg.innerHTML = '';
    }
};

// ===== تحميل البيانات =====
async function executePayment() {
    if (!selectedPaymentMethod) {
        alert('⚠️ الرجاء اختيار طريقة الدفع أولاً!');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const btn = document.getElementById('confirm-payment-btn');

    if (totalAmount <= 0) return;

    // ===== طبقة أمان: فحص الحظر قبل الدفع =====
    const { data: userCheck } = await supabase
        .from('users')
        .select('is_blocked')
        .eq('id', user.id)
        .single();

    if (userCheck?.is_blocked) {
        alert('🚫 حسابك محظور، لا يمكنك إتمام الدفع');
        return;
    }
    // ==========================================

    const generateOrderNumber = () => `S${Math.floor(100000 + Math.random() * 900000)}`;

    // باقي الكود بدون تغيير...

// ===== Dark Mode =====
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

// ===== User Menu =====
function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        window.addEventListener('click', () => userDropdown.classList.remove('show'));
    }
}

// ===== Logout =====
window.handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        localStorage.clear();
        window.location.href = "index.html";
    }
};

// ===== Auth Check =====
async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        localStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.replace('login.html');
    }
}

requireAuth();