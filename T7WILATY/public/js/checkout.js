import { supabase } from './supabase-config.js';

let totalAmount = 0;
let userBalance = 0;
let selectedPaymentMethod = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    checkAuthAndLoadData();
    loadPaymentMethods();
});

// --- جلب طرق الدفع ---
async function loadPaymentMethods() {
    const { data: methods, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    const list = document.getElementById('payment-methods-list');
    if (error || !methods || methods.length === 0) {
        list.innerHTML = '<p style="color:#888;">لا توجد طرق دفع متاحة حالياً.</p>';
        return;
    }

    list.innerHTML = methods.map(m => `
        <div class="payment-method-card" id="pm-${m.id}" onclick="selectMethod('${m.id}', '${m.account_number}', '${m.name}')"
            style="cursor:pointer; border:2px solid #334155; border-radius:12px; padding:12px 18px; display:flex; flex-direction:column; align-items:center; gap:8px; min-width:120px; transition:0.3s;">
            <img src="${m.logo_url || ''}" alt="${m.name}" style="width:50px; height:50px; object-fit:contain;" onerror="this.style.display='none'">
            <span style="font-size:14px; font-weight:bold;">${m.name}</span>
        </div>
    `).join('');
}

window.selectMethod = function(id, account, name) {
    // إزالة التحديد السابق
    document.querySelectorAll('.payment-method-card').forEach(c => {
        c.style.borderColor = '#334155';
        c.style.background = '';
    });

    // تحديد الجديد
    const card = document.getElementById(`pm-${id}`);
    if (card) {
        card.style.borderColor = '#f97316';
        card.style.background = 'rgba(249,115,22,0.1)';
    }

    selectedPaymentMethod = { id, account, name };

    // عرض رقم الحساب
    const infoDiv = document.getElementById('selected-method-info');
    const accountElem = document.getElementById('selected-account');
    if (infoDiv && accountElem) {
        infoDiv.style.display = 'block';
        accountElem.textContent = account || 'غير متوفر';
    }
};

// --- مراقب حالة تسجيل الدخول ---
async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon) userIcon.className = 'fas fa-user-check';

    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);

    const totalElem = document.getElementById('checkout-total');
    if (totalElem) totalElem.textContent = `${totalAmount} MRU`;

    const totalDisplay = document.getElementById('checkout-total-display');
    if (totalDisplay) totalDisplay.textContent = `${totalAmount} MRU`;

    try {
        const { data: userData, error } = await supabase
            .from("users")
            .select("balance")
            .eq("id", user.id)
            .single();

        if (error) throw error;

        userBalance = userData?.balance || 0;

        const balanceElem = document.getElementById('current-wallet-balance');
        if (balanceElem) balanceElem.textContent = `${userBalance} MRU`;

        const confirmBtn = document.getElementById('confirm-payment-btn');
        const statusMsg = document.getElementById('payment-status-msg');

        if (userBalance >= totalAmount && totalAmount > 0) {
            if (confirmBtn) confirmBtn.disabled = false;
        } else {
            if (statusMsg) {
                statusMsg.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ رصيدك غير كافٍ (${userBalance} MRU)، يرجى شحن المحفظة.</p>`;
            }
            if (confirmBtn) confirmBtn.disabled = true;
        }
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

// --- تنفيذ الدفع ---
window.executePayment = async () => {
    if (!selectedPaymentMethod) {
        alert('⚠️ الرجاء اختيار طريقة الدفع أولاً!');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const btn = document.getElementById('confirm-payment-btn');

    if (!user || totalAmount <= 0) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري معالجة الدفع...';

    try {
        const newBalance = userBalance - totalAmount;

        const { error: updateError } = await supabase
            .from("users")
            .update({ balance: newBalance })
            .eq("id", user.id);

        if (updateError) throw updateError;

        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const orders = cart.map(item => ({
            userId: user.id,
            cardName: item.name,
            cardImage: item.image || "",
            price: item.price,
            cardCode: "جاري استخراج الكود...",
            paymentMethod: selectedPaymentMethod.name,
            timestamp: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from("orders")
            .insert(orders);

        if (insertError) throw insertError;

        localStorage.removeItem('cart');
        alert("✅ تمت عملية الدفع بنجاح!");
        window.location.href = "orders.html";

    } catch (error) {
        console.error("Payment Error:", error);
        alert("❌ حدث خطأ: " + error.message);
        btn.disabled = false;
        btn.innerHTML = "تأكيد الدفع الآن";
    }
};

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

window.handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        localStorage.clear();
        window.location.href = "index.html";
    }
};