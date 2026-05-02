/* eslint-disable */
import { supabase } from './supabase-config.js';

const params    = new URLSearchParams(window.location.search);
const productId = params.get('id');

let selectedPrice  = null;
let currentProduct = null;

// ✅ دالة مساعدة — تقرأ العملة الحالية دائماً من localStorage
function getCurrency() {
    return localStorage.getItem('currency') || 'MRU';
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    if (productId) loadProduct();
    else document.getElementById('product-content').innerHTML =
        '<p style="text-align:center">منتج غير موجود.</p>';
});

// ✅ الاستماع لتغيير العملة من header.js (نفس الصفحة)
window.addEventListener('currency-changed', (e) => {
    refreshPrices();
});

// ✅ الاستماع لتغيير localStorage من أي تبويب أو صفحة أخرى
window.addEventListener('storage', (e) => {
    if (e.key === 'currency') {
        refreshPrices();
    }
});

// ✅ إعادة رسم الأسعار بالعملة الحالية
function refreshPrices() {
    selectedPrice = null;
    if (document.getElementById('add-btn')) document.getElementById('add-btn').disabled = true;
    if (document.getElementById('buy-btn')) document.getElementById('buy-btn').disabled = true;

    if (!currentProduct) return;
    const prices = buildPricesList(currentProduct);
    const grid   = document.getElementById('prices-grid');
    if (grid) grid.innerHTML = renderPrices(prices, getCurrency());
}

// ==================== تحميل المنتج ====================
async function loadProduct() {
    const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (error || !product) {
        document.getElementById('product-content').innerHTML =
            '<p style="text-align:center">لم يتم العثور على المنتج.</p>';
        return;
    }

    currentProduct = product;
    renderProduct(product);
    await loadProductDescription(product.name);
    updateCartBadge();
}

// ==================== وصف المنتج ====================
async function loadProductDescription(productName) {
    const { data, error } = await supabase
        .from('product_descriptions')
        .select('*')
        .eq('product_name', productName)
        .single();

    if (error || !data) return;

    let html = '';

    if (data.description) {
        html += `
        <div class="product-desc-section">
            <h3><i class="fas fa-info-circle"></i> وصف البطاقة</h3>
            <p>${data.description.replace(/\n/g, '<br>')}</p>
        </div>`;
    }

    if (data.instructions) {
        const steps   = data.instructions.split('\n').map(s => s.trim()).filter(s => s);
        const linkify = (text) => text.replace(
            /(https?:\/\/[^\s)]+)/g,
            '<a href="$1" target="_blank" rel="noopener" class="step-link">صفحة استرداد الرمز</a>'
        );
        html += `
        <div class="product-desc-section">
            <h3><i class="fas fa-list-ul"></i> إرشادات الاستخدام</h3>
            <ul class="steps-list">
                ${steps.map(s => `<li>${linkify(s)}</li>`).join('')}
            </ul>
        </div>`;
    }

    if (html) {
        const container = document.createElement('div');
        container.id    = 'product-description-block';
        container.innerHTML = html;
        document.getElementById('product-content').appendChild(container);
    }
}

// ==================== بناء قائمة الأسعار ====================
function buildPricesList(product) {
    return (Array.isArray(product.prices) ? product.prices : [])
        .map((p, i) => ({ ...p, _originalIndex: i }))
        .sort((a, b) => (a.value || 0) - (b.value || 0));
}

// ==================== رسم المنتج ====================
function renderProduct(product) {
    const prices = buildPricesList(product);

    document.getElementById('product-content').innerHTML = `
    <div class="product-header">
        <img src="${product.image || 'assets/placeholder.png'}" alt="${product.name}"
             onerror="this.src='assets/placeholder.png'">
        <div>
            <h1>${product.name}</h1>
            <p class="country"><i class="fas fa-globe"></i> ${product.country || 'غير محدد'}</p>
        </div>
    </div>

    <h2 class="prices-title">اختر الفئة:</h2>
    <div class="prices-grid" id="prices-grid">${renderPrices(prices, getCurrency())}</div>

    <div class="action-buttons">
        <button class="add-to-cart-btn" id="buy-btn" onclick="buyNow()" disabled>
            <i class="fas fa-bolt"></i> اشتر الآن
        </button>
        <button class="add-to-cart-btn" id="add-btn" onclick="addToCart()" disabled>
            <i class="fas fa-cart-plus"></i> أضف إلى السلة
        </button>
    </div>`;
}

