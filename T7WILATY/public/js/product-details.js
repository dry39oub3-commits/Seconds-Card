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
}

function renderProduct(product) {
    const prices = Array.isArray(product.prices) ? product.prices : [];

    const pricesHTML = prices.map((p, i) => `
        <div class="price-card" onclick="selectPrice(${i}, ${p.value})" id="price-${i}">
            <div class="label">${p.label}</div>
            <div class="value">${p.value} MRU</div>
        </div>
    `).join('');

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
        <button class="add-to-cart-btn" id="add-btn" onclick="addToCart()" disabled>
            <i class="fas fa-cart-plus"></i> أضف إلى السلة
        </button>
    `;
}

window.selectPrice = function(index, value) {
    document.querySelectorAll('.price-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`price-${index}`).classList.add('selected');
    selectedPrice = { index, value, label: currentProduct.prices[index].label };
    document.getElementById('add-btn').disabled = false;
};

window.addToCart = function() {
    if (!selectedPrice) return;
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push({
        productId: currentProduct.id,
        name: currentProduct.name,
        image: currentProduct.image,
        label: selectedPrice.label,
        price: selectedPrice.value
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    alert('تمت الإضافة إلى السلة ✅');
    window.location.href = 'cart.html';
};

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