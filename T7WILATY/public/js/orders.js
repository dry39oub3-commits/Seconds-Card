import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    checkAuthState();
});

function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        window.addEventListener('click', () => userDropdown.classList.remove('show'));
    }
}

async function checkAuthState() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || null;
    const userIcon = document.querySelector('#user-icon-btn i');
    if (user && userIcon) userIcon.className = 'fas fa-user-check';
    fetchUserOrders();
    watchOrders(); // ← أضف هذا السطر فقط
}

window.handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = "index.html";
};

async function fetchUserOrders() {
    const ordersList = document.getElementById('orders-list');
    const noOrders = document.getElementById('no-orders');
    if (!ordersList) return;

    // ✅ جلب المستخدم الحالي
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
        ordersList.style.display = 'none';
        if (noOrders) noOrders.style.display = 'block';
        return;
    }

    const { data: orders, error } = await supabase
    .from("orders")
    .select("*, products(image, name)")
    .eq("user_id", user.id)   // ✅ فلترة بالمستخدم
    .order("created_at", { ascending: false }); // ✅ الأحدث أولاً

console.log("columns:", Object.keys(orders?.[0] || {}));

    if (error) {
        ordersList.innerHTML = '<p style="color:red; text-align:center;">حدث خطأ أثناء تحميل الطلبات.</p>';
        return;
    }

    if (!orders || orders.length === 0) {
        ordersList.style.display = 'none';
        if (noOrders) noOrders.style.display = 'block';
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const date = order.created_at
            ? new Date(order.created_at).toLocaleDateString('fr-FR')
            : 'تاريخ غير معروف';
        const image = order.products?.image || order.card_image || order.product_image || '';
        const isCompleted = order.status === 'مكتمل';
        const orderNum = order.order_number || '#' + order.id.toString().substring(0, 8);
        const safeCode = (order.card_code || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

        return `
        <div class="order-card">
            <div class="order-header">
                <span>${orderNum}</span>
                <span>${date}</span>
            </div>
            <div class="order-body">
                ${image ? `<img src="${image}" alt="${order.product_name}" style="width:60px; height:60px; object-fit:contain; background:white; border-radius:8px; padding:4px;">` : ''}
                <div class="card-details">
                    <h4>${order.product_name || 'غير محدد'}</h4>
                    ${order.label ? `<p>الفئة: <strong style="color:#f97316;">${order.label}</strong></p>` : ''}
                    <p>السعر: <strong>${order.price * (order.quantity || 1)} MRU</strong></p>
                    <p>الكمية: <strong>${order.quantity || 1}</strong></p>
                    <p>طريقة الدفع: ${order.paymentMethod || order.payment_method || 'غير محدد'}</p>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:10px; margin-right:auto;">
                    <span class="status-badge ${isCompleted ? 'status-completed' : order.status === 'ملغي' ? 'status-cancelled' : 'status-pending'}">
                        ${order.status || 'قيد الانتظار'}
                    </span>
                    ${isCompleted ? `
                        <button onclick="toggleCode('${order.id}', '${safeCode}')" class="copy-btn">
                            <i class="fas fa-key"></i> عرض الكود
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

window.toggleCode = (orderId, cardCode) => {
    document.getElementById('code-modal')?.remove();

    const codes = cardCode
        ? cardCode.replace(/\\n/g, '\n').split('\n').filter(c => c.trim() !== '')
        : [];

    const modal = document.createElement('div');
    modal.id = 'code-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.8); z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border-radius:16px; padding:28px; width:100%; max-width:480px; color:#e2e8f0; position:relative;">
            <button onclick="document.getElementById('code-modal').remove()"
                style="position:absolute; top:14px; left:14px; background:#ef4444; color:white; border:none; border-radius:8px; padding:5px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>
            <h3 style="text-align:center; color:#f97316; margin-bottom:20px;">🔑 أكواد البطاقة</h3>
            <div style="display:flex; flex-direction:column; gap:10px; max-height:60vh; overflow-y:auto;">
                ${codes.length > 0 ? codes.map((code, i) => `
                    <div style="background:#0f172a; border-radius:10px; padding:14px 16px; display:flex; align-items:center; gap:10px;">
                        <span style="color:#94a3b8; font-size:13px; min-width:24px;">${i + 1})</span>
                        <span style="font-family:monospace; font-size:15px; color:#f97316; font-weight:bold; flex:1; text-align:center; word-break:break-all;">${code}</span>
                        <button onclick="copyCode('${code.replace(/'/g, "\\'")}')"
                            style="background:#334155; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; flex-shrink:0;">
                            <i class="fas fa-copy"></i> نسخ
                        </button>
                    </div>
                `).join('') : `<p style="text-align:center; color:#64748b;">جاري المعالجة...</p>`}
            </div>
            ${codes.length > 1 ? `
                <button onclick="copyAllCodes('${codes.join('\\n').replace(/'/g, "\\'")}')"
                    style="width:100%; margin-top:16px; padding:12px; background:#f97316; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold; font-size:14px;">
                    <i class="fas fa-copy"></i> نسخ جميع الأكواد
                </button>
            ` : ''}
        </div>
    `;

    document.body.appendChild(modal);
};

window.copyAllCodes = (codes) => {
    navigator.clipboard.writeText(codes).then(() => alert('✅ تم نسخ جميع الأكواد!'));
};

window.copyCode = (code) => {
    if (!code || code === 'undefined' || code === '') {
        alert('الكود غير متوفر بعد، يرجى الانتظار.');
        return;
    }
    navigator.clipboard.writeText(code).then(() => alert("✅ تم نسخ الكود بنجاح!"));
};



// ==================== إشعار صوتي ====================
function playNotificationSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    const notes = [523, 659, 784, 1047]; // Do Mi Sol Do
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
}

// ==================== مراقبة حالة الطلبات ====================
async function watchOrders() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // جلب الطلبات المكتملة الحالية لتجنب إشعار القديمة
    const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'مكتمل');

    const notifiedIds = new Set((existing || []).map(o => o.id));

    // الاشتراك في التغييرات
    supabase
        .channel('orders-watch')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
        }, (payload) => {
            const updated = payload.new;

            // إشعار فقط للطلبات المكتملة الجديدة
            if (updated.status === 'مكتمل' && !notifiedIds.has(updated.id)) {
                notifiedIds.add(updated.id);
                playNotificationSound();
                showToast(`✅ طلبك "${updated.product_name}" تم بنجاح! اضغط لعرض الكود`);
                fetchUserOrders(); // تحديث القائمة
            }

            // إشعار الرفض
            if (updated.status === 'ملغي' && !notifiedIds.has('cancelled_' + updated.id)) {
                notifiedIds.add('cancelled_' + updated.id);
                showToast(`❌ تم رفض طلب "${updated.product_name}"`, '#ef4444');
                fetchUserOrders();
            }
        })
        .subscribe();
}

// ==================== Toast إشعار ====================
function showToast(message, color = '#22c55e') {
    document.getElementById('order-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'order-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        border-right: 4px solid ${color};
        font-size: 15px;
        font-family: 'Cairo', sans-serif;
        z-index: 99999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        cursor: pointer;
        max-width: 90vw;
        text-align: center;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    toast.onclick = () => toast.remove();

    // CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 6000);
}