import { supabase } from './supabase-config.js';

// ==================== بناء الهيدر ====================
function buildHeader() {
    const header = document.createElement('header');
    header.className = 'main-header';
    header.innerHTML = `
        <div class="header-container">
            <a href="index.html" class="logo-link" style="text-decoration:none;">
                <div class="logo" style="display:flex; align-items:center; gap:10px;">
                    <img src="assets/Icon.png" alt="StoreCard"
                         style="height:40px; width:40px; object-fit:contain;">
                    <div style="display:flex; flex-direction:column; line-height:1.1;">
                        <span style="font-size:18px; font-weight:800; color:white;">
                            Store<span style="color:#f97316;">Card</span>
                        </span>
                    </div>
                </div>
            </a>

            <div class="search-container">
                <div class="search-bar">
                    <input type="text" id="main-search" placeholder="ابحث عن بطاقة...">
                    <button><i class="fas fa-search"></i></button>
                </div>
            </div>

            <div class="header-actions">
                <button id="theme-toggle" class="action-btn">
                    <i class="fas fa-moon"></i>
                </button>

                <a href="cart.html" class="action-btn" id="cart-icon-link" style="position:relative;">
                    <i class="fas fa-shopping-cart"></i>
                </a>

                <div class="user-menu-container">
                    <button class="action-btn" id="user-icon-btn">
                        <i class="fas fa-user-circle"></i>
                    </button>
                    <div class="dropdown-menu" id="user-dropdown">
                        <nav class="dropdown-nav">
                            <a href="orders.html"><i class="fas fa-box"></i> طلباتي</a>
                            <a href="wallet.html"><i class="fas fa-wallet"></i> المحفظة</a>
                            <a href="profile.html"><i class="fas fa-user"></i> حسابي</a>
                            <hr>
                            <button onclick="handleLogout()" class="logout-btn">
                                <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    `;

    // أضف الهيدر في أول الـ body
    document.body.insertAdjacentElement('afterbegin', header);
}

// ==================== إعداد الثيم ====================
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.onclick = (e) => {
        e.preventDefault();
        const cur  = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    };
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ==================== أيقونة المستخدم ====================
async function initUserIcon() {
    const { data: { session } } = await supabase.auth.getSession();
    const userBtn      = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (!userBtn) return;

    if (session?.user) {
        const user      = session.user;
        const avatarUrl = user.user_metadata?.avatar_url || '';

        if (avatarUrl) {
            userBtn.innerHTML = `
                <img src="${avatarUrl}"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"
                     style="width:32px; height:32px; border-radius:50%; object-fit:cover;
                            border:2px solid #f97316; display:block; pointer-events:none;">
                <i class="fas fa-user-check" style="display:none;"></i>
            `;
            userBtn.style.cssText = 'padding:0; background:transparent; border:none; cursor:pointer;';
        } else {
            userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
        }

        // dropdown
        userBtn.onclick = (e) => {
            e.stopPropagation();
            userDropdown?.classList.toggle('show');
        };

        window.addEventListener('click', (e) => {
            if (!userDropdown?.contains(e.target) && !userBtn.contains(e.target)) {
                userDropdown?.classList.remove('show');
            }
        });

    } else {
        // غير مسجل
        userBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        userBtn.title     = 'تسجيل الدخول';
        userBtn.onclick   = () => { window.location.href = 'login.html'; };
    }
}

// ==================== badge السلة ====================
function updateCartBadge() {
    const cart       = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartLink   = document.getElementById('cart-icon-link');
    if (!cartLink) return;

    let badge = cartLink.querySelector('.cart-badge');
    if (!badge) {
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
            pointer-events: none;
        `;
        cartLink.appendChild(badge);
    }

    badge.textContent  = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

// ==================== تحديث أيقونة الهيدر من الخارج ====================
window.updateHeaderAvatar = function(photoUrl) {
    const userBtn      = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (!userBtn) return;

    if (photoUrl) {
        userBtn.innerHTML = `
            <img src="${photoUrl}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"
                 style="width:32px; height:32px; border-radius:50%; object-fit:cover;
                        border:2px solid #f97316; display:block; pointer-events:none;">
            <i class="fas fa-user-check" style="display:none;"></i>
        `;
        userBtn.style.cssText = 'padding:0; background:transparent; border:none; cursor:pointer;';
    } else {
        userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
    }

    userBtn.onclick = (e) => {
        e.stopPropagation();
        userDropdown?.classList.toggle('show');
    };
};

// ==================== تسجيل الخروج ====================
window.handleLogout = async function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

// ==================== البحث ====================
function initSearch() {
    const input  = document.getElementById('main-search');
    const btnSrh = document.querySelector('.search-bar button');
    if (!input) return;

    const doSearch = () => {
        const q = input.value.trim();
        if (!q) return;
        // إذا لم تكن في index.html انتقل إليها مع query
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = `index.html?q=${encodeURIComponent(q)}`;
        } else {
            window.dispatchEvent(new CustomEvent('header-search', { detail: q }));
        }
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    btnSrh?.addEventListener('click', doSearch);

    // لو جاء من صفحة أخرى بـ query
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
        input.value = urlQ;
        window.dispatchEvent(new CustomEvent('header-search', { detail: urlQ }));
    }
}

// ==================== تشغيل الكل ====================
document.addEventListener('DOMContentLoaded', () => {
    // بناء الهيدر فقط إذا لم يكن موجوداً
    if (!document.querySelector('.main-header')) {
        buildHeader();
    }

    initTheme();
    initUserIcon();
    updateCartBadge();
    initSearch();
});