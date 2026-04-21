import { supabase } from '../../js/supabase-config.js';

// ==================== عداد الطلبات (Bell) ====================
async function updateBell() {
    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")');

    const count = new Set((orders || []).map(o => o.order_number || o.id)).size;

    const badge = document.getElementById('orders-badge');
    if (badge) {
        badge.textContent   = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${count}) طلب جديد | ${base.split('|').pop().trim()}` : base;
}

// ==================== عداد المحافظ ====================
function updateWalletBadge(count) {
    document.querySelectorAll('a[href*="admin-wallet.html"]').forEach(link => {
        link.querySelector('.wallet-badge')?.remove();
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'wallet-badge';
            badge.textContent = count;
            badge.style.cssText = `
                background: #ef4444;
                color: white;
                border-radius: 50%;
                font-size: 10px;
                font-weight: 800;
                min-width: 17px;
                height: 17px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                margin-right: 4px;
                line-height: 1;
                vertical-align: middle;
            `;
            link.appendChild(badge);
        }
    });
}

async function fetchPendingCount() {
    const { count, error } = await supabase
        .from('wallet_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'قيد المراجعة');

    if (!error) updateWalletBadge(count || 0);
}

// ==================== تهيئة الثيم ====================
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const themeIcon = themeToggle.querySelector('i');

    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateIcon(currentTheme);

    themeToggle.addEventListener('click', () => {
        const theme    = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateIcon(newTheme);
    });

    function updateIcon(theme) {
        if (!themeIcon) return;
        if (theme === 'dark') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            themeIcon.style.color = '#fbbf24';
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            themeIcon.style.color = '#ffffff';
        }
    }
}

// ==================== DOMContentLoaded ====================
document.addEventListener('DOMContentLoaded', () => {

    // ✅ الثيم
    initTheme();

    // ✅ عداد الطلبات — تشغيل فوري
    updateBell();

    // ✅ عداد المحافظ — تشغيل فوري بعد تحميل DOM
    fetchPendingCount();

    // ✅ Realtime للطلبات
    supabase.channel('bell-orders-' + Date.now())
        .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  'orders'
        }, () => updateBell())
        .subscribe();

    // ✅ Realtime للمحافظ
    supabase.channel('bell-wallet-' + Date.now())
        .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  'wallet_transactions'
        }, () => fetchPendingCount())
        .subscribe();

    // ✅ احتياطي كل 30 ثانية
    setInterval(updateBell,        1000);
    setInterval(fetchPendingCount, 1000);
});