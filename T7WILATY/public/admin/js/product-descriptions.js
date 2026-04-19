import { supabase } from '../../js/supabase-config.js';

let allProducts     = [];
let allDescriptions = {};  // { "product_name": { id, product_name, description, instructions } }

// ==================== تحميل ====================
async function init() {
    await Promise.all([loadProducts(), loadDescriptions()]);
    render();
}

async function loadProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, image, country')
        .order('name');
    if (error) { showToast('❌ خطأ في تحميل المنتجات', true); return; }
    allProducts = data || [];
}

async function loadDescriptions() {
    const { data, error } = await supabase
        .from('product_descriptions')
        .select('*');
    if (error) {
        console.warn('product_descriptions:', error.message);
        return;
    }
    allDescriptions = {};
    (data || []).forEach(d => { allDescriptions[d.product_name] = d; });
}

// ==================== عرض ====================
function render() {
    const container = document.getElementById('products-list');
    if (!allProducts.length) {
        container.innerHTML = '<div class="loading-text">لا توجد منتجات</div>';
        return;
    }

    container.innerHTML = allProducts.map(p => {
        const desc    = allDescriptions[p.name] || {};
        const hasData = !!(desc.description || desc.instructions);
        const safeId  = safeName(p.name);

        return `
        <div class="desc-card" id="card-${safeId}">

            <!-- Header — مغلق بالافتراضي -->
            <div class="desc-card-header" onclick="toggleCard('${safeId}')">
                ${p.image
                    ? `<img src="${p.image}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                       <div class="img-placeholder" style="display:none;"><i class="fas fa-image"></i></div>`
                    : `<div class="img-placeholder"><i class="fas fa-image"></i></div>`
                }
                <div style="flex:1; min-width:0;">
                    <div class="p-name">${p.name}</div>
                    <div class="p-country">${p.country || ''}</div>
                </div>
                <span class="status-badge ${hasData ? 'badge-done' : 'badge-empty'}" id="badge-${safeId}">
                    ${hasData ? '<i class="fas fa-check"></i> مكتمل' : 'فارغ'}
                </span>
                <i class="fas fa-chevron-down chevron" id="chevron-${safeId}"></i>
            </div>

            <!-- Body — مخفي بالافتراضي -->
            <div class="desc-card-body" id="body-${safeId}">

                <!-- وصف البطاقة -->
                <div class="field-group">
                    <div class="field-label">
                        <i class="fas fa-info-circle" style="color:#3b82f6;"></i>
                        وصف البطاقة
                    </div>
                    <textarea class="desc-field" id="desc-${safeId}" rows="4"
                        placeholder="اكتب وصفاً مختصراً عن البطاقة، ما تستخدم له، وما يميزها..."
                    >${escHtml(desc.description || '')}</textarea>
                    <div class="field-hint">
                        <i class="fas fa-eye" style="font-size:10px;"></i>
                        يظهر للعميل في صفحة المنتج تحت الفئات.
                    </div>
                </div>

                <!-- إرشادات الشحن -->
                <div class="field-group">
                    <div class="field-label">
                        <i class="fas fa-list-ol" style="color:#22c55e;"></i>
                        إرشادات الشحن / الاستخدام
                    </div>
                    <textarea class="desc-field" id="inst-${safeId}" rows="6"
                        placeholder="اكتب كل خطوة في سطر منفصل:&#10;افتح الموقع الرسمي&#10;سجّل الدخول&#10;اختر إضافة رصيد وأدخل الكود"
                        oninput="previewInst('${safeId}')"
                    >${escHtml(desc.instructions || '')}</textarea>
                    <div class="field-hint">
                        <i class="fas fa-info" style="font-size:10px;"></i>
                        كل سطر = خطوة مستقلة تُعرض مُرقّمة للعميل.
                    </div>

                    <!-- معاينة الخطوات -->
                    <div class="preview-box" id="preview-${safeId}">
                        <div style="font-size:11px; color:#475569; margin-bottom:8px; font-weight:700;">
                            <i class="fas fa-eye"></i> معاينة:
                        </div>
                        <div id="preview-steps-${safeId}"></div>
                    </div>
                </div>

                <!-- أزرار -->
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-top:18px;">
                    <button class="save-btn" onclick="saveDesc('${safeId}', '${escAttr(p.name)}')">
                        <i class="fas fa-save"></i> حفظ
                    </button>
                    <span class="saved-badge" id="saved-badge-${safeId}">
                        <i class="fas fa-check"></i> تم الحفظ
                    </span>
                    ${hasData ? `
                    <button class="clear-btn" onclick="clearDesc('${safeId}', '${escAttr(p.name)}')">
                        <i class="fas fa-trash-alt"></i> مسح
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    // معاينة أولية لمن لديهم خطوات محفوظة
    allProducts.forEach(p => {
        const desc = allDescriptions[p.name];
        if (desc?.instructions) previewInst(safeName(p.name));
    });
}

// ==================== Toggle — مغلق بالافتراضي، يفتح عند الضغط ====================
window.toggleCard = (safeId) => {
    const body    = document.getElementById(`body-${safeId}`);
    const chevron = document.getElementById(`chevron-${safeId}`);
    if (!body) return;

    const isOpen = body.classList.contains('open');

    // أغلق باقي البطاقات المفتوحة
    document.querySelectorAll('.desc-card-body.open').forEach(el => {
        if (el.id !== `body-${safeId}`) {
            el.classList.remove('open');
            const otherId      = el.id.replace('body-', '');
            const otherChevron = document.getElementById(`chevron-${otherId}`);
            if (otherChevron) otherChevron.style.transform = 'rotate(0deg)';
        }
    });

    // افتح/أغلق البطاقة الحالية
    body.classList.toggle('open', !isOpen);
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
};

// ==================== معاينة الخطوات ====================
window.previewInst = (safeId) => {
    const val   = document.getElementById(`inst-${safeId}`)?.value || '';
    const steps = val.split('\n').map(s => s.trim()).filter(s => s);
    const box   = document.getElementById(`preview-${safeId}`);
    const cont  = document.getElementById(`preview-steps-${safeId}`);
    if (!box || !cont) return;

    if (!steps.length) { box.classList.remove('has-content'); return; }

    box.classList.add('has-content');
    cont.innerHTML = steps.map((s, i) => `
        <div class="preview-step">
            <span class="num">${i + 1}.</span>
            <span>${escHtml(s)}</span>
        </div>`).join('');
};

// ==================== حفظ ====================
window.saveDesc = async (safeId, productName) => {
    const description  = document.getElementById(`desc-${safeId}`)?.value.trim()  || '';
    const instructions = document.getElementById(`inst-${safeId}`)?.value.trim()  || '';
    const existing     = allDescriptions[productName];

    let error;

    if (existing?.id) {
        ({ error } = await supabase
            .from('product_descriptions')
            .update({ description, instructions, updated_at: new Date().toISOString() })
            .eq('id', existing.id));
    } else {
        const { data, error: e } = await supabase
            .from('product_descriptions')
            .insert({ product_name: productName, description, instructions })
            .select()
            .single();
        error = e;
        if (!e && data) allDescriptions[productName] = data;
    }

    if (error) { showToast('❌ خطأ: ' + error.message, true); return; }

    allDescriptions[productName] = {
        ...(allDescriptions[productName] || { product_name: productName }),
        description,
        instructions
    };

    // إظهار badge مؤقت
    const badge = document.getElementById(`saved-badge-${safeId}`);
    if (badge) {
        badge.style.display = 'inline-flex';
        setTimeout(() => { badge.style.display = 'none'; }, 3000);
    }

    // تحديث شارة الحالة
    const statusBadge = document.getElementById(`badge-${safeId}`);
    if (statusBadge && (description || instructions)) {
        statusBadge.className = 'status-badge badge-done';
        statusBadge.innerHTML = '<i class="fas fa-check"></i> مكتمل';
    }

    showToast('✅ تم الحفظ بنجاح!');
};

// ==================== مسح ====================
window.clearDesc = async (safeId, productName) => {
    if (!confirm(`هل تريد مسح الوصف والإرشادات لـ "${productName}"؟`)) return;

    const existing = allDescriptions[productName];
    if (existing?.id) {
        const { error } = await supabase
            .from('product_descriptions')
            .delete()
            .eq('id', existing.id);
        if (error) { showToast('❌ خطأ: ' + error.message, true); return; }
    }

    delete allDescriptions[productName];
    showToast('🗑️ تم المسح');
    render();
};

// ==================== مساعدات ====================
function safeName(name) {
    return name.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_');
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escAttr(str) {
    return String(str).replace(/'/g, "\\'");
}

function showToast(message, isError = false) {
    document.getElementById('_toast_desc')?.remove();
    const t = document.createElement('div');
    t.id = '_toast_desc';
    t.textContent = message;
    t.style.cssText = `
        position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
        background:${isError ? '#ef4444' : '#22c55e'}; color:white;
        padding:13px 28px; border-radius:11px; font-size:14px; font-weight:700;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.4);
        pointer-events:none; direction:rtl;
        opacity:1; transition:opacity 0.4s;
    `;
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 400);
    }, 2800);
}

// ==================== تشغيل ====================
init();