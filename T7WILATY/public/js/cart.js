import { supabase } from './supabase-config.js';

// جلب بيانات السلة من التخزين المحلي (LocalStorage)
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// --- 1. تشغيل الدوال الأساسية عند التحميل ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    renderCart();
    checkAuthState();
});

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
}

// --- 3. وظائف التحكم (تحديث الكمية والحذف) ---
window.updateQty = (index, change) => {
    if (cart[index].quantity + change > 0) {
        cart[index].quantity += change;
        saveAndReload();
    }
};

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

    if (subtotalElem) subtotalElem.textContent = `${total} MRU`;
    if (finalTotalElem) finalTotalElem.textContent = `${total} MRU`;
    if (countElem) countElem.textContent = cart.length;
}

// --- 4. معالجة الانتقال للدفع ---
window.processCheckout = () => {
    if (cart.length === 0) {
        alert("سلتك فارغة! قم بإضافة بطاقات أولاً.");
        return;
    }
    window.location.href = "checkout.html";
};

// --- 5. مراقب حالة تسجيل الدخول ---
async function checkAuthState() {
    const { data: { session } } = await supabase.auth.getSession();
    const userIcon = document.querySelector('#user-icon-btn i');

    if (session?.user) {
        if (userIcon) userIcon.className = 'fas fa-user-check';
    } else {
        if (userIcon) userIcon.className = 'fas fa-user';
    }

    supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
            if (userIcon) userIcon.className = 'fas fa-user-check';
        } else {
            if (userIcon) userIcon.className = 'fas fa-user';
        }
    });
}

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