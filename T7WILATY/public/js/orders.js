import { supabase } from './supabase-config.js';

// --- تشغيل الدوال عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    checkAuthState();
});

// --- إدارة الوضع الليلي (Dark Mode) ---
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// --- إدارة قائمة المستخدم (Dropdown) ---
function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');

    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        window.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });
    }
}

// --- مراقب حالة تسجيل الدخول (Supabase Auth) ---
async function checkAuthState() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    const userIcon = document.querySelector('#user-icon-btn i');

    if (user) {
        if (userIcon) userIcon.className = 'fas fa-user-check';
        console.log("StorCards Auth: Active User", user.id);

        if (document.getElementById('orders-list')) {
            fetchUserOrders(user.id);
        }
    } else {
        if (userIcon) userIcon.className = 'fas fa-user';
        if (window.location.pathname.includes('orders') || window.location.pathname.includes('wallet')) {
            window.location.href = "login.html";
        }
    }

    // مراقبة التغييرات في حالة الجلسة
    supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user || null;
        if (user) {
            if (userIcon) userIcon.className = 'fas fa-user-check';
        } else {
            if (userIcon) userIcon.className = 'fas fa-user';
        }
    });
}

// --- وظيفة تسجيل الخروج ---
window.handleLogout = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        localStorage.clear();
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

// --- جلب طلبات المستخدم من Supabase ---
async function fetchUserOrders(uid) {
    const ordersList = document.getElementById('orders-list');
    const noOrders = document.getElementById('no-orders');

    if (!ordersList) return;

    try {
        const { data: orders, error } = await supabase
            .from("orders")
            .select("*")
            .eq("userId", uid)
            .order("timestamp", { ascending: false });

        if (error) throw error;

        if (!orders || orders.length === 0) {
            ordersList.style.display = 'none';
            if (noOrders) noOrders.style.display = 'block';
            return;
        }

        let html = '';
        orders.forEach(order => {
            const date = order.timestamp
                ? new Date(order.timestamp).toLocaleDateString('ar-SA')
                : 'تاريخ غير معروف';

            html += `
                <div class="order-card">
                    <div class="order-header">
                        <span>رقم الطلب: #${order.id.toString().substring(0, 8)}</span>
                        <span>التاريخ: ${date}</span>
                    </div>
                    <div class="order-body">
                        <img src="${order.cardImage || 'assets/placeholder.png'}" alt="${order.cardName}">
                        <div class="card-details">
                            <h4>${order.cardName}</h4>
                            <p>السعر: ${order.price} MRU</p>
                        </div>
                    </div>
                    <div class="card-code-container">
                        <span class="code-text" id="code-${order.id}">${order.cardCode || 'جاري المعالجة'}</span>
                        <button class="copy-btn" onclick="copyCode('${order.cardCode}')">
                            <i class="fas fa-copy"></i> نسخ الكود
                        </button>
                    </div>
                </div>
            `;
        });

        ordersList.innerHTML = html;

    } catch (error) {
        console.error("Error fetching orders:", error);
        ordersList.innerHTML = '<p style="color:red; text-align:center;">حدث خطأ أثناء تحميل الطلبات.</p>';
    }
}

// دالة نسخ الكود (عالمية)
window.copyCode = (code) => {
    if (!code || code === 'undefined') return;
    navigator.clipboard.writeText(code).then(() => {
        alert("تم نسخ الكود بنجاح!");
    });
};