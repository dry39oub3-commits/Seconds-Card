import { supabase } from './supabase-config.js';

// --- 1. تشغيل الدوال الأساسية عند التحميل ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupUserMenu();
    displayProducts();
    updateCartBadge();
    checkUserIcon();
    setupSearch(); // ← أضف هذا
});



// --- 2. إدارة الوضع الليلي (Dark Mode) ---
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.onclick = (e) => {
        e.preventDefault();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    };
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// --- 3. إدارة قائمة المستخدم ---
function setupUserMenu() {
    const userBtn = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');

    if (!userBtn || !userDropdown) return;

    userBtn.onclick = (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
    };

    window.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
}

// دالة تسجيل الخروج العامة
window.handleLogout = async function() {
    if (confirm("هل تريد تسجيل الخروج؟")) {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            window.location.href = 'login.html';
        } else {
            console.error("Logout Error:", error);
        }
    }
};

// --- 4. جلب وعرض المنتجات من Supabase ---
async function displayProducts() {
    const cardsGrid = document.getElementById('cards-grid');
    if (!cardsGrid) return;

    const { data: products, error } = await supabase
        .from("products")
        .select("*")
        .order("id", { ascending: false });

    if (error) {
        console.error("Supabase Error:", error);
        cardsGrid.innerHTML = '<p class="error-msg">حدث خطأ في جلب البيانات.</p>';
        return;
    }

    cardsGrid.innerHTML = "";

    if (!products || products.length === 0) {
        cardsGrid.innerHTML = '<p class="no-products">لا توجد بطاقات متاحة حالياً.</p>';
        return;
    }

products.forEach((product) => {
    const cardHTML = `
        <div class="card-item" onclick="window.location.href='product-details.html?id=${product.id}'" style="cursor: pointer;">
            <div class="card-image">
                <img src="${product.image || 'assets/placeholder.png'}" alt="${product.name}" onerror="this.src='assets/placeholder.png'">
            </div>
            <div class="card-info">
                <h3>${product.name || 'منتج بدون اسم'}</h3>
                <button class="view-btn">عرض الفئات <i class="fas fa-chevron-left"></i></button>
            </div>
        </div>
    `;
    cardsGrid.insertAdjacentHTML('beforeend', cardHTML);
});
}


// ===== البحث =====
function setupSearch() {
    const searchInput = document.getElementById('main-search');
    const searchBtn = document.querySelector('.search-bar button');
    if (!searchInput) return;

    // بحث عند الكتابة
    searchInput.addEventListener('input', () => {
        searchProducts(searchInput.value.trim());
    });

    // بحث عند الضغط على Enter
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchProducts(searchInput.value.trim());
    });

    // بحث عند الضغط على الزر
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchProducts(searchInput.value.trim());
        });
    }
}

