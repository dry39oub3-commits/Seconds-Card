import { supabase } from './supabase-config.js';

// ==================== بناء الهيدر ====================
function buildHeader() {
    const header = document.createElement('header');
    header.className = 'main-header';
    header.innerHTML = `
        <div class="header-container">
            <a href="index.html" class="logo-link" style="text-decoration:none;">
                <div class="logo" style="display:flex; align-items:center; gap:10px;">
                    <img src="assets/Icon.png" alt="StoreCard"
                         style="height:40px; width:40px; object-fit:contain;">
                    <div style="display:flex; flex-direction:column; line-height:1.1;">
                        <span style="font-size:18px; font-weight:800; color:white;">
                            Store<span style="color:#f97316;">Card</span>
                        </span>
                    </div>
                </div>
            </a>

            <div class="search-container">
                <div class="search-bar">
                    <input type="text" id="main-search" placeholder="ابحث عن بطاقة...">
                    <button><i class="fas fa-search"></i></button>
                </div>
            </div>

            <div class="header-actions">
                <button id="theme-toggle" class="action-btn">
                    <i class="fas fa-moon"></i>
                </button>

                <a href="cart.html" class="action-btn" id="cart-icon-link" style="position:relative;">
                    <i class="fas fa-shopping-cart"></i>
                </a>

                <div class="user-menu-container">
                    <button class="action-btn" id="user-icon-btn">
                        <i class="fas fa-user-circle"></i>
                    </button>
                    <div class="dropdown-menu" id="user-dropdown">
                        <nav class="dropdown-nav">
                            <a href="orders.html"><i class="fas fa-box"></i> طلباتي</a>
                            <a href="wallet.html"><i class="fas fa-wallet"></i> المحفظة</a>
                            <a href="profile.html"><i class="fas fa-user"></i> حسابي</a>
                            <hr>
                            <button onclick="handleLogout()" class="logout-btn">
                                <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentElement('afterbegin', header);
}

// ==================== إعداد الثيم ====================
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.onclick = (e) => {
        e.preventDefault();
        const cur  = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    };
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ==================== أيقونة المستخدم ====================
async function initUserIcon() {
    const { data: { session } } = await supabase.auth.getSession();
    const userBtn      = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (!userBtn) return;

    if (session?.user) {
        const user      = session.user;
        const avatarUrl = user.user_metadata?.avatar_url || '';

        if (avatarUrl) {
            userBtn.innerHTML = `
                <img src="${avatarUrl}"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"
                     style="width:32px; height:32px; border-radius:50%; object-fit:cover;
                            border:2px solid #f97316; display:block; pointer-events:none;">
                <i class="fas fa-user-check" style="display:none;"></i>
            `;
            userBtn.style.cssText = 'padding:0; background:transparent; border:none; cursor:pointer;';
        } else {
            userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
        }

        userBtn.onclick = (e) => {
            e.stopPropagation();
            userDropdown?.classList.toggle('show');
        };

        window.addEventListener('click', (e) => {
            if (!userDropdown?.contains(e.target) && !userBtn.contains(e.target)) {
                userDropdown?.classList.remove('show');
            }
        });

    } else {
        userBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        userBtn.title     = 'تسجيل الدخول';
        userBtn.onclick   = () => { window.location.href = 'login.html'; };
    }
}

// ==================== badge السلة ====================
function updateCartBadge() {
    const cart       = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartLink   = document.getElementById('cart-icon-link');
    if (!cartLink) return;

    let badge = cartLink.querySelector('.cart-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.style.cssText = `
            position:absolute; top:-8px; left:-8px;
            background:#f97316; color:white; border-radius:50%;
            width:18px; height:18px; font-size:11px;
            display:flex; align-items:center; justify-content:center;
            font-weight:bold; pointer-events:none;
        `;
        cartLink.appendChild(badge);
    }
    badge.textContent   = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
}

// ==================== تحديث أيقونة الهيدر من الخارج ====================
window.updateHeaderAvatar = function(photoUrl) {
    const userBtn      = document.getElementById('user-icon-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (!userBtn) return;

    if (photoUrl) {
        userBtn.innerHTML = `
            <img src="${photoUrl}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"
                 style="width:32px; height:32px; border-radius:50%; object-fit:cover;
                        border:2px solid #f97316; display:block; pointer-events:none;">
            <i class="fas fa-user-check" style="display:none;"></i>
        `;
        userBtn.style.cssText = 'padding:0; background:transparent; border:none; cursor:pointer;';
    } else {
        userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
    }
    userBtn.onclick = (e) => {
        e.stopPropagation();
        userDropdown?.classList.toggle('show');
    };
};

// ==================== تسجيل الخروج ====================
window.handleLogout = async function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

// ==================== البحث ====================
function initSearch() {
    const input  = document.getElementById('main-search');
    const btnSrh = document.querySelector('.search-bar button');
    if (!input) return;

    const doSearch = () => {
        const q = input.value.trim();
        if (!q) return;
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = `index.html?q=${encodeURIComponent(q)}`;
        } else {
            window.dispatchEvent(new CustomEvent('header-search', { detail: q }));
        }
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    btnSrh?.addEventListener('click', doSearch);

    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
        input.value = urlQ;
        window.dispatchEvent(new CustomEvent('header-search', { detail: urlQ }));
    }
}

// ==================== تشغيل الكل ====================
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.main-header')) buildHeader();
    initTheme();
    initUserIcon();
    updateCartBadge();
    initSearch();
    applyStoredSettings(); // ✅ تطبيق اللغة والاتجاه عند كل تحميل
});

// ==================== تطبيق الإعدادات المخزنة ====================
function applyStoredSettings() {
    const lang = localStorage.getItem('lang') || 'ar';
    const dir  = ALL_LANGUAGES.find(l => l.code === lang)?.dir || 'rtl';
    document.documentElement.setAttribute('dir',  dir);
    document.documentElement.setAttribute('lang', lang);

    // ✅ إذا كانت اللغة مخزنة وليست عربية → طبّق الترجمة
    if (lang !== 'ar') {
        // نترجم بعد تحميل DOM كاملاً
        setTimeout(() => translatePage(lang), 300);
    }
}

// ==================== نظام الترجمة — MyMemory API مجاني ====================
const translationCache = {};

// ترجمة نص واحد
async function translateText(text, targetLang) {
    if (!text?.trim() || targetLang === 'ar') return text;
    const key = `${targetLang}:${text}`;
    if (translationCache[key]) return translationCache[key];

    try {
        const res  = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|${targetLang}`
        );
        const data = await res.json();
        const translated = data?.responseData?.translatedText || text;
        translationCache[key] = translated;
        return translated;
    } catch {
        return text;
    }
}

