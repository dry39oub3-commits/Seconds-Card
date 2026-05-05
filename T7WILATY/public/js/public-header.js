import { supabase } from './supabase-config.js';

// ==================== تشغيل عند التحميل ====================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initUserIcon();
    updateCartBadge();
    initSearch();
    applyStoredSettings();
});

// ==================== الثيم ====================
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
                     style="width:32px;height:32px;border-radius:50%;object-fit:cover;
                            border:2px solid #f97316;display:block;pointer-events:none;">
                <i class="fas fa-user-check" style="display:none;"></i>
            `;
            userBtn.style.cssText = 'padding:0;background:transparent;border:none;cursor:pointer;';
        } else {
            userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
        }

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
        userBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        userBtn.title     = 'تسجيل الدخول';
        userBtn.onclick   = () => { window.location.href = 'login.html'; };
    }
}

// ==================== badge السلة ====================
function updateCartBadge() {
    const cart       = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartLink   = document.getElementById('cart-icon-link')
                    || document.querySelector('a[href="cart.html"]');
    if (!cartLink) return;

    cartLink.style.position = 'relative';
    let badge = cartLink.querySelector('.cart-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.style.cssText = `
            position:absolute; top:-8px; left:-8px;
            background:#f97316; color:white; border-radius:50%;
            width:18px; height:18px; font-size:11px;
            display:flex; align-items:center; justify-content:center;
            font-weight:bold; pointer-events:none;
        `;
        cartLink.appendChild(badge);
    }
    badge.textContent   = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

// ==================== البحث ====================
function initSearch() {
    const input  = document.getElementById('main-search');
    const btnSrh = document.querySelector('.search-bar button');
    if (!input) return;

    const doSearch = () => {
        const q = input.value.trim();
        if (!q) return;
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = `index.html?q=${encodeURIComponent(q)}`;
        } else {
            window.dispatchEvent(new CustomEvent('header-search', { detail: q }));
        }
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    btnSrh?.addEventListener('click', doSearch);

    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
        input.value = urlQ;
        window.dispatchEvent(new CustomEvent('header-search', { detail: urlQ }));
    }
}

// ==================== تطبيق الإعدادات المخزنة ====================
function applyStoredSettings() {
    const lang = localStorage.getItem('lang') || 'ar';
    const dir  = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir',  dir);
    document.documentElement.setAttribute('lang', lang);
}

// ==================== تحديث الأفاتار من الخارج ====================
window.updateHeaderAvatar = function(photoUrl) {
    const userBtn      = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (!userBtn) return;

    if (photoUrl) {
        userBtn.innerHTML = `
            <img src="${photoUrl}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"
                 style="width:32px;height:32px;border-radius:50%;object-fit:cover;
                        border:2px solid #f97316;display:block;pointer-events:none;">
            <i class="fas fa-user-check" style="display:none;"></i>
        `;
        userBtn.style.cssText = 'padding:0;background:transparent;border:none;cursor:pointer;';
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

// ==================== مراقبة حذف الحساب ====================
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        localStorage.clear();
        window.location.href = 'index.html';
    }
});