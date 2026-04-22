import { supabase } from '../../js/supabase-config.js';

const fmt  = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const fmtD = (n) => parseFloat(n).toFixed(2);

async function loadDashboardStats() {
    const [
        { data: orders  },
        { data: users   },
        { data: stocks  },
        { data: walletTx},
        { data: products},
    ] = await Promise.all([
        supabase.from('orders').select('id, status, price, quantity, created_at, cost_price, paymentMethod, payment_method, auto_approved'),
        supabase.from('users').select('id, created_at, balance'),
        supabase.from('stocks').select('id, status, price_value, cost_per_card_usd, product_name, price_label, created_at, sold_at'),
        supabase.from('wallet_transactions').select('id, type, amount, status, created_at, payment_method'),
        supabase.from('products').select('id, name'),
    ]);

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week  = new Date(today); week.setDate(today.getDate() - 7);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed  = (orders || []).filter(o => o.status === 'مكتمل');
    const pending    = (orders || []).filter(o => o.status !== 'مكتمل' && o.status !== 'ملغي' && o.status !== 'مسترد');
    const cancelled  = (orders || []).filter(o => o.status === 'ملغي');
    const refunded   = (orders || []).filter(o => o.status === 'مسترد');

    const totalRevenue = completed.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);
    const totalCost    = completed.reduce((s, o) => s + (o.cost_price || 0) * 43 * (o.quantity || 1), 0);
    const totalProfit  = totalRevenue - totalCost;

    const todayOrders  = completed.filter(o => new Date(o.created_at) >= today);
    const weekOrders   = completed.filter(o => new Date(o.created_at) >= week);
    const monthOrders  = completed.filter(o => new Date(o.created_at) >= month);

    const todayRevenue = todayOrders.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);
    const weekRevenue  = weekOrders.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);
    const monthRevenue = monthOrders.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);

    const autoApproved   = completed.filter(o => o.auto_approved).length;
    const manualApproved = completed.filter(o => !o.auto_approved).length;

    const paymentMap = {};
    completed.forEach(o => {
        const pm = o.paymentMethod || o.payment_method || 'غير محدد';
        if (!paymentMap[pm]) paymentMap[pm] = { count: 0, revenue: 0 };
        paymentMap[pm].count++;
        paymentMap[pm].revenue += (o.price || 0) * (o.quantity || 1);
    });

    const availableStock = (stocks || []).filter(s => s.status === 'available');
    const soldStock      = (stocks || []).filter(s => s.status === 'sold');
    const stockValue     = availableStock.reduce((s, c) => s + (c.price_value || 0), 0);
    const stockCostValue = availableStock.reduce((s, c) => s + (c.cost_per_card_usd || 0) * 43, 0);
    const soldToday      = soldStock.filter(s => s.sold_at && new Date(s.sold_at) >= today).length;
    const soldWeek       = soldStock.filter(s => s.sold_at && new Date(s.sold_at) >= week).length;

    const stockByProduct = {};
    availableStock.forEach(s => {
        const key = `${s.product_name} (${s.price_label})`;
        stockByProduct[key] = (stockByProduct[key] || 0) + 1;
    });

    const totalUsers    = (users || []).length;
    const usersWithBal  = (users || []).filter(u => u.balance > 0).length;
    const totalBalances = (users || []).reduce((s, u) => s + (u.balance || 0), 0);
    const newUsersToday = (users || []).filter(u => new Date(u.created_at) >= today).length;
    const newUsersWeek  = (users || []).filter(u => new Date(u.created_at) >= week).length;
    const newUsersMonth = (users || []).filter(u => new Date(u.created_at) >= month).length;

    const charges      = (walletTx || []).filter(t => t.type === 'charge'   && t.status === 'مكتمل');
    const withdraws    = (walletTx || []).filter(t => t.type === 'withdraw' && t.status === 'مكتمل');
    const pending_w    = (walletTx || []).filter(t => t.status === 'قيد المراجعة');
    const totalCharged   = charges.reduce((s, t) => s + (t.amount || 0), 0);
    const totalWithdrawn = withdraws.reduce((s, t) => s + (t.amount || 0), 0);
    const chargedToday   = charges.filter(t => new Date(t.created_at) >= today).reduce((s, t) => s + (t.amount || 0), 0);
    const chargedMonth   = charges.filter(t => new Date(t.created_at) >= month).reduce((s, t) => s + (t.amount || 0), 0);

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('total-sales', fmt(totalRevenue));
    el('orders-count', completed.length);
    el('users-count', totalUsers);

    document.getElementById('full-stats-section')?.remove();

    const main = document.querySelector('.dashboard-main-area');
    if (!main) return;

    const section = document.createElement('div');
    section.id = 'full-stats-section';
    section.style.cssText = 'padding: 0 20px 40px; max-width:1200px; margin:0 auto;';

    section.innerHTML = `
    <style>
        /* ── متغيرات الـ dashboard تتبع data-theme ── */
        :root {
            --ds-card:        #1e293b;
            --ds-card-border: rgba(255,255,255,0.07);
            --ds-label:       #64748b;
            --ds-val:         #f1f5f9;
            --ds-sub:         #475569;
            --ds-table-head:  rgba(249,115,22,0.1);
            --ds-table-row:   rgba(255,255,255,0.03);
            --ds-table-td:    #cbd5e1;
            --ds-box-bg:      #1e293b;
            --ds-title-border:#1e2d42;
        }
        [data-theme="light"] {
            --ds-card:        #ffffff;
            --ds-card-border: #e2e8f0;
            --ds-label:       #64748b;
            --ds-val:         #0f172a;
            --ds-sub:         #94a3b8;
            --ds-table-head:  rgba(249,115,22,0.08);
            --ds-table-row:   rgba(0,0,0,0.02);
            --ds-table-td:    #334155;
            --ds-box-bg:      #ffffff;
            --ds-title-border:#e2e8f0;
        }

        .ds-title {
            font-size: 15px; font-weight: 800; color: #f97316;
            margin: 28px 0 14px; display: flex; align-items: center; gap: 8px;
            border-bottom: 1px solid var(--ds-title-border); padding-bottom: 8px;
        }
        .ds-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px; margin-bottom: 8px;
        }
        .ds-card {
            background: var(--ds-card);
            border: 1px solid var(--ds-card-border);
            border-radius: 14px; padding: 16px 18px;
            display: flex; flex-direction: column; gap: 4px;
            transition: transform 0.15s, background 0.3s, border-color 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .ds-card:hover { transform: translateY(-2px); }
        .ds-card .ds-label {
            font-size: 11px; color: var(--ds-label);
            font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .ds-card .ds-val {
            font-size: 22px; font-weight: 900; color: var(--ds-val); line-height: 1.2;
        }
        .ds-card .ds-sub  { font-size: 11px; color: var(--ds-sub); margin-top: 2px; }
        .ds-card .ds-icon { font-size: 22px; margin-bottom: 6px; }

        .ds-table {
            width: 100%; border-collapse: collapse; font-size: 13px;
        }
        .ds-table th {
            background: var(--ds-table-head); color: #f97316;
            padding: 8px 12px; text-align: right; font-weight: 700;
            border-bottom: 1px solid rgba(249,115,22,0.2);
        }
        .ds-table td {
            padding: 8px 12px; border-bottom: 1px solid var(--ds-card-border);
            color: var(--ds-table-td);
        }
        .ds-table tr:last-child td { border-bottom: none; }
        .ds-table tr:hover td { background: var(--ds-table-row); }

        .ds-box {
            background: var(--ds-box-bg);
            border: 1px solid var(--ds-card-border);
            border-radius: 14px; overflow: hidden; margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            transition: background 0.3s, border-color 0.3s;
        }

        @media (max-width: 640px) {
            .ds-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
            .ds-card { padding: 12px 14px; }
            .ds-card .ds-val { font-size: 18px; }
        }
    </style>

    <!-- ===== الطلبات ===== -->
    <div class="ds-title"><i class="fas fa-shopping-cart"></i> إحصائيات الطلبات</div>
    <div class="ds-grid">
        <div class="ds-card">
            <div class="ds-icon">✅</div>
            <div class="ds-label">طلبات مكتملة</div>
            <div class="ds-val" style="color:#22c55e;">${fmt(completed.length)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">⏳</div>
            <div class="ds-label">قيد المراجعة</div>
            <div class="ds-val" style="color:#f97316;">${fmt(pending.length)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">❌</div>
            <div class="ds-label">ملغية</div>
            <div class="ds-val" style="color:#ef4444;">${fmt(cancelled.length)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">↩️</div>
            <div class="ds-label">مستردة</div>
            <div class="ds-val" style="color:#f59e0b;">${fmt(refunded.length)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">🤖</div>
            <div class="ds-label">قبول تلقائي</div>
            <div class="ds-val" style="color:#3b82f6;">${fmt(autoApproved)}</div>
            <div class="ds-sub">يدوي: ${fmt(manualApproved)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📦</div>
            <div class="ds-label">إجمالي الطلبات</div>
            <div class="ds-val">${fmt((orders || []).length)}</div>
        </div>
    </div>

    <!-- ===== الإيرادات ===== -->
    <div class="ds-title"><i class="fas fa-money-bill-wave"></i> الإيرادات والأرباح</div>
    <div class="ds-grid">
        <div class="ds-card">
            <div class="ds-icon">💰</div>
            <div class="ds-label">إجمالي الإيرادات</div>
            <div class="ds-val" style="color:#22c55e;">${fmt(totalRevenue)} MRU</div>
            <div class="ds-sub">${fmtD(totalRevenue / 43)} $</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📉</div>
            <div class="ds-label">إجمالي التكاليف</div>
            <div class="ds-val" style="color:#ef4444;">${fmt(totalCost)} MRU</div>
            <div class="ds-sub">${fmtD(totalCost / 43)} $</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📈</div>
            <div class="ds-label">صافي الربح</div>
            <div class="ds-val" style="color:${totalProfit >= 0 ? '#22c55e' : '#ef4444'};">${fmt(totalProfit)} MRU</div>
            <div class="ds-sub">${fmtD(totalProfit / 43)} $</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📅</div>
            <div class="ds-label">إيرادات اليوم</div>
            <div class="ds-val" style="color:#60a5fa;">${fmt(todayRevenue)} MRU</div>
            <div class="ds-sub">${todayOrders.length} طلب اليوم</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">🗓️</div>
            <div class="ds-label">إيرادات الأسبوع</div>
            <div class="ds-val" style="color:#a78bfa;">${fmt(weekRevenue)} MRU</div>
            <div class="ds-sub">${weekOrders.length} طلب</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📆</div>
            <div class="ds-label">إيرادات الشهر</div>
            <div class="ds-val" style="color:#f97316;">${fmt(monthRevenue)} MRU</div>
            <div class="ds-sub">${monthOrders.length} طلب</div>
        </div>
    </div>

    <!-- ===== طرق الدفع ===== -->
    <div class="ds-title"><i class="fas fa-credit-card"></i> توزيع طرق الدفع</div>
    <div class="ds-box">
        <table class="ds-table">
            <thead><tr>
                <th>طريقة الدفع</th><th>عدد الطلبات</th><th>الإيرادات</th><th>النسبة</th>
            </tr></thead>
            <tbody>
                ${Object.entries(paymentMap)
                    .sort((a, b) => b[1].revenue - a[1].revenue)
                    .map(([pm, d]) => `
                    <tr>
                        <td><strong>${pm}</strong></td>
                        <td>${fmt(d.count)}</td>
                        <td style="color:#22c55e;">${fmt(d.revenue)} MRU</td>
                        <td>${totalRevenue > 0 ? ((d.revenue / totalRevenue) * 100).toFixed(1) : 0}%</td>
                    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;">لا توجد بيانات</td></tr>'}
            </tbody>
        </table>
    </div>

    <!-- ===== المخزون ===== -->
    <div class="ds-title"><i class="fas fa-layer-group"></i> إحصائيات المخزون</div>
    <div class="ds-grid">
        <div class="ds-card">
            <div class="ds-icon">📦</div>
            <div class="ds-label">أكواد متاحة</div>
            <div class="ds-val" style="color:#22c55e;">${fmt(availableStock.length)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">✅</div>
            <div class="ds-label">أكواد مباعة</div>
            <div class="ds-val" style="color:#94a3b8;">${fmt(soldStock.length)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">🏷️</div>
            <div class="ds-label">قيمة المخزون (بيع)</div>
            <div class="ds-val" style="color:#f97316;">${fmt(stockValue)} MRU</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">💸</div>
            <div class="ds-label">تكلفة المخزون</div>
            <div class="ds-val" style="color:#ef4444;">${fmt(stockCostValue)} MRU</div>
            <div class="ds-sub">ربح محتمل: ${fmt(stockValue - stockCostValue)} MRU</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📤</div>
            <div class="ds-label">مبيعات اليوم</div>
            <div class="ds-val" style="color:#60a5fa;">${fmt(soldToday)} كود</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📊</div>
            <div class="ds-label">مبيعات الأسبوع</div>
            <div class="ds-val" style="color:#a78bfa;">${fmt(soldWeek)} كود</div>
        </div>
    </div>
    <div class="ds-box">
        <table class="ds-table">
            <thead><tr>
                <th>المنتج / الفئة</th><th>الأكواد المتاحة</th><th>النسبة من المخزون</th>
            </tr></thead>
            <tbody>
                ${Object.entries(stockByProduct)
                    .sort((a, b) => b[1] - a[1]).slice(0, 15)
                    .map(([name, count]) => `
                    <tr>
                        <td><strong>${name}</strong></td>
                        <td style="color:#22c55e;">${fmt(count)}</td>
                        <td>${availableStock.length > 0 ? ((count / availableStock.length) * 100).toFixed(1) : 0}%</td>
                    </tr>`).join('') || '<tr><td colspan="3" style="text-align:center;">المخزون فارغ</td></tr>'}
            </tbody>
        </table>
    </div>

    <!-- ===== المستخدمون ===== -->
    <div class="ds-title"><i class="fas fa-users"></i> إحصائيات المستخدمين</div>
    <div class="ds-grid">
        <div class="ds-card">
            <div class="ds-icon">👥</div>
            <div class="ds-label">إجمالي المستخدمين</div>
            <div class="ds-val">${fmt(totalUsers)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">💼</div>
            <div class="ds-label">لديهم رصيد</div>
            <div class="ds-val" style="color:#22c55e;">${fmt(usersWithBal)}</div>
            <div class="ds-sub">إجمالي: ${fmt(totalBalances)} MRU</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">🆕</div>
            <div class="ds-label">جدد اليوم</div>
            <div class="ds-val" style="color:#60a5fa;">${fmt(newUsersToday)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📅</div>
            <div class="ds-label">جدد هذا الأسبوع</div>
            <div class="ds-val" style="color:#a78bfa;">${fmt(newUsersWeek)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📆</div>
            <div class="ds-label">جدد هذا الشهر</div>
            <div class="ds-val" style="color:#f97316;">${fmt(newUsersMonth)}</div>
        </div>
    </div>

    <!-- ===== المحافظ ===== -->
    <div class="ds-title"><i class="fas fa-wallet"></i> إحصائيات المحافظ</div>
    <div class="ds-grid">
        <div class="ds-card">
            <div class="ds-icon">⬆️</div>
            <div class="ds-label">إجمالي الشحن</div>
            <div class="ds-val" style="color:#22c55e;">${fmt(totalCharged)} MRU</div>
            <div class="ds-sub">${charges.length} عملية</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">⬇️</div>
            <div class="ds-label">إجمالي السحب</div>
            <div class="ds-val" style="color:#ef4444;">${fmt(totalWithdrawn)} MRU</div>
            <div class="ds-sub">${withdraws.length} عملية</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">⏳</div>
            <div class="ds-label">طلبات معلقة</div>
            <div class="ds-val" style="color:#f97316;">${fmt(pending_w.length)}</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📅</div>
            <div class="ds-label">شحن اليوم</div>
            <div class="ds-val" style="color:#60a5fa;">${fmt(chargedToday)} MRU</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">📆</div>
            <div class="ds-label">شحن الشهر</div>
            <div class="ds-val" style="color:#a78bfa;">${fmt(chargedMonth)} MRU</div>
        </div>
        <div class="ds-card">
            <div class="ds-icon">💹</div>
            <div class="ds-label">أرصدة المحافظ</div>
            <div class="ds-val" style="color:#f97316;">${fmt(totalBalances)} MRU</div>
        </div>
    </div>

    <!-- ===== المنتجات ===== -->
    <div class="ds-title"><i class="fas fa-box-open"></i> المنتجات</div>
    <div class="ds-grid">
        <div class="ds-card">
            <div class="ds-icon">🛍️</div>
            <div class="ds-label">عدد المنتجات</div>
            <div class="ds-val">${fmt((products || []).length)}</div>
        </div>
    </div>

    <div style="text-align:center; font-size:11px; color:var(--ds-sub); margin-top:20px;">
        آخر تحديث: ${now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
        &nbsp;•&nbsp;
        <a href="#" onclick="loadDashboardStats();return false;" style="color:#f97316;text-decoration:none;">تحديث الآن</a>
    </div>
    `;

    main.appendChild(section);
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    setInterval(loadDashboardStats, 120000);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                await supabase.auth.signOut();
                window.location.href = 'login.html';
            }
        });
    }
});

window.loadDashboardStats = loadDashboardStats;