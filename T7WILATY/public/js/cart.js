import { supabase } from './supabase-config.js';

let cart = JSON.parse(localStorage.getItem('cart')) || [];

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    renderCart();
    checkAuthState();
    checkUserIcon();
});

async function checkUserIcon() {
    const { data: { session } } = await supabase.auth.getSession();
    const userBtn = document.getElementById('user-icon-btn');
    if (!userBtn) return;

    if (session?.user) {
        const user = session.user;
        const avatarUrl = user.user_metadata?.avatar_url || '';

        if (avatarUrl) {
            // ← صورة المستخدم
            userBtn.innerHTML = `
                <img src="${avatarUrl}" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     style="width:32px; height:32px; border-radius:50%; object-fit:cover;
                            border:2px solid #f97316; display:block;">
                <i class="fas fa-user-check" style="display:none;"></i>
            `;
        } else {
            userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
        }

        userBtn.style.padding = '0';
        userBtn.style.background = 'transparent';
        userBtn.style.border = 'none';

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


// --- 2. عرض محتويات السلة وتحديث الواجهة ---
function renderCart() {
    const list = document.getElementById('cart-items-list');
    const emptyMsg = document.getElementById('empty-cart-msg');

    if (!list) return;

    if (cart.length === 0) {
        list.innerHTML = "";
        if (emptyMsg) emptyMsg.style.display = 'block';
        updateSummary(0);
        return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    let html = '<h2>سلة المشتريات</h2>';
    let total = 0;

    cart.forEach((item, index) => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQty = parseInt(item.quantity) || 1;
        total += itemPrice * itemQty;

        html += `
            <div class="cart-item">
                <img src="${item.image || 'assets/placeholder.png'}" alt="${item.name}">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    ${item.label ? `<span style="font-size:12px; color:#f97316; background:rgba(249,115,22,0.1); padding:2px 8px; border-radius:20px; display:inline-block; margin-bottom:4px;">${item.label}</span>` : ''}
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

// --- 3. وظائف التحكم (تحديث الكمية والحذف) ---
window.updateQty = (index, change) => {
    if (!cart[index].quantity) cart[index].quantity = 1;
    const newQty = cart[index].quantity + change;
    if (newQty > 5) {
        showToast('⚠️ لا يمكن إضافة أكثر من 5 قطع!', 'warning');
        return;
    }
    if (newQty > 0) {
        cart[index].quantity = newQty;
        saveAndReload();
    }
};

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#22c55e' : '#c70d0d'};
        color: white;
        padding: 14px 28px;
        border-radius: 12px;
        font-size: 16px;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: opacity 0.5s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
}

window.removeItem = (index) => {
    cart.splice(index, 1);
    saveAndReload();
};

function saveAndReload() {
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
}

function updateSummary(total) {
    const subtotalElem = document.getElementById('subtotal');
    const finalTotalElem = document.getElementById('final-total');
    const countElem = document.getElementById('items-count');
    const checkoutTotalElem = document.getElementById('checkout-total-display');

    if (subtotalElem) subtotalElem.textContent = `${total} MRU`;
    if (finalTotalElem) finalTotalElem.textContent = `${total} MRU`;
    if (countElem) countElem.textContent = cart.length;
    if (checkoutTotalElem) checkoutTotalElem.textContent = `${total} MRU`;
}

// --- 4. معالجة الانتقال للدفع ---
window.processCheckout = () => {
    if (cart.length === 0) {
        showToast("سلتك فارغة! قم بإضافة بطاقات أولاً.");
        return;
    }
    window.location.href = "checkout.html";
};




function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userBtn && userDropdown) {
        userBtn.onclick = (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        };
        window.onclick = () => userDropdown.classList.remove('show');
    }
}

window.handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        localStorage.clear();
        window.location.href = "index.html";
    } else {
        console.error("Logout Error:", error);
    }
};


function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    // أضف badge إذا لم يكن موجوداً
    let badge = document.querySelector('.cart-badge');
    const cartIcon = document.querySelector('a[href="cart.html"]');
    
    if (!cartIcon) return;
    
    if (!badge) {
        cartIcon.style.position = 'relative';
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.style.cssText = `
            position: absolute;
            top: -8px;
            left: -8px;
            background: #f97316;
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        `;
        cartIcon.appendChild(badge);
    }
    
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
    
    }

function showToast(message, type = 'success') {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.textContent = message;
    t.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(-10px);
        background: ${type === 'success' ? '#22c55e' : '#ef4444'};
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 700;
        font-family: 'Tajawal', sans-serif;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        pointer-events: none;
        white-space: nowrap;
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