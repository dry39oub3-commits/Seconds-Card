// cart.js - Cloud Storage with Supabase
import { supabase } from './supabase-config.js';

// ==================== إدارة السلة السحابية ====================

async function getOrCreateCart(userId) {
    // جلب السلة الحالية أو إنشاء واحدة جديدة
    let { data: cart, error } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

    if (error || !cart) {
        const { data: newCart, error: createError } = await supabase
            .from('carts')
            .insert({ user_id: userId, status: 'active' })
            .select('id')
            .single();
        if (createError) throw createError;
        return newCart.id;
    }
    return cart.id;
}

async function loadCartFromCloud(userId) {
    const cartId = await getOrCreateCart(userId);
    const { data: items, error } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cartId);

    if (error) throw error;
    return { cartId, items: items || [] };
}

async function saveCartItemToCloud(cartId, item) {
    // تحقق إن كان المنتج موجود مسبقاً
    const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('cart_id', cartId)
        .eq('product_id', item.id)
        .single();

    if (existing) {
        // تحديث الكمية
        const { error } = await supabase
            .from('cart_items')
            .update({ quantity: existing.quantity + (item.quantity || 1) })
            .eq('id', existing.id);
        if (error) throw error;
    } else {
        // إضافة منتج جديد
        const { error } = await supabase
            .from('cart_items')
            .insert({
                cart_id: cartId,
                product_id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                label: item.label,
                player_id: item.player_id,
                quantity: item.quantity || 1
            });
        if (error) throw error;
    }
}

async function updateCartItemQty(itemDbId, newQty) {
    if (newQty <= 0) {
        return await removeCartItemFromCloud(itemDbId);
    }
    const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQty })
        .eq('id', itemDbId);
    if (error) throw error;
}

async function removeCartItemFromCloud(itemDbId) {
    const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemDbId);
    if (error) throw error;
}

// ==================== الحالة المحلية للصفحة ====================
let cartItems = [];
let currentCartId = null;
let currentUserId = null;

// ==================== التهيئة ====================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await checkAuthState();
    checkUserIcon();
});

async function checkAuthState() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
        currentUserId = session.user.id;
        try {
            const { cartId, items } = await loadCartFromCloud(currentUserId);
            currentCartId = cartId;
            cartItems = items;

            // مزامنة localStorage القديمة إن وجدت
            await migrateLocalStorageToCloud();
        } catch (err) {
            console.error('خطأ في تحميل السلة:', err);
        }
    } else {
        // مستخدم غير مسجل - استخدم localStorage مؤقتاً
        cartItems = JSON.parse(localStorage.getItem('cart')) || [];
    }

    renderCart();
}

// مزامنة البيانات القديمة من localStorage إلى السحابة
async function migrateLocalStorageToCloud() {
    const localCart = JSON.parse(localStorage.getItem('cart')) || [];
    if (localCart.length === 0) return;

    for (const item of localCart) {
        try {
            await saveCartItemToCloud(currentCartId, item);
        } catch (e) {
            console.warn('فشل نقل المنتج:', item.name, e);
        }
    }
    localStorage.removeItem('cart');

    // أعد تحميل السلة من السحابة بعد المزامنة
    const { items } = await loadCartFromCloud(currentUserId);
    cartItems = items;
}

