import { supabase } from './supabase-config.js';

// ==================== تشغيل عند التحميل ====================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initUserIcon();
    await updateCartBadge();
    initSearch();
    applyStoredSettings();
    subscribeToOrderUpdates();
    initLastSeen(); // ✅
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
async function updateCartBadge() {
    const cartLink = document.getElementById('cart-icon-link')
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

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { badge.style.display = 'none'; return; }

        const { data: cart } = await supabase
            .from('carts')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .single();

        if (!cart) { badge.style.display = 'none'; return; }

        const { data: items } = await supabase
            .from('cart_items')
            .select('quantity')
            .eq('cart_id', cart.id);

        const total = (items || []).reduce((s, i) => s + (i.quantity || 1), 0);
        badge.textContent   = total;
        badge.style.display = total > 0 ? 'flex' : 'none';

    } catch {
        badge.style.display = 'none';
    }
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

// ==================== آخر ظهور ====================
async function initLastSeen() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const updateLastSeen = async () => {
        await supabase.from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', session.user.id)
    }

    await updateLastSeen()
    setInterval(updateLastSeen, 60000) // كل دقيقة

    // تحديث عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => {
        navigator.sendBeacon && supabase.from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', session.user.id)
    })
}

// ==================== إشعارات الطلبات للعميل ====================
async function subscribeToOrderUpdates() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const userId = session.user.id

    supabase.channel(`orders-${userId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const order  = payload.new
            const status = order.status

            if (status === 'مكتمل') {
                showCustomerNotification({
                    title: '✅ تم إكمال طلبك!',
                    body:  `${order.product_name} ${order.label ? `(${order.label})` : ''}`,
                    code:  order.card_code,
                    color: '#22c55e'
                })
            } else if (status === 'ملغي') {
                showCustomerNotification({
                    title: '❌ تم رفض طلبك',
                    body:  `${order.product_name} — السبب: ${order.reject_reason || 'غير محدد'}`,
                    color: '#ef4444'
                })
            } else if (status === 'مسترد') {
                showCustomerNotification({
                    title: '↩️ تم استرداد طلبك',
                    body:  `${order.product_name} — ${(order.price || 0) * (order.quantity || 1)} MRU`,
                    color: '#f59e0b'
                })
            }
        })
        .subscribe()
}

function showCustomerNotification({ title, body, code, color }) {
    document.getElementById('_customer-notif')?.remove()

    const notif = document.createElement('div')
    notif.id = '_customer-notif'
    notif.style.cssText = `
        position: fixed; top: 20px; left: 50%;
        transform: translateX(-50%);
        background: #1e293b; border: 2px solid ${color};
        border-radius: 16px; padding: 20px 24px;
        min-width: 320px; max-width: 420px;
        z-index: 999999; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        font-family: 'Tajawal', sans-serif;
        animation: notifSlideDown 0.4s ease; direction: rtl;
    `

    notif.innerHTML = `
        <style>
            @keyframes notifSlideDown {
                from { opacity:0; transform:translateX(-50%) translateY(-20px); }
                to   { opacity:1; transform:translateX(-50%) translateY(0); }
            }
        </style>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-size:16px; font-weight:800; color:${color};">${title}</span>
            <button onclick="document.getElementById('_customer-notif').remove()"
                style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px;">✕</button>
        </div>
        <div style="font-size:13px; color:#e2e8f0; margin-bottom:${code ? '12px' : '0'};">${body}</div>
        ${code ? `
        <div style="background:#0f172a; border:1px solid ${color}; border-radius:10px; padding:12px; margin-top:8px;">
            <div style="font-size:11px; color:#94a3b8; margin-bottom:6px;">🔑 الكود:</div>
            <div style="font-family:monospace; font-size:15px; color:${color}; font-weight:700; letter-spacing:1px;">
                ${code.split('\n').join('<br>')}
            </div>
            <button onclick="navigator.clipboard.writeText(this.dataset.code); this.innerHTML='✅ تم النسخ!'; setTimeout(() => this.innerHTML='📋 نسخ الكود', 2000);"
                data-code="${code.replace(/"/g, '&quot;')}"
                style="width:100%; margin-top:10px; padding:8px; background:${color};
                       color:white; border:none; border-radius:8px; cursor:pointer;
                       font-size:13px; font-weight:700; font-family:'Tajawal',sans-serif;">
                📋 نسخ الكود
            </button>
        </div>` : ''}
        <div style="margin-top:12px;">
            <a href="orders.html" style="display:block; text-align:center; padding:8px;
               background:rgba(249,115,22,0.15); color:#f97316; border:1px solid #f97316;
               border-radius:8px; text-decoration:none; font-size:13px; font-weight:700;">
                📋 عرض الطلبات
            </a>
        </div>
    `

    document.body.appendChild(notif)

    if (!code) {
        setTimeout(() => {
            notif.style.opacity = '0'
            notif.style.transition = 'opacity 0.4s'
            setTimeout(() => notif?.remove(), 400)
        }, 8000)
    }

    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/assets/Icon.png' })
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission()
    }
}