// ترجمة الصفحة كاملة — دفعات لتسريع العملية
async function translatePage(targetLang) {
    if (targetLang === 'ar') return;

    // عناصر نصية مباشرة (لا تحتوي على عناصر فرعية)
    const selector = [
        'h1','h2','h3','h4','h5','h6',
        'p','span','a','button','label',
        'td','th','li',
        '[data-translate]'
    ].join(',');

    const elements = [...document.querySelectorAll(selector)].filter(el => {
        const text = el.childNodes[0]?.textContent?.trim();
        return (
            text &&
            text.length > 1 &&
            el.childNodes.length === 1 &&
            el.childNodes[0].nodeType === Node.TEXT_NODE &&
            !el.closest('script, style, [data-no-translate]')
        );
    });

    // دفعات بحجم 10 لتجنب تجاوز حد MyMemory
    const BATCH = 10;
    for (let i = 0; i < elements.length; i += BATCH) {
        const batch = elements.slice(i, i + BATCH);
        const texts = batch.map(el => el.childNodes[0].textContent.trim());

        // MyMemory لا يدعم batch مباشرة → نستدعيها بالتوازي
        const translated = await Promise.all(
            texts.map(t => translateText(t, targetLang))
        );

        batch.forEach((el, idx) => {
            if (translated[idx] && translated[idx] !== texts[idx]) {
                el.childNodes[0].textContent = translated[idx];
            }
        });

        // استراحة قصيرة بين الدفعات لتجنب rate limit
        if (i + BATCH < elements.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }
}

// ==================== تحويل العملة ====================
// أسعار الصرف تقريبية نسبةً إلى MRU
const EXCHANGE_RATES = {
    MRU:  1,
    USDT: 1/43,   USD:  1/43,   EUR:  1/47,
    GBP:  1/54,   SAR:  1/11.5, AED:  1/11.7,
    KWD:  1/140,  QAR:  1/11.8, BHD:  1/114,
    OMR:  1/112,  JOD:  1/61,   EGP:  1/1.4,
    MAD:  1/4.3,  TND:  1/13.8, DZD:  1/0.32,
    LYD:  1/8.9,  SDG:  1/0.07, IQD:  1/0.033,
    JPY:  1/0.29, CNY:  1/5.9,  KRW:  1/0.032,
    INR:  1/0.52, TRY:  1/1.3,  RUB:  1/0.47,
    BRL:  1/8.6,  CAD:  1/31.7, AUD:  1/27.8,
    CHF:  1/48.5, NGN:  1/0.03, ZAR:  1/2.4,
};

// تحويل سعر بـ MRU إلى العملة المختارة
window.convertPrice = function(priceMRU) {
    const currency = localStorage.getItem('currency') || 'MRU';
    const rate     = EXCHANGE_RATES[currency] ?? EXCHANGE_RATES['MRU'];
    const converted = (priceMRU * rate);
    // تنسيق الأرقام
    const formatted = converted >= 1
        ? converted.toFixed(2)
        : converted.toFixed(4);
    const symbol = ALL_CURRENCIES.find(c => c.code === currency)?.symbol || currency;
    return `${formatted} ${symbol}`;
};

// ==================== قوائم اللغات والعملات ====================

const ALL_LANGUAGES = [
    { code:'ar',  flag:'🇸🇦', name:'العربية',           native:'العربية',             dir:'rtl' },
    { code:'fr',  flag:'🇫🇷', name:'Français',           native:'Français',            dir:'ltr' },
    { code:'en',  flag:'🇺🇸', name:'English',             native:'English',             dir:'ltr' },
    { code:'es',  flag:'🇪🇸', name:'Español',             native:'Español',             dir:'ltr' },
    { code:'de',  flag:'🇩🇪', name:'Deutsch',              native:'Deutsch',             dir:'ltr' },
    { code:'it',  flag:'🇮🇹', name:'Italiano',             native:'Italiano',            dir:'ltr' },
    { code:'pt',  flag:'🇧🇷', name:'Português',            native:'Português',           dir:'ltr' },
    { code:'ru',  flag:'🇷🇺', name:'Русский',              native:'Русский',             dir:'ltr' },
    { code:'zh',  flag:'🇨🇳', name:'中文',                 native:'中文 (普通话)',        dir:'ltr' },
    { code:'ja',  flag:'🇯🇵', name:'日本語',                native:'日本語',              dir:'ltr' },
    { code:'ko',  flag:'🇰🇷', name:'한국어',                native:'한국어',              dir:'ltr' },
    { code:'tr',  flag:'🇹🇷', name:'Türkçe',               native:'Türkçe',              dir:'ltr' },
    { code:'fa',  flag:'🇮🇷', name:'فارسی',                native:'فارسی',               dir:'rtl' },
    { code:'ur',  flag:'🇵🇰', name:'اردو',                 native:'اردو',                dir:'rtl' },
    { code:'hi',  flag:'🇮🇳', name:'हिन्दी',               native:'हिन्दी',              dir:'ltr' },
    { code:'bn',  flag:'🇧🇩', name:'বাংলা',                native:'বাংলা',               dir:'ltr' },
    { code:'vi',  flag:'🇻🇳', name:'Tiếng Việt',           native:'Tiếng Việt',          dir:'ltr' },
    { code:'th',  flag:'🇹🇭', name:'ภาษาไทย',              native:'ภาษาไทย',             dir:'ltr' },
    { code:'id',  flag:'🇮🇩', name:'Bahasa Indonesia',     native:'Bahasa Indonesia',    dir:'ltr' },
    { code:'ms',  flag:'🇲🇾', name:'Bahasa Melayu',        native:'Bahasa Melayu',       dir:'ltr' },
    { code:'nl',  flag:'🇳🇱', name:'Nederlands',           native:'Nederlands',          dir:'ltr' },
    { code:'pl',  flag:'🇵🇱', name:'Polski',               native:'Polski',              dir:'ltr' },
    { code:'sv',  flag:'🇸🇪', name:'Svenska',              native:'Svenska',             dir:'ltr' },
    { code:'da',  flag:'🇩🇰', name:'Dansk',                native:'Dansk',               dir:'ltr' },
    { code:'no',  flag:'🇳🇴', name:'Norsk',                native:'Norsk',               dir:'ltr' },
    { code:'fi',  flag:'🇫🇮', name:'Suomi',                native:'Suomi',               dir:'ltr' },
    { code:'cs',  flag:'🇨🇿', name:'Čeština',              native:'Čeština',             dir:'ltr' },
    { code:'hu',  flag:'🇭🇺', name:'Magyar',               native:'Magyar',              dir:'ltr' },
    { code:'ro',  flag:'🇷🇴', name:'Română',               native:'Română',              dir:'ltr' },
    { code:'el',  flag:'🇬🇷', name:'Ελληνικά',             native:'Ελληνικά',            dir:'ltr' },
    { code:'he',  flag:'🇮🇱', name:'עברית',                native:'עברית',               dir:'rtl' },
    { code:'sw',  flag:'🇰🇪', name:'Kiswahili',            native:'Kiswahili',           dir:'ltr' },
    { code:'tl',  flag:'🇵🇭', name:'Filipino',             native:'Filipino',            dir:'ltr' },
    { code:'uk',  flag:'🇺🇦', name:'Українська',           native:'Українська',          dir:'ltr' },
    { code:'bg',  flag:'🇧🇬', name:'Български',            native:'Български',           dir:'ltr' },
    { code:'hr',  flag:'🇭🇷', name:'Hrvatski',             native:'Hrvatski',            dir:'ltr' },
    { code:'sk',  flag:'🇸🇰', name:'Slovenčina',           native:'Slovenčina',          dir:'ltr' },
    { code:'ka',  flag:'🇬🇪', name:'ქართული',              native:'ქართული',             dir:'ltr' },
    { code:'hy',  flag:'🇦🇲', name:'Հայերեն',              native:'Հայերեն',             dir:'ltr' },
    { code:'az',  flag:'🇦🇿', name:'Azərbaycan',           native:'Azərbaycan',          dir:'ltr' },
    { code:'kk',  flag:'🇰🇿', name:'Қазақша',              native:'Қазақша',             dir:'ltr' },
    { code:'ps',  flag:'🇦🇫', name:'پښتو',                 native:'پښتو',                dir:'rtl' },
    { code:'ku',  flag:'🇮🇶', name:'Kurdî',                native:'Kurdî',               dir:'ltr' },
    { code:'so',  flag:'🇸🇴', name:'Soomaali',             native:'Soomaali',            dir:'ltr' },
    { code:'am',  flag:'🇪🇹', name:'አማርኛ',                native:'አማርኛ',               dir:'ltr' },
    { code:'ha',  flag:'🇳🇬', name:'Hausa',                native:'Hausa',               dir:'ltr' },
    { code:'eo',  flag:'🌍',  name:'Esperanto',            native:'Esperanto',           dir:'ltr' },
];

const ALL_CURRENCIES = [
    { code:'MRU',  flag:'🇲🇷', name:'أوقية موريتانية',       symbol:'MRU'  },
    { code:'USDT', flag:'🔵',  name:'تيثر (USDT)',            symbol:'USDT' },
    { code:'USD',  flag:'🇺🇸', name:'دولار أمريكي',          symbol:'$'    },
    { code:'EUR',  flag:'🇪🇺', name:'يورو',                  symbol:'€'    },
    { code:'GBP',  flag:'🇬🇧', name:'جنيه إسترليني',        symbol:'£'    },
    { code:'SAR',  flag:'🇸🇦', name:'ريال سعودي',            symbol:'ر.س'  },
    { code:'AED',  flag:'🇦🇪', name:'درهم إماراتي',          symbol:'د.إ'  },
    { code:'KWD',  flag:'🇰🇼', name:'دينار كويتي',           symbol:'د.ك'  },
    { code:'QAR',  flag:'🇶🇦', name:'ريال قطري',             symbol:'ر.ق'  },
    { code:'BHD',  flag:'🇧🇭', name:'دينار بحريني',          symbol:'د.ب'  },
    { code:'OMR',  flag:'🇴🇲', name:'ريال عماني',            symbol:'ر.ع'  },
    { code:'JOD',  flag:'🇯🇴', name:'دينار أردني',           symbol:'د.أ'  },
    { code:'EGP',  flag:'🇪🇬', name:'جنيه مصري',             symbol:'ج.م'  },
    { code:'MAD',  flag:'🇲🇦', name:'درهم مغربي',            symbol:'د.م'  },
    { code:'TND',  flag:'🇹🇳', name:'دينار تونسي',           symbol:'د.ت'  },
    { code:'DZD',  flag:'🇩🇿', name:'دينار جزائري',          symbol:'د.ج'  },
    { code:'LYD',  flag:'🇱🇾', name:'دينار ليبي',            symbol:'د.ل'  },
    { code:'IQD',  flag:'🇮🇶', name:'دينار عراقي',           symbol:'ع.د'  },
    { code:'JPY',  flag:'🇯🇵', name:'ين ياباني',             symbol:'¥'    },
    { code:'CNY',  flag:'🇨🇳', name:'يوان صيني',             symbol:'¥'    },
    { code:'KRW',  flag:'🇰🇷', name:'وون كوري',              symbol:'₩'    },
    { code:'INR',  flag:'🇮🇳', name:'روبية هندية',           symbol:'₹'    },
    { code:'TRY',  flag:'🇹🇷', name:'ليرة تركية',            symbol:'₺'    },
    { code:'RUB',  flag:'🇷🇺', name:'روبل روسي',             symbol:'₽'    },
    { code:'BRL',  flag:'🇧🇷', name:'ريال برازيلي',          symbol:'R$'   },
    { code:'CAD',  flag:'🇨🇦', name:'دولار كندي',            symbol:'C$'   },
    { code:'AUD',  flag:'🇦🇺', name:'دولار أسترالي',         symbol:'A$'   },
    { code:'CHF',  flag:'🇨🇭', name:'فرنك سويسري',           symbol:'Fr'   },
    { code:'ZAR',  flag:'🇿🇦', name:'راند جنوب أفريقي',      symbol:'R'    },
    { code:'NGN',  flag:'🇳🇬', name:'نيرة نيجيرية',          symbol:'₦'    },
    { code:'BTC',  flag:'🟠',  name:'بيتكوين',               symbol:'BTC'  },
    { code:'ETH',  flag:'🔷',  name:'إيثيريوم',              symbol:'ETH'  },
];

// ==================== Modal الإعدادات ====================
window.openSettingsModal = function () {
    document.getElementById('settings-modal')?.remove();

    const savedLang     = localStorage.getItem('lang')     || 'ar';
    const savedCurrency = localStorage.getItem('currency') || 'MRU';

    const currentLang     = ALL_LANGUAGES.find(l => l.code === savedLang)     || ALL_LANGUAGES[0];
    const currentCurrency = ALL_CURRENCIES.find(c => c.code === savedCurrency) || ALL_CURRENCIES[0];

    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.style.cssText = `
        position:fixed; inset:0;
        background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
        z-index:99999; display:flex; align-items:center; justify-content:center;
        padding:20px; animation:settingsFadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <style>
            @keyframes settingsFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes settingsSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
            @keyframes dropdownOpen    { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
            .custom-select-trigger {
                display:flex; align-items:center; gap:10px; padding:12px 14px;
                border-radius:10px; border:2px solid #1e293b; background:#0f172a;
                color:#e2e8f0; cursor:pointer; transition:border-color 0.2s;
                user-select:none; font-family:'Tajawal','Segoe UI',sans-serif;
            }
            .custom-select-trigger:hover, .custom-select-trigger.open { border-color:#f97316; }
            .custom-select-trigger .chevron { color:#64748b; font-size:12px; transition:transform 0.2s; margin-right:auto; }
            .custom-select-trigger.open .chevron { transform:rotate(180deg); }
            .custom-dropdown {
                position:absolute; top:calc(100% + 6px); left:0; right:0;
                background:#0f172a; border:2px solid #f97316; border-radius:12px;
                z-index:999999; max-height:260px; display:none; flex-direction:column;
                overflow:hidden; animation:dropdownOpen 0.15s ease;
            }
            .custom-dropdown.open { display:flex; }
            .custom-search-wrapper {
                padding:10px 12px; border-bottom:1px solid #1e293b;
                display:flex; align-items:center; gap:8px; background:#0f172a; flex-shrink:0;
            }
            .custom-search-wrapper i { color:#64748b; font-size:13px; }
            .custom-search-input {
                background:transparent; border:none; outline:none;
                color:#e2e8f0; font-size:13px; flex:1;
                font-family:'Tajawal','Segoe UI',sans-serif; direction:rtl;
            }
            .custom-search-input::placeholder { color:#475569; }
            .custom-options-list { overflow-y:auto; flex:1; scrollbar-width:thin; scrollbar-color:#f97316 #0f172a; }
            .custom-options-list::-webkit-scrollbar { width:4px; }
            .custom-options-list::-webkit-scrollbar-thumb { background:#f97316; border-radius:4px; }
            .custom-option {
                display:flex; align-items:center; gap:10px; padding:9px 14px;
                cursor:pointer; transition:background 0.15s; font-size:13px; color:#e2e8f0;
            }
            .custom-option:hover { background:#1e293b; }
            .custom-option.active { background:rgba(249,115,22,0.12); color:#f97316; }
            .custom-option .opt-icon { font-size:18px; flex-shrink:0; }
            .custom-option .opt-name { flex:1; }
            .custom-option .opt-sub  { color:#64748b; font-size:11px; font-family:monospace; }
            .custom-option .opt-check { color:#f97316; font-size:12px; }
            .custom-no-results { padding:20px; text-align:center; color:#64748b; font-size:13px; }
        </style>

        <div style="background:#111827;border:1px solid #1e293b;border-radius:20px;padding:28px;width:100%;max-width:420px;color:#e2e8f0;animation:settingsSlideUp 0.25s ease;font-family:'Tajawal','Segoe UI',sans-serif;max-height:90vh;overflow-y:auto;">

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
                <h3 style="margin:0;font-size:17px;font-weight:800;color:#f1f5f9;display:flex;align-items:center;gap:8px;">
                    <i class="fas fa-globe" style="color:#f97316;"></i> اللغة والعملة
                </h3>
                <button onclick="closeSettingsModal()"
                    style="background:rgba(239,68,68,0.12);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- اللغة -->
            <div style="margin-bottom:20px;">
                <label style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:1px;display:block;margin-bottom:10px;">
                    <i class="fas fa-language" style="color:#f97316;margin-left:4px;"></i> اللغة
                </label>
                <div style="position:relative;" id="lang-select-wrapper">
                    <div class="custom-select-trigger" id="lang-select-trigger" onclick="_toggleDropdown('lang')">
                        <span id="settings-selected-lang-flag" style="font-size:20px;">${currentLang.flag}</span>
                        <span id="settings-selected-lang-name" style="flex:1;font-size:14px;">${currentLang.name}</span>
                        <i class="fas fa-chevron-down chevron"></i>
                    </div>
                    <div class="custom-dropdown" id="lang-dropdown">
                        <div class="custom-search-wrapper">
                            <i class="fas fa-search"></i>
                            <input class="custom-search-input" id="lang-search-input" placeholder="ابحث عن لغة..." autocomplete="off" oninput="_filterOptions('lang', this.value)">
                        </div>
                        <div class="custom-options-list" id="lang-options-list"></div>
                    </div>
                </div>
            </div>

            <!-- العملة -->
            <div style="margin-bottom:24px;">
                <label style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:1px;display:block;margin-bottom:10px;">
                    <i class="fas fa-coins" style="color:#f97316;margin-left:4px;"></i> العملة
                </label>
                <div style="position:relative;" id="currency-select-wrapper">
                    <div class="custom-select-trigger" id="currency-select-trigger" onclick="_toggleDropdown('currency')">
                        <span id="settings-selected-currency-flag" style="font-size:20px;">${currentCurrency.flag}</span>
                        <span id="settings-selected-currency-name" style="flex:1;font-size:14px;">${currentCurrency.name}</span>
                        <span style="font-family:monospace;font-size:12px;color:#f97316;background:rgba(249,115,22,0.1);padding:2px 8px;border-radius:6px;">${currentCurrency.symbol}</span>
                        <i class="fas fa-chevron-down chevron"></i>
                    </div>
                    <div class="custom-dropdown" id="currency-dropdown">
                        <div class="custom-search-wrapper">
                            <i class="fas fa-search"></i>
                            <input class="custom-search-input" id="currency-search-input" placeholder="ابحث عن عملة..." autocomplete="off" oninput="_filterOptions('currency', this.value)">
                        </div>
                        <div class="custom-options-list" id="currency-options-list"></div>
                    </div>
                </div>
            </div>

            <button onclick="saveSettings()"
                style="width:100%;padding:13px;background:#f97316;color:white;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;font-family:'Tajawal','Segoe UI',sans-serif;box-shadow:0 4px 14px rgba(249,115,22,0.35);">
                <i class="fas fa-check-circle"></i> حفظ الإعدادات
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeSettingsModal(); });

    window._tempLang     = savedLang;
    window._tempCurrency = savedCurrency;

    _renderOptions('lang', '');
    _renderOptions('currency', '');
    document.addEventListener('click', _outsideClick);
};

// ==================== Toggle / Filter / Select ====================
window._toggleDropdown = function (type) {
    const trigger  = document.getElementById(`${type}-select-trigger`);
    const dropdown = document.getElementById(`${type}-dropdown`);
    const input    = document.getElementById(`${type}-search-input`);
    if (!trigger || !dropdown) return;

    const other = type === 'lang' ? 'currency' : 'lang';
    document.getElementById(`${other}-dropdown`)?.classList.remove('open');
    document.getElementById(`${other}-select-trigger`)?.classList.remove('open');

    const isOpen = dropdown.classList.contains('open');
    if (isOpen) {
        dropdown.classList.remove('open');
        trigger.classList.remove('open');
    } else {
        dropdown.classList.add('open');
        trigger.classList.add('open');
        input.value = '';
        _renderOptions(type, '');
        setTimeout(() => input.focus(), 50);
    }
};

window._outsideClick = function (e) {
    ['lang', 'currency'].forEach(type => {
        const wrapper = document.getElementById(`${type}-select-wrapper`);
        if (wrapper && !wrapper.contains(e.target)) {
            document.getElementById(`${type}-dropdown`)?.classList.remove('open');
            document.getElementById(`${type}-select-trigger`)?.classList.remove('open');
        }
    });
};

window._filterOptions = (type, query) => _renderOptions(type, query);

window._renderOptions = function (type, query) {
    const list = document.getElementById(`${type}-options-list`);
    if (!list) return;

    const q    = query.trim().toLowerCase();
    const data = type === 'lang' ? ALL_LANGUAGES : ALL_CURRENCIES;
    const curr = type === 'lang' ? window._tempLang : window._tempCurrency;

    const filtered = data.filter(item =>
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.native && item.native.toLowerCase().includes(q)) ||
        (item.symbol && item.symbol.toLowerCase().includes(q))
    );

    if (!filtered.length) {
        list.innerHTML = '<div class="custom-no-results">لا توجد نتائج</div>';
        return;
    }

    list.innerHTML = filtered.map(item => `
        <div class="custom-option ${item.code === curr ? 'active' : ''}"
             onclick="_selectOption('${type}', '${item.code}')">
            <span class="opt-icon">${item.flag || '💱'}</span>
            <span class="opt-name">${item.name}</span>
            ${type === 'currency'
                ? `<span class="opt-sub">${item.symbol}</span>`
                : `<span class="opt-sub">${item.native !== item.name ? item.native : ''}</span>`}
            ${item.code === curr ? '<i class="fas fa-check opt-check"></i>' : ''}
        </div>
    `).join('');
};

window._selectOption = function (type, code) {
    const data = type === 'lang' ? ALL_LANGUAGES : ALL_CURRENCIES;
    const item = data.find(i => i.code === code);
    if (!item) return;

    if (type === 'lang') {
        window._tempLang = code;
        document.getElementById('settings-selected-lang-flag').textContent = item.flag;
        document.getElementById('settings-selected-lang-name').textContent = item.name;
    } else {
        window._tempCurrency = code;
        document.getElementById('settings-selected-currency-flag').textContent = item.flag || '💱';
        document.getElementById('settings-selected-currency-name').textContent = item.name;
        const symEl = document.getElementById('currency-select-trigger').querySelector('span[style*="monospace"]');
        if (symEl) symEl.textContent = item.symbol;
    }

    document.getElementById(`${type}-dropdown`)?.classList.remove('open');
    document.getElementById(`${type}-select-trigger`)?.classList.remove('open');
};

// ==================== حفظ الإعدادات + ترجمة ====================
window.saveSettings = async function () {
    const lang     = window._tempLang     || 'ar';
    const currency = window._tempCurrency || 'MRU';

    localStorage.setItem('lang',         lang);
    localStorage.setItem('currency',     currency);
    localStorage.setItem('lastCurrency', currency);

    const dir = ALL_LANGUAGES.find(l => l.code === lang)?.dir || 'rtl';
    document.documentElement.setAttribute('dir',  dir);
    document.documentElement.setAttribute('lang', lang);

    document.removeEventListener('click', _outsideClick);
    closeSettingsModal();

    // ✅ Toast التحميل
    const toast = document.createElement('div');
    toast.id = '_settings-toast';
    toast.style.cssText = `
        position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
        background:#3b82f6; color:white; padding:12px 24px; border-radius:10px;
        font-size:14px; font-weight:700; z-index:99999;
        box-shadow:0 4px 20px rgba(0,0,0,0.3); pointer-events:none;
        font-family:'Tajawal','Segoe UI',sans-serif; white-space:nowrap;
    `;

    if (lang === 'ar') {
        // العربية → إعادة تحميل لاسترجاع النصوص الأصلية
        toast.textContent = '✅ تم حفظ الإعدادات';
        toast.style.background = '#22c55e';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
        setTimeout(() => location.reload(), 600);
    } else {
        // لغة أخرى → ترجمة الصفحة بدون reload
        toast.textContent = '⏳ جاري الترجمة...';
        document.body.appendChild(toast);

        await translatePage(lang);

        toast.textContent      = '✅ تمت الترجمة!';
        toast.style.background = '#22c55e';
        setTimeout(() => toast.remove(), 2000);
    }

    // ✅ إطلاق حدث لتحديث الأسعار في الصفحة
    window.dispatchEvent(new CustomEvent('currency-changed', { detail: currency }));
};

// ==================== إغلاق Modal ====================
window.closeSettingsModal = function () {
    document.removeEventListener('click', _outsideClick);
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.opacity    = '0';
        modal.style.transition = 'opacity 0.2s';
        setTimeout(() => modal.remove(), 200);
    }
};