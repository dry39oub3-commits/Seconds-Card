// استيراد Supabase
import { supabase } from '../../js/supabase-config.js';

async function updateDashboardStats() {
    try {
        // 1. جلب البيانات من الجداول الثلاثة الرئيسية
        const { data: orders, error: ordersError } = await supabase.from("orders").select("*");
        const { data: users, error: usersError } = await supabase.from("users").select("*");
        const { data: products, error: productsError } = await supabase.from("products").select("*");

        if (ordersError) throw ordersError;
        if (usersError) throw usersError;
        if (productsError) throw productsError;

        let totalSales = 0;
        let completedOrdersCount = 0;

        // 2. تحليل بيانات الطلبات (المبيعات)
        orders.forEach((order) => {
            if (order.status === "completed" || order.status === "مكتمل") {
                const price = parseFloat(order.price) || 0;
                totalSales += price;
                completedOrdersCount++;
            }
        });

        // 3. تحديث واجهة المستخدم (UI)

        const salesElement = document.getElementById('total-sales');
        if (salesElement) {
            salesElement.innerText = `${new Intl.NumberFormat('ar-MR').format(totalSales)} MRU`;
        }

        const ordersElement = document.getElementById('orders-count');
        if (ordersElement) {
            ordersElement.innerText = completedOrdersCount;
        }

        const usersElement = document.getElementById('users-count');
        if (usersElement) {
            usersElement.innerText = users.length;
        }

        const productsElement = document.getElementById('products-count');
        if (productsElement) {
            productsElement.innerText = products.length;
        }

        console.log("StorCards Stats Updated ✅");

    } catch (error) {
        console.error("Error updating stats: ", error);
    }
}

// --- إدارة تسجيل الخروج ---
window.handleAdminLogout = async () => {
    if (confirm("هل أنت متأكد من تسجيل الخروج من لوحة الإدارة؟")) {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            localStorage.clear();
            window.location.href = "../login.html";
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }
};

// تشغيل الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    updateDashboardStats();

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = window.handleAdminLogout;
    }
});



(function(){
    // تطبيق الثيم المحفوظ فوراً
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    document.getElementById('theme-toggle').onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };
})();