// ==================== رسم الأسعار ====================
function renderPrices(prices, currency) {
    return prices.map((p) => {
        const i = p._originalIndex;

        let displayPrice, priceValue;

        if (currency === 'USDT') {
            if (!p.usdt_price) return ''; // إخفاء الفئة إذا لا يوجد سعر USDT
            displayPrice = `${p.usdt_price} USDT`;
            priceValue   = p.usdt_price;
        } else {
            displayPrice = `${p.value} MRU`;
            priceValue   = p.value;
        }

        if (p.active === false) {
            return `
            <div class="price-card disabled"
                 style="opacity:0.4;cursor:not-allowed;pointer-events:none;position:relative;">
                <div class="label">${p.label}</div>
                <div class="value">${displayPrice}</div>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                            font-size:12px;color:#ef4444;font-weight:bold;">غير متاح</div>
            </div>`;
        }

        return `
        <div class="price-card" onclick="selectPrice(${i}, ${priceValue}, '${currency}')" id="price-${i}">
            <div class="label">${p.label}</div>
            <div class="value">${displayPrice}</div>
        </div>`;
    }).join('');
}

// ==================== اختيار الفئة ====================
window.selectPrice = function(index, value, currency) {
    document.querySelectorAll('.price-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById(`price-${index}`);
    if (card) card.classList.add('selected');

    selectedPrice = {
        index,
        value,
        label:    currentProduct.prices[index].label,
        currency: currency || getCurrency()
    };

    if (document.getElementById('add-btn')) document.getElementById('add-btn').disabled = false;
    if (document.getElementById('buy-btn')) document.getElementById('buy-btn').disabled = false;
};

// ==================== شراء الآن ====================
window.buyNow = function() {
    if (!selectedPrice) return;
    const cart   = JSON.parse(localStorage.getItem('cart') || '[]');
    const exists = cart.find(
        item => item.productId === currentProduct.id && item.label === selectedPrice.label
    );
    if (!exists) {
        cart.push({
            productId: currentProduct.id,
            name:      currentProduct.name,
            image:     currentProduct.image,
            label:     selectedPrice.label,
            price:     selectedPrice.value,
            currency:  selectedPrice.currency,
            quantity:  1
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
    }
    window.location.href = 'cart.html';
};

// ==================== إضافة للسلة ====================
window.addToCart = function() {
    if (!selectedPrice) return;
    const cart   = JSON.parse(localStorage.getItem('cart') || '[]');
    const exists = cart.find(
        item => item.productId === currentProduct.id && item.label === selectedPrice.label
    );
    if (exists) {
        showToast('⚠️ هذه البطاقة بنفس الفئة موجودة مسبقاً في سلتك!', 'warning');
        return;
    }
    cart.push({
        productId: currentProduct.id,
        name:      currentProduct.name,
        image:     currentProduct.image,
        label:     selectedPrice.label,
        price:     selectedPrice.value,
        currency:  selectedPrice.currency,
        quantity:  1
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartBadge();
    showToast('✅ تمت الإضافة إلى السلة!', 'success');
};

// ==================== Toast ====================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
        background:${type === 'success' ? '#22c55e' : '#c70d0d'};
        color:white; padding:14px 28px; border-radius:12px;
        font-size:16px; z-index:9999;
        box-shadow:0 4px 20px rgba(0,0,0,0.3); transition:opacity 0.5s;
        font-family:'Cairo',sans-serif;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
}

// ==================== Logout ====================
window.handleLogout = async function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    }
};

// ==================== Theme ====================
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.onclick = () => {
        const current  = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    };
}

// ==================== User Menu ====================
function setupUserMenu() {
    const userBtn      = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (!userBtn || !userDropdown) return;
    userBtn.onclick = (e) => { e.stopPropagation(); userDropdown.classList.toggle('show'); };
    window.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userBtn.contains(e.target))
            userDropdown.classList.remove('show');
    });
}

// ==================== Cart Badge ====================
function updateCartBadge() {
    const cart       = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartIcon   = document.querySelector('a[href="cart.html"]');
    if (!cartIcon) return;

    let badge = cartIcon.querySelector('.cart-badge');
    if (!badge) {
        cartIcon.style.position = 'relative';
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.style.cssText = `
            position:absolute; top:-8px; left:-8px;
            background:#f97316; color:white; border-radius:50%;
            width:18px; height:18px; font-size:11px;
            display:flex; align-items:center; justify-content:center; font-weight:bold;
        `;
        cartIcon.appendChild(badge);
    }
    badge.textContent   = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}