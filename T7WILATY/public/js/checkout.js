import { supabase } from './supabase-config.js';

let totalAmount = 0;
let userBalance = 0;
let selectedPaymentMethod = null;
let cart = [];

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    checkAuthAndLoadData();

    document.getElementById('confirm-payment-btn')?.addEventListener('click', executePayment);

    document.getElementById('receipt-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('receipt-preview');
            if (preview) {
                preview.src = ev.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    });
});

// ===== جلب بوابات الدفع =====
async function loadPaymentMethods() {
    const { data: methods, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .eq('show_in_checkout', true)
        .order('created_at', { ascending: true });

    const list = document.getElementById('payment-methods-list');
    if (!list) return;

    const walletCard = `
        <div class="payment-method-card" id="pm-wallet" onclick="selectMethod('wallet', '', 'المحفظة')">
            <i class="fas fa-wallet" style="font-size:26px; color:#22c55e;"></i>
            <div class="payment-method-info">
                <div class="payment-method-name">محفظتي</div>
                <div class="payment-method-desc">رصيدك: ${userBalance} MRU</div>
            </div>
            <div class="payment-method-radio"></div>
        </div>
    `;

    if (error || !methods || methods.length === 0) {
        list.innerHTML = walletCard;
        return;
    }

    list.innerHTML = walletCard + methods.map(m => `
        <div class="payment-method-card" id="pm-${m.id}" onclick="selectMethod('${m.id}', '${m.account_number}', '${m.name}')">
            <img src="${m.logo_url || ''}" alt="${m.name}" 
                 style="width:42px; height:42px; object-fit:contain; border-radius:8px;" 
                 onerror="this.style.display='none'">
            <div class="payment-method-info">
                <div class="payment-method-name">${m.name}</div>
            </div>
            <div class="payment-method-radio"></div>
        </div>
    `).join('');
}

// ===== اختيار طريقة الدفع =====
window.selectMethod = function(id, account, name) {
    document.querySelectorAll('.payment-method-card').forEach(c => {
        c.style.borderColor = '#334155';
        c.style.background = '';
    });

    const card = document.getElementById(`pm-${id}`);
    if (card) {
        card.style.borderColor = '#f97316';
        card.style.background = 'rgba(249,115,22,0.1)';
    }

    selectedPaymentMethod = { id, account, name };

    const infoDiv        = document.getElementById('selected-method-info');
    const accountElem    = document.getElementById('selected-account');
    const receiptSection = document.getElementById('receipt-upload-section');
    const statusMsg      = document.getElementById('payment-status-msg');

    if (id === 'wallet') {
        if (infoDiv) infoDiv.style.display = 'none';
        if (receiptSection) receiptSection.style.display = 'none';
        if (userBalance < totalAmount) {
            statusMsg.innerHTML = `<p style="color:#ef4444;">⚠️ رصيدك غير كافٍ — اشحن محفظتك أو اختر طريقة دفع أخرى</p>`;
        } else {
            statusMsg.innerHTML = '';
        }
    } else {
        if (infoDiv && accountElem) {
            infoDiv.style.display = 'block';
            accountElem.textContent = account || 'غير متوفر';
        }
        if (receiptSection) receiptSection.style.display = 'block';
        if (statusMsg) statusMsg.innerHTML = '';
    }
};

// ===== تحميل البيانات =====
async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon && user) userIcon.className = 'fas fa-user-check';

    cart = JSON.parse(localStorage.getItem('cart')) || [];
    totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);

    const totalElem = document.getElementById('checkout-total');
    if (totalElem) totalElem.textContent = `${totalAmount} MRU`;

    const totalDisplay = document.getElementById('checkout-total-display');
    if (totalDisplay) totalDisplay.textContent = `${totalAmount} MRU`;

    if (!user) return;

    try {
        const { data: userData, error } = await supabase
            .from('users')
            .select('balance, is_blocked')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        if (userData?.is_blocked) {
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;
                            height:100vh; background:#0f172a; color:white; font-family:'Cairo',sans-serif;
                            text-align:center; gap:20px; padding:20px;">
                    <div style="font-size:80px;">🚫</div>
                    <h1 style="color:#ef4444; font-size:28px;">تم تعليق حسابك</h1>
                    <p style="color:#94a3b8; font-size:16px; max-width:400px; line-height:2;">
                        حسابك محظور حالياً ولا يمكنك إتمام عمليات الدفع.<br>
                        يرجى التواصل مع الدعم الفني.
                    </p>
                    <a href="index.html" style="background:#f97316; color:white; padding:12px 30px;
                        border-radius:8px; text-decoration:none; font-size:16px;">العودة للرئيسية</a>
                </div>`;
            return;
        }

        userBalance = userData?.balance || 0;

        const balanceElem = document.getElementById('current-wallet-balance');
        if (balanceElem) balanceElem.textContent = `${userBalance} MRU`;

        const confirmBtn = document.getElementById('confirm-payment-btn');
        const statusMsg  = document.getElementById('payment-status-msg');

        if (totalAmount > 0) {
            if (confirmBtn) confirmBtn.disabled = false;
        } else {
            if (statusMsg) statusMsg.innerHTML = `<p style="color:red; font-weight:bold;">⚠️ سلتك فارغة!</p>`;
            if (confirmBtn) confirmBtn.disabled = true;
        }
    } catch (error) {
        console.error('Error fetching balance:', error);
    }

    await loadPaymentMethods();
}

// ==================== توليد رقم الطلب ====================
function generateOrderNumber() {
    return `S${Math.floor(100000 + Math.random() * 900000)}`;
}

// ==================== سحب تلقائي من المخزون ====================
async function pullFromStock(item) {
    const productId = item.productId || null;
    const label     = item.label    || null;
    const quantity  = item.quantity || 1;

    if (!productId || !label) return null;

    const { data: availableCodes, error } = await supabase
        .from('stocks')
        .select('id, code, cost_per_card_usd, supplier_name, order_id')
        .eq('product_id', productId)
        .eq('price_label', label)
        .eq('status', 'available')
        .order('created_at', { ascending: true })
        .limit(quantity);

    if (error || !availableCodes || availableCodes.length < quantity) return null;

    for (const c of availableCodes) {
        const { data: existing } = await supabase
            .from('used_codes').select('id').eq('code', c.code).maybeSingle();
        if (existing) return null;
    }

    const codes    = availableCodes.map(c => c.code);
    const stockIds = availableCodes.map(c => c.id);

    const costPerCode     = availableCodes[0]?.cost_per_card_usd || 0;
    const supplierName    = availableCodes[0]?.supplier_name     || 'تلقائي';
    const supplierOrderId = availableCodes[0]?.order_id          || '';

    const suppliersMap = {};
    availableCodes.forEach(c => {
        const name = c.supplier_name || 'غير محدد';
        if (!suppliersMap[name]) {
            suppliersMap[name] = {
                supplier_name:     name,
                supplier_order_id: c.order_id || ''
            };
        }
    });

    return {
        codes,
        stockIds,
        costPerCode,
        supplierName,
        supplierOrderId,
        suppliersDetails: Object.values(suppliersMap)
    };
}

// ==================== تنفيذ السحب وتحديث المخزون ====================
async function commitStockPull(stockResult, orderId) {
    await supabase
        .from('stocks')
        .update({ status: 'sold', sold_at: new Date().toISOString(), order_id: orderId })
        .in('id', stockResult.stockIds);
}

// ===== تنفيذ الدفع =====
async function executePayment() {
    if (!selectedPaymentMethod) {
        showToast('⚠️ الرجاء اختيار طريقة الدفع أولاً!', 'error');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const btn  = document.getElementById('confirm-payment-btn');

    if (totalAmount <= 0) return;

    // فحص الحظر قبل الدفع
    const { data: userCheck } = await supabase
        .from('users')
        .select('is_blocked')
        .eq('id', user.id)
        .single();

    if (userCheck?.is_blocked) {
        showToast('🚫 حسابك محظور، لا يمكنك إتمام الدفع', 'error');
        return;
    }

    // ===== دفع بالمحفظة =====
    if (selectedPaymentMethod.id === 'wallet') {
        if (userBalance < totalAmount) {
            showToast('⚠️ رصيدك غير كافٍ! اشحن محفظتك أولاً.', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري معالجة الدفع...';

        try {
            // فحص المخزون لكل عنصر في السلة
            const stockResults = [];
            for (const item of cart) {
                const result = await pullFromStock(item);
                stockResults.push(result);
            }

            // خصم الرصيد
            const newBalance = userBalance - totalAmount;
            const { error: balanceError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', user.id);

            if (balanceError) throw balanceError;

            // رقم طلب واحد مشترك لكل عناصر السلة
            const sharedOrderNumber = generateOrderNumber();

            // إذا لم يتوفر مخزون لأي عنصر → جميع الطلبات قيد الانتظار
            const allHaveStock = stockResults.every(r => r !== null);

            const ordersToInsert = cart.map((item, i) => {
                const stockResult = stockResults[i];
                const hasStock    = stockResult !== null;

                return {
                    order_number:      sharedOrderNumber,
                    customer_name:     user?.user_metadata?.full_name || 'مستخدم',
                    customer_phone:    user?.email || '',
                    product_id:        item.productId || null,
                    product_name:      item.name,
                    label:             item.label || null,
                    price:             item.price,
                    quantity:          item.quantity || 1,
                    user_id:           user.id,
                    paymentMethod:     'المحفظة',
                    status:            (allHaveStock && hasStock) ? 'مكتمل' : 'قيد الانتظار',
                    card_code:         (allHaveStock && hasStock) ? stockResult.codes.join('\n') : null,
                    cost_price:        (allHaveStock && hasStock) ? stockResult.costPerCode : null,
                    supplier_id:       (allHaveStock && hasStock) ? stockResult.supplierName : null,
                    supplier_order_id: (allHaveStock && hasStock) ? stockResult.supplierOrderId : null,
                    suppliers_details: (allHaveStock && hasStock) ? stockResult.suppliersDetails : null,
                    auto_approved:     (allHaveStock && hasStock) ? true : false
                };
            });

            const { data: insertedOrders, error: insertError } = await supabase
                .from('orders')
                .insert(ordersToInsert)
                .select();

            if (insertError) throw insertError;

            // تحديث المخزون فقط إذا الكل مكتمل
            if (allHaveStock) {
                for (let i = 0; i < cart.length; i++) {
                    const stockResult = stockResults[i];
                    const order       = insertedOrders[i];
                    if (stockResult && order) {
                        await commitStockPull(stockResult, order.id);
                    }
                }
            }

            // تسجيل عملية السحب من المحفظة
            await supabase.from('wallet_transactions').insert({
                user_id: user.id,
                type: 'purchase',
                amount: totalAmount,
                payment_method: 'المحفظة',
                product_name: cart.map(i => i.name).join('، '), // ✅
                label: cart.map(i => i.label || '').join('، '),  // ✅
                status: 'مكتمل'
            });

            localStorage.removeItem('cart');

            if (allHaveStock) {
                showToast('✅ تم الدفع وتسليم جميع بطاقاتك بنجاح!', 'success');
            } else {
                showToast('✅ تم الدفع! سيتم تسليم طلباتك قريباً', 'success');
            }

            setTimeout(() => {
                window.location.href = 'orders.html';
            }, 1500);

        } catch (error) {
            console.error('Payment Error:', error);
            showToast('❌ حدث خطأ: ' + error.message, 'error');
            btn.disabled = false;
            btn.innerHTML = 'تأكيد الدفع الآن';
        }
        return;
    }

    // ===== دفع بالإيصال =====
    const receiptFile = document.getElementById('receipt-input')?.files[0];
    if (!receiptFile) {
        showToast('⚠️ الرجاء رفع إيصال الدفع!', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري معالجة الدفع...';

    try {
        const filePath = `receipts/${Date.now()}`;
        const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, receiptFile);

        let receiptUrl = '';
        if (!uploadError) {
            const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
            receiptUrl = data.publicUrl;
        }

        const sharedOrderNumber = generateOrderNumber();

        const orders = cart.map(item => ({
            order_number:   sharedOrderNumber,
            customer_name:  user?.user_metadata?.full_name || 'مستخدم',
            customer_phone: user?.email || '',
            product_id:     item.productId || null,
            product_name:   item.name,
            label:          item.label || null,
            price:          item.price,
            quantity:       item.quantity || 1,
            status:         'قيد الانتظار',
            receiptUrl:     receiptUrl,
            paymentMethod:  selectedPaymentMethod.name,
            user_id:        user.id
        }));

        const { error: insertError } = await supabase.from('orders').insert(orders);
        if (insertError) throw insertError;

        localStorage.removeItem('cart');
        showToast('✅ تمت عملية الدفع بنجاح!', 'success');

        setTimeout(() => {
            window.location.href = 'orders.html';
        }, 1500);

    } catch (error) {
        console.error('Payment Error:', error);
        showToast('❌ حدث خطأ: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'تأكيد الدفع الآن';
    }
}

// ===== Toast Notification =====
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#22c55e' : '#ef4444'};
        color: white;
        padding: 14px 28px;
        border-radius: 12px;
        font-size: 16px;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: opacity 0.5s;
        font-family: 'Cairo', sans-serif;
        text-align: center;
        max-width: 320px;
        width: 90%;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// ===== Dark Mode =====
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    });
}

// ===== User Menu =====
function setupUserMenu() {
    const userBtn      = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });
        window.addEventListener('click', () => userDropdown.classList.remove('show'));
    }
}

// ===== Logout =====
window.handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

// ===== Auth Check =====
async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        localStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.replace('login.html');
    }
}

requireAuth();