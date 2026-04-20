import { supabase } from '../../js/supabase-config.js';

async function updateBell() {
    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")');

    // ✅ احسب المجموعات الفريدة بنفس طريقة orders.js
    const count = new Set((orders || []).map(o => o.order_number || o.id)).size;

    const badge = document.getElementById('orders-badge');
    if (badge) {
        badge.textContent   = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    const base = document.title.replace(/^\(\d+\)\s*/, ''); // احذف العداد القديم
    document.title = count > 0 ? `(${count}) طلب جديد | ${base.split('|').pop().trim()}` : base;
}

document.addEventListener('DOMContentLoaded', () => {
    updateBell();

    // ✅ Realtime فوري بدون filter
    supabase.channel('bell-orders-' + Date.now())
        .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  'orders'
        }, () => {
            updateBell();
        })
        .subscribe();

    // ✅ احتياطي كل 30 ثانية فقط — ليس كل ثانية
    setInterval(updateBell, 1000);
});


document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');

    // 1. جلب الثيم المحفوظ أو استخدام "النهاري" كافتراضي
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // 2. تطبيق الثيم عند التحميل
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateIcon(currentTheme);

    // 3. مستمع الأحداث عند الضغط على الزر
    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = (theme === 'dark') ? 'light' : 'dark';

        // تغيير السمة في الـ HTML
        document.documentElement.setAttribute('data-theme', newTheme);
        // حفظ الاختيار في التخزين المحلي
        localStorage.setItem('theme', newTheme);
        // تحديث الأيقونة
        updateIcon(newTheme);
    });

    // دالة لتحديث شكل الأيقونة
    function updateIcon(theme) {
        if (theme === 'dark') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            themeIcon.style.color = '#fbbf24'; // لون أصفر للشمس
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            themeIcon.style.color = '#ffffff';
        }
    }
});



// ==================== عداد المحافظ في الهيدر ====================
 
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
 
// ✅ جلب العداد فور تحميل الصفحة
fetchPendingCount();
 
// ✅ مراقبة realtime — يُحدَّث العداد فوراً عند أي تغيير
supabase
    .channel('wallet-badge-realtime')
    .on('postgres_changes', {
        event:  '*',           // INSERT أو UPDATE أو DELETE
        schema: 'public',
        table:  'wallet_transactions'
    }, () => {
        // أي تغيير في الجدول → أعد جلب العداد
        fetchPendingCount();
    })
    .subscribe();