// admin/js/admin-guard.js
import { supabase } from '../../js/supabase-config.js';

const PAGE_PERM_MAP = {
    'dashboard.html':            'view_stats',
    'orders.html':               'approve_orders',
    'completed-orders.html':     'view_completed',
    'stocks.html':               'manage_stock',
    'admin-wallet.html':         'view_wallets',
    'products-manager.html':     'manage_products',
    'product-descriptions.html': 'manage_products',
    'addcard.html':              'manage_products',
    'Slider-manager.html':       'manage_slider',
    'payment-methods.html':      'manage_payments',
    'users-manager.html':        'manage_users',
    'staff-manager.html':        'manage_users',
    'admin-chat.html':           'chat_support',
};

// dashboard.html مفتوح للجميع — لكن محتواه يتحكم فيه view_stats

async function initGuard() {
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'login.html') return;

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.replace('login.html');
        return;
    }

    const { data: u, error } = await supabase
        .from('users')
        .select('is_admin, is_staff, full_name, staff_permissions')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error('admin-guard error:', error.message);
        return;
    }

    // ليس أدمن ولا عامل → خروج
    if (!u?.is_admin && !u?.is_staff) {
        await supabase.auth.signOut();
        window.location.replace('login.html');
        return;
    }

    // تخزين البيانات عالمياً
    window.CURRENT_USER      = session.user;
    window.IS_ADMIN          = u?.is_admin === true;
    window.IS_STAFF          = u?.is_staff === true;
    window.STAFF_NAME        = u?.full_name || session.user.email;
    window.STAFF_PERMISSIONS = u?.staff_permissions || [];

    window.hasPerm = (perm) => {
        if (window.IS_ADMIN) return true;
        return Array.isArray(window.STAFF_PERMISSIONS) && window.STAFF_PERMISSIONS.includes(perm);
    };

    // فحص صلاحية الصفحة الحالية — للعامل فقط
    if (!window.IS_ADMIN) {
        const required = PAGE_PERM_MAP[currentPage];
        if (required && !window.hasPerm(required)) {
            window.location.replace('403.html');
            return;
        }
    }

    // تطبيق القيود على الواجهة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyRestrictions);
    } else {
        applyRestrictions();
    }
}

function applyRestrictions() {
    if (window.IS_ADMIN) return;

    // قفل روابط الـ navbar المحظورة
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        const page     = href.split('/').pop().split('?')[0];
        const required = PAGE_PERM_MAP[page];
        if (required && !window.hasPerm(required)) {
            link.style.opacity = '0.4';
            link.style.cursor  = 'not-allowed';
            link.title         = 'ليس لديك صلاحية للوصول';
            link.addEventListener('click', e => {
                e.preventDefault();
                window.location.href = '403.html';
            });
        }
    });

    // إخفاء زر الدردشة
    if (!window.hasPerm('chat_support')) {
        document.getElementById('admin-chat-float-btn')?.remove();
    }

    // شارة اسم العامل
    const userActions = document.querySelector('.user-actions');
    if (userActions && !document.getElementById('staff-badge')) {
        const badge = document.createElement('span');
        badge.id = 'staff-badge';
        badge.style.cssText = `
            background:rgba(59,130,246,0.15); color:#60a5fa;
            border:1px solid rgba(59,130,246,0.3);
            padding:4px 12px; border-radius:20px;
            font-size:12px; font-weight:700; margin-left:10px;
        `;
        badge.innerHTML = `👷 ${window.STAFF_NAME}`;
        userActions.insertBefore(badge, userActions.firstChild);
    }
}

initGuard();