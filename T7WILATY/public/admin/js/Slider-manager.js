import { supabase } from '../../js/supabase-config.js';

// ===== Gradient Presets =====
const presets = [
    'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
    'linear-gradient(135deg, #0d1b2a, #1b263b, #e63946)',
    'linear-gradient(135deg, #0a0a0a, #1a1a1a, #f39c12)',
    'linear-gradient(135deg, #064e3b, #065f46, #10b981)',
    'linear-gradient(135deg, #1e1b4b, #312e81, #6366f1)',
    'linear-gradient(135deg, #450a0a, #7f1d1d, #ef4444)',
    'linear-gradient(135deg, #0c1445, #1a237e, #3b82f6)',
    'linear-gradient(135deg, #1a0533, #2d1b69, #a855f7)',
];

// رسم أزرار الـ presets
const presetsContainer = document.getElementById('gradient-presets');
presets.forEach((g, i) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.style.background = g;
    btn.title = `خلفية ${i+1}`;
    btn.onclick = () => {
        document.getElementById('slide-gradient').value = g;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updatePreview();
    };
    presetsContainer.appendChild(btn);
});

// ===== معاينة مباشرة =====
window.updatePreview = () => {
    const title    = document.getElementById('slide-title').value || 'العنوان هنا';
    const subtitle = document.getElementById('slide-subtitle').value || 'العنوان الفرعي هنا';
    const btnText  = document.getElementById('slide-btn-text').value || 'تسوق الآن';
    const gradient = document.getElementById('slide-gradient').value || '#1e293b';
    const image    = document.getElementById('slide-image').value.trim();

    document.getElementById('prev-title').textContent = title;
    document.getElementById('prev-subtitle').textContent = subtitle;
    document.getElementById('prev-btn-text').textContent = btnText;
    document.getElementById('gradient-preview').style.background = gradient;

    const preview = document.getElementById('slide-preview');

    if (image) {
        preview.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${image}')`;
        preview.style.backgroundSize = 'cover';
        preview.style.backgroundPosition = 'center';
        preview.style.backgroundBlendMode = 'normal';
    } else {
        preview.style.backgroundImage = gradient;
        preview.style.backgroundSize = '';
        preview.style.backgroundPosition = '';
        preview.style.background = gradient;
    }
};

// ربط المدخلات بالمعاينة
['slide-title','slide-subtitle','slide-btn-text','slide-image'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
});