function searchProducts(query) {
    const cardsGrid = document.getElementById('cards-grid');
    const allCards = cardsGrid.querySelectorAll('.card-item');

    if (!query) {
        // إظهار كل البطاقات لو البحث فارغ
        allCards.forEach(card => card.style.display = '');
        return;
    }

    const lowerQuery = query.toLowerCase();
    let found = 0;

    allCards.forEach(card => {
        const name = card.querySelector('h3')?.textContent.toLowerCase() || '';
        if (name.includes(lowerQuery)) {
            card.style.display = '';
            found++;
        } else {
            card.style.display = 'none';
        }
    });

    // رسالة لو ما في نتائج
    const noResult = document.getElementById('no-search-result');
    if (found === 0) {
        if (!noResult) {
            const msg = document.createElement('p');
            msg.id = 'no-search-result';
            msg.style.cssText = 'text-align:center; color:#94a3b8; padding:30px; width:100%;';
            msg.textContent = `لا توجد نتائج لـ "${query}"`;
            cardsGrid.appendChild(msg);
        }
    } else {
        noResult?.remove();
    }
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
async function checkUserIcon() {
    const { data: { session } } = await supabase.auth.getSession();
    const userIcon = document.querySelector('#user-icon-btn i');
    if (userIcon && session?.user) {
        userIcon.className = 'fas fa-user-check';
    }
}

        document.addEventListener('DOMContentLoaded', () => {

            // ===== SLIDER =====
            const wrapper = document.getElementById('slidesWrapper');
            const slides = wrapper.querySelectorAll('.slide');
            const dotsContainer = document.getElementById('sliderDots');
            let current = 0;
            let timer;

            // إنشاء النقاط
            slides.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = 'dot' + (i === 0 ? ' active' : '');
                dot.onclick = () => goTo(i);
                dotsContainer.appendChild(dot);
            });

            function goTo(index) {
                current = (index + slides.length) % slides.length;
                wrapper.style.transform = `translateX(${current * 100}%)`;
                document.querySelectorAll('.dot').forEach((d, i) => {
                    d.classList.toggle('active', i === current);
                });
            }

            function next() { goTo(current + 1); }
            function prev() { goTo(current - 1); }

            document.getElementById('sliderNext').onclick = () => { clearInterval(timer); next(); startTimer(); };
            document.getElementById('sliderPrev').onclick = () => { clearInterval(timer); prev(); startTimer(); };

            function startTimer() { timer = setInterval(next, 4000); }
            startTimer();

            // ===== THEME =====
            const themeBtn = document.getElementById('theme-toggle');
            if (themeBtn) {
                const savedTheme = localStorage.getItem('theme') || 'light';
                document.documentElement.setAttribute('data-theme', savedTheme);

                themeBtn.onclick = (e) => {
                    e.preventDefault();
                    const current = document.documentElement.getAttribute('data-theme');
                    const target = current === 'light' ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', target);
                    localStorage.setItem('theme', target);
                    const icon = themeBtn.querySelector('i');
                    if (icon) icon.className = target === 'light' ? 'fas fa-moon' : 'fas fa-sun';
                };
            }

            // ===== USER MENU =====
            const userBtn = document.getElementById('user-icon-btn');
            const userMenu = document.getElementById('user-dropdown');
            if (userBtn && userMenu) {
                userBtn.onclick = (e) => { e.stopPropagation(); userMenu.classList.toggle('show'); };
                document.addEventListener('click', (e) => {
                    if (!userMenu.contains(e.target) && !userBtn.contains(e.target)) {
                        userMenu.classList.remove('show');
                    }
                });
            }
        });


        // ===== SLIDER من Supabase =====
async function initSlider() {
    const { data: slides, error } = await supabase
        .from('sliders')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error || !slides || slides.length === 0) return;

    const wrapper = document.getElementById('slidesWrapper');
    const dotsContainer = document.getElementById('sliderDots');

    // رسم الشرائح
wrapper.innerHTML = slides.map(s => {
    const bgStyle = s.image_url
        ? `background-image: linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('${s.image_url}'); background-size:cover; background-position:center;`
        : `background: ${s.gradient || '#1e293b'};`;

    return `
        <div class="slide" style="${bgStyle}">
            <h2>${s.title}</h2>
            ${s.subtitle ? `<p>${s.subtitle}</p>` : ''}
            <a href="${s.btn_link || '#cards-grid'}" class="slide-btn">${s.btn_text || 'تسوق الآن'}</a>
        </div>
    `;
}).join('');

    // تشغيل الـ slider
    let current = 0;
    let timer;

    function goTo(index) {
        current = (index + slides.length) % slides.length;
        wrapper.style.transform = `translateX(${current * 100}%)`;
        document.querySelectorAll('.dot').forEach((d, i) => {
            d.classList.toggle('active', i === current);
        });
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    document.getElementById('sliderNext').onclick = () => { clearInterval(timer); next(); startTimer(); };
    document.getElementById('sliderPrev').onclick = () => { clearInterval(timer); prev(); startTimer(); };

    function startTimer() { timer = setInterval(next, 4000); }
    startTimer();
}

initSlider();

