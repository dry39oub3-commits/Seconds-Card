import { supabase } from './supabase-config.js';

let totalAmount = 0;
let userBalance = 0;
let selectedPaymentMethod = null;
let cart = []; // ← متغير عام

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    checkAuthAndLoadData();
    loadPaymentMethods();

    document.getElementById('confirm-payment-btn')?.addEventListener('click', executePayment);

    document.getElementById('receipt-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('receipt-preview');
            preview.src = ev.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
});

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
    if (infoDiv && accountElem) {
        infoDiv.style.display = 'block';
        accountElem.textContent = account || 'غير متوفر';
    }

    const receiptSection = document.getElementById('receipt-upload-section');
    if (receiptSection) receiptSection.style.display = 'block';
};

async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon && user) userIcon.className = 'fas fa-user-check';

    cart = JSON.parse(localStorage.getItem('cart')) || []; // ← تحديث المتغير العام
    totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);

    const totalElem = document.getElementById('checkout-total');
    if (totalElem) totalElem.textContent = `${totalAmount} MRU`;

    const totalDisplay = document.getElementById('checkout-total-display');
    if (totalDisplay) totalDisplay.textContent = `${totalAmount} MRU`;

    if (!user) return;

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

        if (totalAmount > 0) {
            if (confirmBtn) confirmBtn.disabled = false;
        } else {
            if (statusMsg) statusMsg.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ سلتك فارغة!</p>`;
            if (confirmBtn) confirmBtn.disabled = true;
        }
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

async function executePayment() {
    if (!selectedPaymentMethod) {
        alert('⚠️ الرجاء اختيار طريقة الدفع أولاً!');
        return;
    }

    const receiptFile = document.getElementById('receipt-input')?.files[0];
    if (!receiptFile) {
        alert('⚠️ الرجاء رفع إيصال الدفع!');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const btn = document.getElementById('confirm-payment-btn');

    if (totalAmount <= 0) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري معالجة الدفع...';

    try {
        const filePath = `receipts/${Date.now()}`;
        const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, receiptFile);

        let receiptUrl = '';
        if (!uploadError) {
            const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
            receiptUrl = data.publicUrl;
        }

        const generateOrderNumber = () => `S${Math.floor(100000 + Math.random() * 900000)}`;

        const orders = cart.map(item => ({
            order_number: generateOrderNumber(),
            customer_name: user?.user_metadata?.full_name || 'مستخدم',
            customer_phone: user?.email || '',
            product_id: item.productId || null,
            product_name: item.name,
            label: item.label || null,
            price: item.price,
            quantity: item.quantity || 1,
            status: 'قيد الانتظار',
            receiptUrl: receiptUrl,
            paymentMethod: selectedPaymentMethod.name
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
}

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