import { supabase } from './supabase-config.js';

// --- 1. تشغيل الدوال الأساسية عند التحميل ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    displayProducts();
    updateCartBadge();
    checkUserIcon();
});



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

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// --- 3. إدارة قائمة المستخدم ---
function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');

    if (!userBtn || !userDropdown) return;

    userBtn.onclick = (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
    };

    window.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
}

// دالة تسجيل الخروج العامة
window.handleLogout = async function() {
    if (confirm("هل تريد تسجيل الخروج؟")) {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = 'login.html';
        } else {
            console.error("Logout Error:", error);
        }
    }
};

// --- 4. جلب وعرض المنتجات من Supabase ---
async function displayProducts() {
    const cardsGrid = document.getElementById('cards-grid');
    if (!cardsGrid) return;

    const { data: products, error } = await supabase
        .from("products")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error("Supabase Error:", error);
        cardsGrid.innerHTML = '<p class="error-msg">حدث خطأ في جلب البيانات.</p>';
        return;
    }

    cardsGrid.innerHTML = "";

    if (!products || products.length === 0) {
        cardsGrid.innerHTML = '<p class="no-products">لا توجد بطاقات متاحة حالياً.</p>';
        return;
    }

    products.forEach((product) => {
        let minPrice = "غير متوفر";
        if (product.prices && Array.isArray(product.prices) && product.prices.length > 0) {
            const pricesArray = product.prices
                .map(p => parseFloat(p.value))
                .filter(v => !isNaN(v));
            if (pricesArray.length > 0) {
                minPrice = Math.min(...pricesArray);
            }
        }

        const cardHTML = `
            <div class="card-item" onclick="window.location.href='product-details.html?id=${product.id}'" style="cursor: pointer;">
                <div class="card-image">
                    <img src="${product.image || 'assets/placeholder.png'}" alt="${product.name}" onerror="this.src='assets/placeholder.png'">
                </div>
                <div class="card-info">
                    <h3>${product.name || 'منتج بدون اسم'}</h3>
                    <p class="price-start">يبدأ من: <span>${minPrice} MRU</span></p>
                    <button class="view-btn">عرض الفئات <i class="fas fa-chevron-left"></i></button>
                </div>
            </div>
        `;
        cardsGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    let badge = document.querySelector('.cart-badge');
    const cartIcon = document.querySelector('a[href="cart.html"]');
    
    if (!cartIcon) return;
    
    if (!badge) {
        cartIcon.style.position = 'relative';
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.style.cssText = `
            position: absolute;
            top: -8px;
            left: -8px;
            background: #f97316;
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        `;
        cartIcon.appendChild(badge);
    }
    
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}
async function checkUserIcon() {
    const { data: { session } } = await supabase.auth.getSession();
    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon && session?.user) {
        userIcon.className = 'fas fa-user-check';
    }
}