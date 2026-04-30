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

    // أضف الهيدر في أول الـ body
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

        // dropdown
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
        // غير مسجل
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
            pointer-events: none;
        `;
        cartLink.appendChild(badge);
    }

    badge.textContent  = totalItems;
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
        // إذا لم تكن في index.html انتقل إليها مع query
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = `index.html?q=${encodeURIComponent(q)}`;
        } else {
            window.dispatchEvent(new CustomEvent('header-search', { detail: q }));
        }
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    btnSrh?.addEventListener('click', doSearch);

    // لو جاء من صفحة أخرى بـ query
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
        input.value = urlQ;
        window.dispatchEvent(new CustomEvent('header-search', { detail: urlQ }));
    }
}

// ==================== تشغيل الكل ====================
document.addEventListener('DOMContentLoaded', () => {
    // بناء الهيدر فقط إذا لم يكن موجوداً
    if (!document.querySelector('.main-header')) {
        buildHeader();
    }

    initTheme();
    initUserIcon();
    updateCartBadge();
    initSearch();
});






// ===== إعدادات اللغة والعملة =====

// ===== إعدادات اللغة والعملة =====

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
    // ── العملات الأكثر استخداماً أولاً ──
    { code:'MRU',  flag:'🇲🇷', name:'أوقية موريتانية',       symbol:'MRU'  },
    { code:'USDT', flag:'🔵',  name:'تيثر (USDT)',            symbol:'USDT' },
    { code:'BTC',  flag:'🟠',  name:'بيتكوين',               symbol:'BTC'  },
    { code:'ETH',  flag:'🔷',  name:'إيثيريوم',              symbol:'ETH'  },
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
    { code:'SDG',  flag:'🇸🇩', name:'جنيه سوداني',           symbol:'ج.س'  },
    { code:'SYP',  flag:'🇸🇾', name:'ليرة سورية',            symbol:'ل.س'  },
    { code:'IQD',  flag:'🇮🇶', name:'دينار عراقي',           symbol:'ع.د'  },
    { code:'YER',  flag:'🇾🇪', name:'ريال يمني',             symbol:'ر.ي'  },
    { code:'LBP',  flag:'🇱🇧', name:'ليرة لبنانية',          symbol:'ل.ل'  },
    { code:'JPY',  flag:'🇯🇵', name:'ين ياباني',             symbol:'¥'    },
    { code:'CNY',  flag:'🇨🇳', name:'يوان صيني',             symbol:'¥'    },
    { code:'KRW',  flag:'🇰🇷', name:'وون كوري',              symbol:'₩'    },
    { code:'INR',  flag:'🇮🇳', name:'روبية هندية',           symbol:'₹'    },
    { code:'TRY',  flag:'🇹🇷', name:'ليرة تركية',            symbol:'₺'    },
    { code:'RUB',  flag:'🇷🇺', name:'روبل روسي',             symbol:'₽'    },
    { code:'BRL',  flag:'🇧🇷', name:'ريال برازيلي',          symbol:'R$'   },
    { code:'MXN',  flag:'🇲🇽', name:'بيزو مكسيكي',           symbol:'$'    },
    { code:'CAD',  flag:'🇨🇦', name:'دولار كندي',            symbol:'C$'   },
    { code:'AUD',  flag:'🇦🇺', name:'دولار أسترالي',         symbol:'A$'   },
    { code:'CHF',  flag:'🇨🇭', name:'فرنك سويسري',           symbol:'Fr'   },
    { code:'SEK',  flag:'🇸🇪', name:'كرون سويدي',            symbol:'kr'   },
    { code:'NOK',  flag:'🇳🇴', name:'كرون نرويجي',           symbol:'kr'   },
    { code:'DKK',  flag:'🇩🇰', name:'كرون دنماركي',          symbol:'kr'   },
    { code:'PLN',  flag:'🇵🇱', name:'زلوتي بولندي',          symbol:'zł'   },
    { code:'CZK',  flag:'🇨🇿', name:'كورونة تشيكية',         symbol:'Kč'   },
    { code:'HUF',  flag:'🇭🇺', name:'فورنت هنغاري',          symbol:'Ft'   },
    { code:'RON',  flag:'🇷🇴', name:'لي روماني',             symbol:'lei'  },
    { code:'BGN',  flag:'🇧🇬', name:'ليف بلغاري',            symbol:'лв'   },
    { code:'HRK',  flag:'🇭🇷', name:'كونا كرواتية',          symbol:'kn'   },
    { code:'ZAR',  flag:'🇿🇦', name:'راند جنوب أفريقي',      symbol:'R'    },
    { code:'NGN',  flag:'🇳🇬', name:'نيرة نيجيرية',          symbol:'₦'    },
    { code:'KES',  flag:'🇰🇪', name:'شلن كيني',              symbol:'KSh'  },
    { code:'GHS',  flag:'🇬🇭', name:'سيدي غاني',             symbol:'₵'    },
    { code:'ETB',  flag:'🇪🇹', name:'بر إثيوبي',             symbol:'Br'   },
    { code:'TZS',  flag:'🇹🇿', name:'شلن تنزاني',            symbol:'TSh'  },
    { code:'UGX',  flag:'🇺🇬', name:'شلن أوغندي',            symbol:'USh'  },
    { code:'XOF',  flag:'🌍',  name:'فرنك CFA غرب أفريقيا', symbol:'Fr'   },
    { code:'XAF',  flag:'🌍',  name:'فرنك CFA وسط أفريقيا', symbol:'Fr'   },
    { code:'IDR',  flag:'🇮🇩', name:'روبية إندونيسية',       symbol:'Rp'   },
    { code:'MYR',  flag:'🇲🇾', name:'رينجت ماليزي',          symbol:'RM'   },
    { code:'THB',  flag:'🇹🇭', name:'بات تايلاندي',          symbol:'฿'    },
    { code:'PHP',  flag:'🇵🇭', name:'بيزو فلبيني',           symbol:'₱'    },
    { code:'VND',  flag:'🇻🇳', name:'دونغ فيتنامي',          symbol:'₫'    },
    { code:'PKR',  flag:'🇵🇰', name:'روبية باكستانية',       symbol:'₨'    },
    { code:'BDT',  flag:'🇧🇩', name:'تاكا بنغلاديشية',       symbol:'৳'    },
    { code:'LKR',  flag:'🇱🇰', name:'روبية سريلانكية',       symbol:'Rs'   },
    { code:'NPR',  flag:'🇳🇵', name:'روبية نيبالية',         symbol:'Rs'   },
    { code:'MMK',  flag:'🇲🇲', name:'كيات بورمي',            symbol:'K'    },
    { code:'KHR',  flag:'🇰🇭', name:'رييل كمبودي',           symbol:'៛'    },
    { code:'UAH',  flag:'🇺🇦', name:'هريفنيا أوكرانية',      symbol:'₴'    },
    { code:'GEL',  flag:'🇬🇪', name:'لاري جيورجي',           symbol:'₾'    },
    { code:'AMD',  flag:'🇦🇲', name:'درام أرميني',           symbol:'֏'    },
    { code:'AZN',  flag:'🇦🇿', name:'مانات أذربيجاني',       symbol:'₼'    },
    { code:'KZT',  flag:'🇰🇿', name:'تنغي كازاخستاني',       symbol:'₸'    },
    { code:'UZS',  flag:'🇺🇿', name:'سوم أوزبكستاني',        symbol:'сум'  },
    { code:'IRR',  flag:'🇮🇷', name:'ريال إيراني',           symbol:'﷼'    },
    { code:'AFN',  flag:'🇦🇫', name:'أفغاني',                symbol:'؋'    },
    { code:'ILS',  flag:'🇮🇱', name:'شيكل إسرائيلي',         symbol:'₪'    },
    { code:'NZD',  flag:'🇳🇿', name:'دولار نيوزيلندي',       symbol:'NZ$'  },
    { code:'SGD',  flag:'🇸🇬', name:'دولار سنغافوري',        symbol:'S$'   },
    { code:'HKD',  flag:'🇭🇰', name:'دولار هونغ كونغ',       symbol:'HK$'  },
    { code:'TWD',  flag:'🇹🇼', name:'دولار تايواني',         symbol:'NT$'  },
    { code:'CLP',  flag:'🇨🇱', name:'بيزو تشيلي',            symbol:'$'    },
    { code:'COP',  flag:'🇨🇴', name:'بيزو كولومبي',          symbol:'$'    },
    { code:'PEN',  flag:'🇵🇪', name:'سول بيروفي',            symbol:'S/'   },
    { code:'ARS',  flag:'🇦🇷', name:'بيزو أرجنتيني',         symbol:'$'    },
    { code:'VEF',  flag:'🇻🇪', name:'بوليفار فنزويلي',       symbol:'Bs'   },
    { code:'CRC',  flag:'🇨🇷', name:'كولون كوستاريكي',       symbol:'₡'    },
    { code:'DOP',  flag:'🇩🇴', name:'بيزو دومينيكاني',       symbol:'RD$'  },
    { code:'GTQ',  flag:'🇬🇹', name:'كيتزال غواتيمالي',      symbol:'Q'    },
    { code:'HNL',  flag:'🇭🇳', name:'ليمبيرا هندوراسي',      symbol:'L'    },
    { code:'NIO',  flag:'🇳🇮', name:'كوردوبا نيكاراغوي',     symbol:'C$'   },
    { code:'PAB',  flag:'🇵🇦', name:'بالبوا بنمي',           symbol:'B/.'  },
    { code:'PYG',  flag:'🇵🇾', name:'غواراني باراغوياني',    symbol:'₲'    },
    { code:'UYU',  flag:'🇺🇾', name:'بيزو أوروغواياني',      symbol:'$U'   },
    { code:'BOB',  flag:'🇧🇴', name:'بوليفيانو بوليفي',      symbol:'Bs'   },
    { code:'JMD',  flag:'🇯🇲', name:'دولار جامايكي',         symbol:'J$'   },
    { code:'TTD',  flag:'🇹🇹', name:'دولار ترينيداد',        symbol:'TT$'  },
    { code:'BBD',  flag:'🇧🇧', name:'دولار بربادوس',         symbol:'Bds$' },
    { code:'MAD',  flag:'🇲🇦', name:'درهم مغربي',            symbol:'د.م'  },
    { code:'MZN',  flag:'🇲🇿', name:'متيكال موزمبيقي',       symbol:'MT'   },
    { code:'BWP',  flag:'🇧🇼', name:'بولا بوتسواني',         symbol:'P'    },
    { code:'ZMW',  flag:'🇿🇲', name:'كواتشا زامبي',          symbol:'ZK'   },
    { code:'MWK',  flag:'🇲🇼', name:'كواتشا ملاوي',          symbol:'MK'   },
    { code:'RWF',  flag:'🇷🇼', name:'فرنك رواندي',           symbol:'Fr'   },
    { code:'BIF',  flag:'🇧🇮', name:'فرنك بوروندي',          symbol:'Fr'   },
    { code:'DJF',  flag:'🇩🇯', name:'فرنك جيبوتي',           symbol:'Fr'   },
    { code:'ERN',  flag:'🇪🇷', name:'ناكفا إريتري',          symbol:'Nfk'  },
    { code:'GMD',  flag:'🇬🇲', name:'دالاسي غامبي',          symbol:'D'    },
    { code:'GNF',  flag:'🇬🇳', name:'فرنك غيني',             symbol:'Fr'   },
    { code:'MGA',  flag:'🇲🇬', name:'أرياري مدغشقري',        symbol:'Ar'   },
    { code:'SCR',  flag:'🇸🇨', name:'روبية سيشيلية',         symbol:'₨'    },
    { code:'SLL',  flag:'🇸🇱', name:'ليون سيراليوني',        symbol:'Le'   },
    { code:'SOS',  flag:'🇸🇴', name:'شلن صومالي',            symbol:'Sh'   },
    { code:'STN',  flag:'🇸🇹', name:'دوبرا ساو تومي',        symbol:'Db'   },
    { code:'SZL',  flag:'🇸🇿', name:'ليلانجيني سوازيلاندي',  symbol:'L'    },
    { code:'LSL',  flag:'🇱🇸', name:'لوتي ليسوتو',           symbol:'L'    },
    { code:'NAD',  flag:'🇳🇦', name:'دولار ناميبي',          symbol:'N$'   },
    { code:'AOA',  flag:'🇦🇴', name:'كوانزا أنغولي',         symbol:'Kz'   },
    { code:'CDF',  flag:'🇨🇩', name:'فرنك كونغولي',          symbol:'Fr'   },
    { code:'CMF',  flag:'🇨🇲', name:'فرنك كاميروني',         symbol:'Fr'   },
    { code:'MNT',  flag:'🇲🇳', name:'توغروغ منغولي',         symbol:'₮'    },
    { code:'KPW',  flag:'🇰🇵', name:'وون كوري شمالي',        symbol:'₩'    },
    { code:'LAK',  flag:'🇱🇦', name:'كيب لاوسي',             symbol:'₭'    },
    { code:'MVR',  flag:'🇲🇻', name:'روفية مالديفية',        symbol:'Rf'   },
    { code:'BTN',  flag:'🇧🇹', name:'نغولتروم بوتاني',       symbol:'Nu'   },
    { code:'FJD',  flag:'🇫🇯', name:'دولار فيجي',            symbol:'FJ$'  },
    { code:'PGK',  flag:'🇵🇬', name:'كينا بابوا غينيا',      symbol:'K'    },
    { code:'SBD',  flag:'🇸🇧', name:'دولار جزر سليمان',      symbol:'SI$'  },
    { code:'TOP',  flag:'🇹🇴', name:'باانغا تونغي',          symbol:'T$'   },
    { code:'VUV',  flag:'🇻🇺', name:'فاتو فانواتو',          symbol:'Vt'   },
    { code:'WST',  flag:'🇼🇸', name:'تالا ساموا',            symbol:'T'    },
    { code:'XPF',  flag:'🇵🇫', name:'فرنك بولينيزيا',        symbol:'Fr'   },
    { code:'ISK',  flag:'🇮🇸', name:'كرونة آيسلندية',        symbol:'kr'   },
    { code:'MKD',  flag:'🇲🇰', name:'دينار مقدوني',          symbol:'den'  },
    { code:'ALL',  flag:'🇦🇱', name:'ليك ألباني',            symbol:'L'    },
    { code:'BAM',  flag:'🇧🇦', name:'مارك بوسني',            symbol:'KM'   },
    { code:'RSD',  flag:'🇷🇸', name:'دينار صربي',            symbol:'din'  },
    { code:'MDL',  flag:'🇲🇩', name:'ليو مولدوفي',           symbol:'L'    },
    { code:'BYN',  flag:'🇧🇾', name:'روبل بيلاروسي',         symbol:'Br'   },
    { code:'TJS',  flag:'🇹🇯', name:'سوموني طاجيكي',         symbol:'SM'   },
    { code:'TMT',  flag:'🇹🇲', name:'مانات تركمانستاني',     symbol:'T'    },
    { code:'KGS',  flag:'🇰🇬', name:'سوم قيرغيزستاني',       symbol:'с'    },
    { code:'GIP',  flag:'🇬🇮', name:'جنيه جبل طارق',         symbol:'£'    },
    { code:'FKP',  flag:'🇫🇰', name:'جنيه جزر فوكلاند',      symbol:'£'    },
    { code:'SHP',  flag:'🇸🇭', name:'جنيه سانت هيلينا',      symbol:'£'    },
    { code:'KYD',  flag:'🇰🇾', name:'دولار جزر كايمان',      symbol:'CI$'  },
    { code:'BMD',  flag:'🇧🇲', name:'دولار برمودا',           symbol:'BD$'  },
    { code:'BSD',  flag:'🇧🇸', name:'دولار باهامي',           symbol:'B$'   },
    { code:'BZD',  flag:'🇧🇿', name:'دولار بليز',             symbol:'BZ$'  },
    { code:'GYD',  flag:'🇬🇾', name:'دولار غياني',           symbol:'GY$'  },
    { code:'SRD',  flag:'🇸🇷', name:'دولار سورينامي',        symbol:'$'    },
    { code:'AWG',  flag:'🇦🇼', name:'فلورن أروبي',           symbol:'ƒ'    },
    { code:'ANG',  flag:'🇨🇼', name:'غيلدر أنتيلي',          symbol:'ƒ'    },
    { code:'HTG',  flag:'🇭🇹', name:'غورد هايتي',            symbol:'G'    },
    { code:'CUP',  flag:'🇨🇺', name:'بيزو كوبي',             symbol:'₱'    },
    { code:'MOP',  flag:'🇲🇴', name:'باتاكا ماكاو',          symbol:'P'    },
    { code:'BND',  flag:'🇧🇳', name:'دولار بروناي',           symbol:'B$'   },
    { code:'XCD',  flag:'🌎',  name:'دولار كاريبي شرقي',     symbol:'EC$'  },
];

// ===== فتح modal الإعدادات =====
window.openSettingsModal = function () {
    document.getElementById('settings-modal')?.remove();

    const savedLang     = localStorage.getItem('lang')     || 'ar';
    const savedCurrency = localStorage.getItem('currency') || 'MRU';

    const currentLang     = ALL_LANGUAGES.find(l => l.code === savedLang)     || ALL_LANGUAGES[0];
    const currentCurrency = ALL_CURRENCIES.find(c => c.code === savedCurrency) || ALL_CURRENCIES[0];

    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        padding: 20px; animation: settingsFadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <style>
            @keyframes settingsFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes settingsSlideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
            @keyframes dropdownOpen    { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

            /* ===== Custom Select shared ===== */
            .custom-select-trigger {
                display: flex; align-items: center; gap: 10px;
                padding: 12px 14px; border-radius: 10px;
                border: 2px solid #1e293b; background: #0f172a;
                color: #e2e8f0; cursor: pointer;
                transition: border-color 0.2s; user-select: none;
                font-family: 'Tajawal','Segoe UI',sans-serif;
            }
            .custom-select-trigger:hover,
            .custom-select-trigger.open { border-color: #f97316; }
            .custom-select-trigger .chevron {
                color: #64748b; font-size: 12px;
                transition: transform 0.2s; margin-right: auto;
            }
            .custom-select-trigger.open .chevron { transform: rotate(180deg); }

            .custom-dropdown {
                position: absolute; top: calc(100% + 6px); left: 0; right: 0;
                background: #0f172a; border: 2px solid #f97316;
                border-radius: 12px; z-index: 999999;
                max-height: 260px; display: none; flex-direction: column;
                overflow: hidden; animation: dropdownOpen 0.15s ease;
            }
            .custom-dropdown.open { display: flex; }

            .custom-search-wrapper {
                padding: 10px 12px; border-bottom: 1px solid #1e293b;
                display: flex; align-items: center; gap: 8px;
                background: #0f172a; flex-shrink: 0;
            }
            .custom-search-wrapper i { color: #64748b; font-size: 13px; }
            .custom-search-input {
                background: transparent; border: none; outline: none;
                color: #e2e8f0; font-size: 13px; flex: 1;
                font-family: 'Tajawal','Segoe UI',sans-serif; direction: rtl;
            }
            .custom-search-input::placeholder { color: #475569; }

            .custom-options-list {
                overflow-y: auto; flex: 1;
                scrollbar-width: thin; scrollbar-color: #f97316 #0f172a;
            }
            .custom-options-list::-webkit-scrollbar { width: 4px; }
            .custom-options-list::-webkit-scrollbar-track { background: #0f172a; }
            .custom-options-list::-webkit-scrollbar-thumb { background: #f97316; border-radius: 4px; }

            .custom-option {
                display: flex; align-items: center; gap: 10px;
                padding: 9px 14px; cursor: pointer;
                transition: background 0.15s; font-size: 13px; color: #e2e8f0;
            }
            .custom-option:hover { background: #1e293b; }
            .custom-option.active { background: rgba(249,115,22,0.12); color: #f97316; }
            .custom-option .opt-icon { font-size: 18px; flex-shrink: 0; }
            .custom-option .opt-name { flex: 1; }
            .custom-option .opt-sub  { color: #64748b; font-size: 11px; font-family: monospace; }
            .custom-option .opt-check { color: #f97316; font-size: 12px; }
            .custom-no-results { padding: 20px; text-align: center; color: #64748b; font-size: 13px; }
        </style>

        <div style="background:#111827;border:1px solid #1e293b;border-radius:20px;padding:28px;width:100%;max-width:420px;color:#e2e8f0;animation:settingsSlideUp 0.25s ease;font-family:'Tajawal','Segoe UI',sans-serif;max-height:90vh;overflow-y:auto;">

            <!-- Header -->
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
                <label style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:10px;">
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
                <label style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:10px;">
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

            <!-- زر الحفظ -->
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

// ===== Toggle Dropdown =====
window._toggleDropdown = function (type) {
    const trigger  = document.getElementById(`${type}-select-trigger`);
    const dropdown = document.getElementById(`${type}-dropdown`);
    const input    = document.getElementById(`${type}-search-input`);
    if (!trigger || !dropdown) return;

    // إغلاق الآخر
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

window._filterOptions = function (type, query) {
    _renderOptions(type, query);
};

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
            <span class="opt-icon">${item.flag || item.icon || '💱'}</span>
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

// ===== حفظ الإعدادات =====
window.saveSettings = function () {
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

    const toast = document.createElement('div');
    toast.textContent = '✅ تم حفظ الإعدادات';
    toast.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#22c55e;color:white;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);pointer-events:none;font-family:'Tajawal','Segoe UI',sans-serif;`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);

    setTimeout(() => location.reload(), 500);
};

// ===== إغلاق الـ modal =====
window.closeSettingsModal = function () {
    document.removeEventListener('click', _outsideClick);
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.opacity    = '0';
        modal.style.transition = 'opacity 0.2s';
        setTimeout(() => modal.remove(), 200);
    }
};

// ===== تطبيق الإعدادات عند تحميل الصفحة =====
document.addEventListener('DOMContentLoaded', () => {
    const lang = localStorage.getItem('lang') || 'ar';
    const dir  = ALL_LANGUAGES.find(l => l.code === lang)?.dir || 'rtl';
    document.documentElement.setAttribute('dir',  dir);
    document.documentElement.setAttribute('lang', lang);
});