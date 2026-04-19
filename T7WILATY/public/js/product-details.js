import { supabase } from './supabase-config.js';

const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

let selectedPrice = null;
let currentProduct = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    if (productId) loadProduct();
    else document.getElementById('product-content').innerHTML = '<p style="text-align:center">منتج غير موجود.</p>';
});

async function loadProduct() {
    const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (error || !product) {
        document.getElementById('product-content').innerHTML = '<p style="text-align:center">لم يتم العثور على المنتج.</p>';
        return;
    }

    currentProduct = product;
    renderProduct(product);
    updateCartBadge();
}

function renderProduct(product) {
    const prices = (Array.isArray(product.prices) ? product.prices : [])
        .map((p, i) => ({ ...p, _originalIndex: i }))  // ← احفظ الindex الأصلي
        .sort((a, b) => (a.value || 0) - (b.value || 0)); // ← رتّب من الأصغر للأكبر

    const pricesHTML = prices.map((p) => {
        const i = p._originalIndex; // ← استخدم الindex الأصلي لـ selectPrice
        if (p.active === false) {
            return `
                <div class="price-card disabled" style="opacity:0.4; cursor:not-allowed; pointer-events:none; position:relative;">
                    <div class="label">${p.label}</div>
                    <div class="value">${p.value} MRU</div>
                    <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:12px; color:#ef4444; font-weight:bold;">غير متاح</div>
                </div>
            `;
        }
        return `
            <div class="price-card" onclick="selectPrice(${i}, ${p.value})" id="price-${i}">
                <div class="label">${p.label}</div>
                <div class="value">${p.value} MRU</div>
            </div>
        `;
    }).join('');

    document.getElementById('product-content').innerHTML = `
        <div class="product-header">
            <img src="${product.image || 'assets/placeholder.png'}" alt="${product.name}" onerror="this.src='assets/placeholder.png'">
            <div>
                <h1>${product.name}</h1>
                <p class="country"><i class="fas fa-globe"></i> ${product.country || 'غير محدد'}</p>
            </div>
        </div>
        <h2 class="prices-title">اختر الفئة:</h2>
        <div class="prices-grid">${pricesHTML}</div>

        <div class="action-buttons">
            <button class="add-to-cart-btn" id="add-btn" onclick="addToCart()" disabled>
                <i class="fas fa-cart-plus"></i> أضف إلى السلة
            </button>
            <button class="buy-now-btn" id="buy-btn" onclick="buyNow()" disabled>
                <i class="fas fa-bolt"></i> اشتر الآن
            </button>
        </div>
    `;
}

window.selectPrice = function(index, value) {
    document.querySelectorAll('.price-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`price-${index}`).classList.add('selected');
    selectedPrice = { index, value, label: currentProduct.prices[index].label };
    document.getElementById('add-btn').disabled = false;
    document.getElementById('buy-btn').disabled = false;
};


window.buyNow = function() {
    if (!selectedPrice) return;

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');

    const exists = cart.find(
        item => item.productId === currentProduct.id && item.label === selectedPrice.label
    );

    if (!exists) {
        cart.push({
            productId: currentProduct.id,
            name: currentProduct.name,
            image: currentProduct.image,
            label: selectedPrice.label,
            price: selectedPrice.value,
            quantity: 1
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
    }

    // الانتقال مباشرة إلى صفحة الدفع
    window.location.href = 'cart.html';
};

window.addToCart = function() {
    if (!selectedPrice) return;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    const exists = cart.find(
        item => item.productId === currentProduct.id && item.label === selectedPrice.label
    );
    
    if (exists) {
        showToast('⚠️ هذه البطاقة بنفس الفئة موجودة مسبقاً في سلتك!', 'warning');
        return;
    }
    
    cart.push({
        productId: currentProduct.id,
        name: currentProduct.name,
        image: currentProduct.image,
        label: selectedPrice.label,
        price: selectedPrice.value,
        quantity: 1
    });
    
    localStorage.setItem('cart', JSON.stringify(cart));
    showToast('✅ تمت الإضافة إلى السلة!', 'success');
    
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

window.handleLogout = async function() {
    if (confirm("هل تريد تسجيل الخروج؟")) {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    }
};

function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    };
}

function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (!userBtn || !userDropdown) return;
    userBtn.onclick = (e) => { e.stopPropagation(); userDropdown.classList.toggle('show'); };
    window.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userBtn.contains(e.target))
            userDropdown.classList.remove('show');
    });
}


function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
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
window.addToCart = function() {
    if (!selectedPrice) return;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    const exists = cart.find(
        item => item.productId === currentProduct.id && item.label === selectedPrice.label
    );
    
    if (exists) {
        showToast('⚠️ هذه البطاقة بنفس الفئة موجودة مسبقاً في سلتك!', 'warning');
        return;
    }
    
    cart.push({
        productId: currentProduct.id,
        name: currentProduct.name,
        image: currentProduct.image,
        label: selectedPrice.label,
        price: selectedPrice.value,
        quantity: 1
    });
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge(); // ← تحديث فوري
    showToast('✅ تمت الإضافة إلى السلة!', 'success');
};