// ==================== عرض السلة ====================
function renderCart() {
    const list = document.getElementById('cart-items-list');
    const emptyMsg = document.getElementById('empty-cart-msg');

    if (!list) return;

    if (cartItems.length === 0) {
        list.innerHTML = "";
        if (emptyMsg) emptyMsg.style.display = 'block';
        updateSummary(0);
        updateCartBadge();
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    let html = '<h2>سلة المشتريات</h2>';
    let total = 0;

    cartItems.forEach((item, index) => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.quantity) || 1;
        total += itemPrice * itemQty;

        html += `
            <div class="cart-item">
                <img src="${item.image || 'assets/placeholder.png'}" alt="${item.name}">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    ${item.label ? `<span style="font-size:12px; color:#f97316; background:rgba(249,115,22,0.1); padding:2px 8px; border-radius:20px; display:inline-block; margin-bottom:4px;">${item.label}</span>` : ''}
                    ${item.player_id ? `<div style="font-size:11px; color:#22c55e; margin-top:3px;">🎮 ${item.player_id}</div>` : ''}
                    <p>${itemPrice} MRU</p>
                </div>
                <div class="quantity-control">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)">
                        <i class="fas fa-minus-circle"></i>
                    </button>
                    <span>${itemQty}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                </div>
                <button class="remove-item-btn" onclick="removeItem(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });

    list.innerHTML = html;
    updateSummary(total);
    updateCartBadge();
}

// ==================== التحكم في السلة ====================
window.updateQty = async (index, change) => {
    const item = cartItems[index];
    const newQty = (item.quantity || 1) + change;

    if (newQty > 5) {
        showToast('⚠️ لا يمكن إضافة أكثر من 5 قطع!', 'warning');
        return;
    }

    if (currentUserId && item.id) {
        try {
            if (newQty <= 0) {
                await removeCartItemFromCloud(item.id);
                cartItems.splice(index, 1);
            } else {
                await updateCartItemQty(item.id, newQty);
                cartItems[index].quantity = newQty;
            }
        } catch (err) {
            showToast('❌ خطأ في التحديث', 'error');
            return;
        }
    } else {
        // وضع offline
        if (newQty <= 0) {
            cartItems.splice(index, 1);
        } else {
            cartItems[index].quantity = newQty;
        }
        localStorage.setItem('cart', JSON.stringify(cartItems));
    }

    renderCart();
};

window.removeItem = async (index) => {
    const item = cartItems[index];

    if (currentUserId && item.id) {
        try {
            await removeCartItemFromCloud(item.id);
        } catch (err) {
            showToast('❌ خطأ في الحذف', 'error');
            return;
        }
    } else {
        localStorage.setItem('cart', JSON.stringify(cartItems));
    }

    cartItems.splice(index, 1);
    renderCart();
};

// ==================== ملخص السلة ====================
function updateSummary(total) {
    const subtotalElem      = document.getElementById('subtotal');
    const finalTotalElem    = document.getElementById('final-total');
    const finalTotalNum     = document.getElementById('final-total-num');
    const countElem         = document.getElementById('items-count');
    const checkoutTotalElem = document.getElementById('checkout-total-display');

    if (subtotalElem)       subtotalElem.textContent     = `${total} MRU`;
    if (finalTotalElem)     finalTotalElem.textContent   = `${total} MRU`;
    if (finalTotalNum)      finalTotalNum.textContent    = total;
    if (countElem)          countElem.textContent        = cartItems.length;
    if (checkoutTotalElem)  checkoutTotalElem.textContent = `${total} MRU`;
}

function updateCartBadge() {
    const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

    let badge = document.querySelector('.cart-badge');
    const cartIcon = document.querySelector('a[href="cart.html"]');

    if (!cartIcon) return;

    if (!badge) {
        cartIcon.style.position = 'relative';
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.style.cssText = `
            position: absolute; top: -8px; left: -8px;
            background: #f97316; color: white;
            border-radius: 50%; width: 18px; height: 18px;
            font-size: 11px; display: flex;
            align-items: center; justify-content: center; font-weight: bold;
        `;
        cartIcon.appendChild(badge);
    }

    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

// ==================== أيقونة المستخدم ====================
async function checkUserIcon() {
    const { data: { session } } = await supabase.auth.getSession();
    const userBtn = document.getElementById('user-icon-btn');
    if (!userBtn) return;

    if (session?.user) {
        const avatarUrl = session.user.user_metadata?.avatar_url || '';
        if (avatarUrl) {
            userBtn.innerHTML = `
                <img src="${avatarUrl}"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #f97316;display:block;">
                <i class="fas fa-user-check" style="display:none;"></i>`;
        } else {
            userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
        }
        userBtn.style.cssText = 'padding:0;background:transparent;border:none;';
        userBtn.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('user-dropdown')?.classList.toggle('show');
        };
    } else {
        userBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        userBtn.title = 'تسجيل الدخول';
        userBtn.onclick = () => { window.location.href = 'login.html'; };
    }
}

// ==================== الدفع ====================
window.processCheckout = () => {
    if (cartItems.length === 0) {
        showToast("سلتك فارغة! قم بإضافة بطاقات أولاً.", 'error');
        return;
    }
    window.location.href = "checkout.html";
};

// ==================== تسجيل الخروج ====================
window.handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        localStorage.clear();
        window.location.href = "index.html";
    } else {
        console.error("Logout Error:", error);
    }
};

// ==================== الثيم ====================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// ==================== التنبيهات ====================
function showToast(message, type = 'success') {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.textContent = message;
    const colors = { success: '#22c55e', error: '#ef4444', warning: '#f97316' };
    t.style.cssText = `
        position:fixed; top:24px; left:50%;
        transform:translateX(-50%) translateY(-10px);
        background:${colors[type] || colors.success};
        color:white; padding:12px 24px; border-radius:10px;
        font-size:14px; font-weight:700;
        font-family:'Tajawal',sans-serif;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
        opacity:0; transition:opacity .3s,transform .3s;
        pointer-events:none; white-space:nowrap;
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
        t.style.opacity = '1';
        t.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => t.remove(), 300);
    }, 2800);
}