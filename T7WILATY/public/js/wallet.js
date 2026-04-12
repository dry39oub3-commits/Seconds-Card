// دالة تبديل الوضع الداكن
function setupDarkMode() {
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;
    const icon = themeBtn.querySelector('i');

    // التحقق من وجود خيار محفوظ مسبقاً في المتصفح
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        body.classList.add('dark-mode');
        icon.classList.replace('fa-moon', 'fa-sun');
    }

    themeBtn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        
        // تحديث الأيقونة وحفظ الخيار
        if (body.classList.contains('dark-mode')) {
            icon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('theme', 'dark');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('theme', 'light');
        }
    });
}

// دالة التحكم في القائمة المنسدلة للمستخدم
function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const dropdown = document.getElementById('user-dropdown');

    userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    // إغلاق القائمة عند الضغط في أي مكان آخر
    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });
}

// محاكاة جلب بيانات العمليات (يمكنك ربطها بـ Supabase لاحقاً)
function loadTransactions() {
    const listContainer = document.getElementById('transactions-list');
    
    // مثال لبيانات قادمة من قاعدة البيانات
    const transactions = [
        { title: "شحن رصيد (Bankily)", date: "2026-04-12", amount: 500, type: "plus" },
        { title: "شراء بطاقة Free Fire", date: "2026-04-11", amount: -200, type: "minus" }
    ];

    if (transactions.length === 0) {
        listContainer.innerHTML = '<p class="empty-msg">لا توجد عمليات مضافة بعد.</p>';
        return;
    }

    listContainer.innerHTML = transactions.map(t => `
        <div class="transaction-item">
            <div class="t-info">
                <div class="t-icon ${t.type}">
                    <i class="fas ${t.type === 'plus' ? 'fa-arrow-down' : 'fa-shopping-bag'}"></i>
                </div>
                <div class="t-details">
                    <strong>${t.title}</strong>
                    <span>${t.date}</span>
                </div>
            </div>
            <div class="t-amount ${t.type}">
                ${t.type === 'plus' ? '+' : ''} ${t.amount.toLocaleString()} MRU
            </div>
        </div>
    `).join('');
}

// تشغيل الدوال عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    setupDarkMode();
    setupUserMenu();
    loadTransactions();
});

// دالة تسجيل الخروج
window.handleLogout = function() {
    if(confirm("هل أنت متأكد من تسجيل الخروج؟")) {
        // منطق تسجيل الخروج هنا
        window.location.href = 'login.html';
    }
}

const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// --- 2. إدارة الوضع الليلي (Dark Mode) ---
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.onclick = (e) => {
        e.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    };
}