// ===== جلب الشرائح =====
async function loadSlides() {
    const list = document.getElementById('slides-list');
    list.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';

    const { data: slides, error } = await supabase
        .from('sliders')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>خطأ: ${error.message}</p></div>`;
        return;
    }

    if (!slides || slides.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-images"></i><p>لا توجد شرائح بعد — أضف أول شريحة!</p></div>`;
        return;
    }

    list.innerHTML = slides.map(s => {
        const bgStyle = s.image_url
            ? `background-image: linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${s.image_url}'); background-size:cover; background-position:center;`
            : `background: ${s.gradient || '#334155'};`;

        return `
        <div class="slide-card" id="card-${s.id}">
            <div class="slide-color-bar" style="${bgStyle}">
                ${s.image_url ? `<img src="${s.image_url}" style="display:none;">` : ''}
            </div>
            <div class="slide-info">
                <h4>${s.title}</h4>
                <p>${s.subtitle || 'بدون عنوان فرعي'}</p>
                <div class="slide-meta">
                    <span class="meta-tag"><i class="fas fa-link"></i> ${s.btn_link || '#'}</span>
                    <span class="meta-tag"><i class="fas fa-sort"></i> ترتيب: ${s.sort_order}</span>
                    ${s.image_url ? `<span class="meta-tag"><i class="fas fa-image"></i> صورة</span>` : ''}
                    <span class="status-badge ${s.is_active ? 'badge-active' : 'badge-inactive'}">
                        ${s.is_active ? '✅ مفعّل' : '❌ معطّل'}
                    </span>
                </div>
            </div>
            <div class="slide-actions">
                <button class="action-btn-sm btn-up" onclick="moveSlide('${s.id}', 'up')" title="رفع">
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="action-btn-sm btn-down" onclick="moveSlide('${s.id}', 'down')" title="إنزال">
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="action-btn-sm btn-toggle-active ${s.is_active ? '' : 'inactive'}"
                    onclick="toggleActive('${s.id}', ${s.is_active})" title="${s.is_active ? 'تعطيل' : 'تفعيل'}">
                    <i class="fas fa-power-off"></i>
                </button>
                <button class="action-btn-sm btn-edit" onclick="editSlide(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn-sm btn-delete" onclick="deleteSlide('${s.id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// ===== حفظ/تعديل =====
window.saveSlide = async () => {
    const id       = document.getElementById('edit-id').value;
    const title    = document.getElementById('slide-title').value.trim();
    const subtitle = document.getElementById('slide-subtitle').value.trim();
    const btnText  = document.getElementById('slide-btn-text').value.trim();
    const btnLink  = document.getElementById('slide-btn-link').value.trim();
    const gradient = document.getElementById('slide-gradient').value.trim();
    const image    = document.getElementById('slide-image').value.trim();
    const order    = parseInt(document.getElementById('slide-order').value) || 0;

    if (!title) { alert('⚠️ العنوان مطلوب!'); return; }

    const payload = {
        title,
        subtitle,
        btn_text: btnText,
        btn_link: btnLink,
        gradient,
        sort_order: order,
        image_url: image || null
    };

    let error;
    if (id) {
        ({ error } = await supabase.from('sliders').update(payload).eq('id', id));
    } else {
        ({ error } = await supabase.from('sliders').insert({ ...payload, is_active: true }));
    }

    if (error) { alert('❌ خطأ: ' + error.message); return; }
    alert(id ? '✅ تم تحديث الشريحة!' : '✅ تمت إضافة الشريحة!');
    resetForm();
    loadSlides();
};

// ===== تعديل =====
window.editSlide = (slide) => {
    document.getElementById('edit-id').value          = slide.id;
    document.getElementById('slide-title').value      = slide.title || '';
    document.getElementById('slide-subtitle').value   = slide.subtitle || '';
    document.getElementById('slide-btn-text').value   = slide.btn_text || 'تسوق الآن';
    document.getElementById('slide-btn-link').value   = slide.btn_link || '#cards-grid';
    document.getElementById('slide-gradient').value   = slide.gradient || '';
    document.getElementById('slide-order').value      = slide.sort_order || 0;
    document.getElementById('slide-image').value      = slide.image_url || '';
    document.getElementById('form-title-text').textContent = 'تعديل الشريحة';
    updatePreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ===== حذف =====
window.deleteSlide = async (id) => {
    if (!confirm('هل تريد حذف هذه الشريحة؟')) return;
    const { error } = await supabase.from('sliders').delete().eq('id', id);
    if (error) { alert('❌ خطأ: ' + error.message); return; }
    loadSlides();
};

// ===== تفعيل/تعطيل =====
window.toggleActive = async (id, current) => {
    const { error } = await supabase.from('sliders').update({ is_active: !current }).eq('id', id);
    if (error) { alert('❌ خطأ: ' + error.message); return; }
    loadSlides();
};

// ===== تغيير الترتيب =====
window.moveSlide = async (id, dir) => {
    const { data: slides } = await supabase.from('sliders').select('*').order('sort_order', { ascending: true });
    const idx = slides.findIndex(s => s.id === id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;

    const a = slides[idx], b = slides[swapIdx];
    await supabase.from('sliders').update({ sort_order: b.sort_order }).eq('id', a.id);
    await supabase.from('sliders').update({ sort_order: a.sort_order }).eq('id', b.id);
    loadSlides();
};

// ===== إعادة تعيين النموذج =====
window.resetForm = () => {
    document.getElementById('edit-id').value        = '';
    document.getElementById('slide-title').value    = '';
    document.getElementById('slide-subtitle').value = '';
    document.getElementById('slide-btn-text').value = 'تسوق الآن';
    document.getElementById('slide-btn-link').value = '#cards-grid';
    document.getElementById('slide-gradient').value = '';
    document.getElementById('slide-order').value    = '0';
    document.getElementById('slide-image').value    = '';
    document.getElementById('form-title-text').textContent = 'إضافة شريحة جديدة';
    document.getElementById('gradient-preview').style.background = '';
    document.getElementById('slide-preview').style.background = '#1e293b';
    document.getElementById('slide-preview').style.backgroundImage = '';
    document.getElementById('prev-title').textContent = 'العنوان هنا';
    document.getElementById('prev-subtitle').textContent = 'العنوان الفرعي هنا';
    document.getElementById('prev-btn-text').textContent = 'تسوق الآن';
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
};

// ===== خروج =====
document.getElementById('logoutBtn').onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
};



// تحميل عند البداية
loadSlides();