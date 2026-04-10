import { supabase } from './supabase-config.js';

let totalAmount = 0;
let userBalance = 0;

// --- 1. تشغيل الدوال الأساسية ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    checkAuthAndLoadData();
});

// --- 2. مراقب حالة تسجيل الدخول ومعالجة الرصيد ---
async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    // تحديث أيقونة المستخدم
    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon) userIcon.className = 'fas fa-user-check';

    // حساب الإجمالي من السلة (LocalStorage)
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);

    const totalElem = document.getElementById('checkout-total');
    if (totalElem) totalElem.textContent = `${totalAmount} MRU`;

    // جلب بيانات المستخدم من Supabase
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

// --- 3. دالة تنفيذ الدفع (خصم الرصيد وإنشاء طلب) ---
window.executePayment = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const btn = document.getElementById('confirm-payment-btn');

    if (!user || totalAmount <= 0) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري معالجة الدفع...';

    try {
        const newBalance = userBalance - totalAmount;

        // أ) تحديث الرصيد في Supabase
        const { error: updateError } = await supabase
            .from("users")
            .update({ balance: newBalance })
            .eq("id", user.id);

        if (updateError) throw updateError;

        // ب) تسجيل الطلبات في جدول "orders"
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const orders = cart.map(item => ({
            userId: user.id,
            cardName: item.name,
            cardImage: item.image || "",
            price: item.price,
            cardCode: "جاري استخراج الكود...",
            timestamp: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from("orders")
            .insert(orders);

        if (insertError) throw insertError;

        // ج) تنظيف السلة
        localStorage.removeItem('cart');

        alert("✅ تمت عملية الدفع بنجاح! شكراً لثقتك في StorCards.");
        window.location.href = "orders.html";

    } catch (error) {
        console.error("Payment Error:", error);
        alert("❌ حدث خطأ أثناء الدفع: " + error.message);
        btn.disabled = false;
        btn.innerHTML = "تأكيد الدفع الآن";
    }
};

// --- وظائف التنسيق العام (Theme & Menu) ---
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