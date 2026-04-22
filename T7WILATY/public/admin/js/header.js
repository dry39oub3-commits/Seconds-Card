import { supabase } from '../../js/supabase-config.js';

// ===== MOBILE DRAWER =====
document.addEventListener('DOMContentLoaded', function () {

    document.body.insertAdjacentHTML('afterbegin', `
        <div class="mobile-nav-overlay" id="mobile-overlay"></div>
        <div class="mobile-nav-drawer" id="mobile-drawer">
            <div class="drawer-header">
                <div style="display:flex;align-items:center;gap:8px;">
                    <img src="../assets/logo.png" style="height:32px;width:32px;object-fit:contain;">
                    <span style="font-size:16px;font-weight:800;color:white;">Seconds<span style="color:#f97316;">Card</span></span>
                </div>
                <button class="drawer-close" id="drawer-close"><i class="fas fa-times"></i></button>
            </div>
            <nav class="drawer-nav">
                <ul class="drawer-nav-list">
                    <li><a href="dashboard.html"        class="nav-link"><i class="fas fa-tachometer-alt"></i> الرئيسية</a></li>
                    <li><a href="Slider-manager.html"   class="nav-link"><i class="fas fa-chart-line"></i> السلايدر</a></li>
                    <li><a href="admin-wallet.html"     class="nav-link"><i class="fas fa-wallet"></i> المحافظ</a></li>
                    <li><a href="payment-methods.html"  class="nav-link"><i class="fas fa-credit-card"></i> الدفع</a></li>
                    <li><a href="orders.html"           class="nav-link"><i class="fas fa-shopping-cart"></i> الطلبات</a></li>
                    <li><a href="products-manager.html" class="nav-link"><i class="fas fa-box-open"></i> المنتجات</a></li>
                    <li><a href="stocks.html"           class="nav-link"><i class="fas fa-layer-group"></i> المخزون</a></li>
                    <li><a href="completed-orders.html" class="nav-link"><i class="fas fa-check-double"></i> الطلبات المكتملة</a></li>
                    <li><a href="users-manager.html"    class="nav-link"><i class="fas fa-users"></i> المستخدمون</a></li>
                </ul>
            </nav>
            <div class="drawer-footer">
                <button class="logout-btn" id="logoutBtn-mobile" style="width:100%;justify-content:center;">
                    <i class="fas fa-sign-out-alt"></i> <span>تسجيل الخروج</span>
                </button>
            </div>
        </div>
    `);

    // زر الهامبرغر
    const headerContainer = document.querySelector('.header-container');
    if (headerContainer && !document.getElementById('hamburger-btn')) {
        const hamburger = document.createElement('button');
        hamburger.className = 'hamburger-btn';
        hamburger.id = 'hamburger-btn';
        hamburger.setAttribute('aria-label', 'القائمة');
        hamburger.innerHTML = '<span></span><span></span><span></span>';
        headerContainer.appendChild(hamburger);
    }

    const btn      = document.getElementById('hamburger-btn');
    const drawer   = document.getElementById('mobile-drawer');
    const overlay  = document.getElementById('mobile-overlay');
    const closeBtn = document.getElementById('drawer-close');

    if (!btn || !drawer || !overlay) return;

    const openDrawer = () => {
        drawer.classList.add('open');
        overlay.classList.add('open');
        btn.classList.add('open');
        document.body.style.overflow = 'hidden';
    };
    const shutDrawer = () => {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        btn.classList.remove('open');
        document.body.style.overflow = '';
    };

    btn.addEventListener('click', () =>
        drawer.classList.contains('open') ? shutDrawer() : openDrawer()
    );
    if (closeBtn) closeBtn.addEventListener('click', shutDrawer);
    overlay.addEventListener('click', shutDrawer);
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', shutDrawer));

    // الرابط النشط في الـ Drawer
    const currentPage = window.location.pathname.split('/').pop();
    drawer.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href')?.split('/').pop() === currentPage)
            link.classList.add('active');
    });

    // ✅ زر الخروج في الـ Drawer
    document.getElementById('logoutBtn-mobile')?.addEventListener('click', handleLogout);
});

// ==================== الصفحة النشطة في الهيدر ====================
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href')?.split('/').pop();
        link.classList.toggle('active', href === currentPage);
    });
}
document.addEventListener('DOMContentLoaded', setActiveNavLink);

// ==================== زر الخروج الرئيسي ====================
async function handleLogout() {
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.warn('signOut error:', e);
    }
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // زر الخروج في الهيدر (كل الصفحات)
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
});

// ==================== Badge المحافظ ====================
function updateBadgeUI(count) {
    document.querySelectorAll('a[href="admin-wallet.html"]').forEach(link => {
        link.querySelector('.wallet-badge')?.remove();
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'wallet-badge';
            badge.textContent = count;
            badge.style.cssText = `
                background:#ef4444; color:white; border-radius:50%;
                font-size:10px; font-weight:800; min-width:17px; height:17px;
                display:inline-flex; align-items:center; justify-content:center;
                padding:0 4px; margin-right:4px; line-height:1; flex-shrink:0;
            `;
            link.appendChild(badge);
        }
    });
}

async function loadWalletPendingBadge() {
    try {
        const { count, error } = await supabase
            .from('wallet_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'قيد المراجعة');

        if (!error) updateBadgeUI(count || 0);

        supabase
            .channel('wallet-pending-realtime')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'wallet_transactions'
            }, async () => {
                const { count: fresh } = await supabase
                    .from('wallet_transactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'قيد المراجعة');
                updateBadgeUI(fresh || 0);
            })
            .subscribe();

    } catch (err) {
        console.warn('wallet badge error:', err.message);
    }
}

document.addEventListener('DOMContentLoaded', loadWalletPendingBadge);