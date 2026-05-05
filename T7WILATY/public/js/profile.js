import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // عرض البيانات الأساسية
    document.getElementById('user-uid').textContent = generateSCId(user.id);

    // تاريخ الانضمام
    const creationDate = new Date(user.created_at);
    document.getElementById('user-joined').textContent = creationDate.toLocaleDateString('ar-SA', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // البريد الإلكتروني — للعرض فقط (لا يمكن تعديله)
    document.getElementById('user-display-email').textContent = user.email || '--';

    // جلب بيانات المستخدم من جدول users
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    const name  = userData?.full_name || userData?.fullName || user.user_metadata?.full_name || 'مستخدم';
    const photo = userData?.avatar_url || user.user_metadata?.avatar_url || '';
let phone = userData?.phone || '';

if (!phone && user.user_metadata?.phone) {
    await supabase.from('users')
        .update({ phone: user.user_metadata.phone })
        .eq('id', user.id);
    phone = user.user_metadata.phone;
}

const displayPhone = phone;

    document.getElementById('user-display-name').value = name;

    // عرض رقم الهاتف
    const phoneEl     = document.getElementById('user-display-phone');
const addPhoneBtn = document.getElementById('add-phone-btn');
if (displayPhone) {
    phoneEl.textContent = displayPhone;
    addPhoneBtn.style.display = 'none';
} else {
    phoneEl.textContent = 'لم يُضف بعد';
    phoneEl.style.color = 'var(--text-soft)';
    addPhoneBtn.style.display = 'inline-flex';
}

    displayUserPhoto(photo);
    updateHeaderAvatar(photo);

    // إظهار زر الحفظ عند تعديل الاسم
    document.getElementById('user-display-name').addEventListener('input', () => {
        document.getElementById('save-profile-btn').style.display = 'block';
    });

    // السماح بالأرقام فقط في حقل الهاتف بالـ modal
    const modalPhone = document.getElementById('modal-phone-input');
    if (modalPhone) {
        modalPhone.addEventListener('input', () => {
            modalPhone.value = modalPhone.value.replace(/\D/g, '');
        });
    }
});

// ==================== حفظ الاسم ====================
window.updateProfileData = async function() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const newName = document.getElementById('user-display-name').value.trim();
    if (!newName) { showToast('⚠️ الاسم لا يمكن أن يكون فارغاً', 'error'); return; }

    const { error } = await supabase
        .from('users')
        .update({ full_name: newName })
        .eq('id', user.id);

    if (error) {
        showToast('خطأ في الحفظ: ' + error.message, 'error');
    } else {
        showToast('✅ تم حفظ الاسم!');
        document.getElementById('save-profile-btn').style.display = 'none';
    }
};

// ==================== Modal رقم الهاتف ====================
window.openPhoneModal = () => {
    document.getElementById('phone-modal').style.display = 'flex';
    document.getElementById('modal-phone-input').focus();
};

window.closePhoneModal = (e) => {
    if (!e || e.target === document.getElementById('phone-modal')) {
        document.getElementById('phone-modal').style.display = 'none';
        document.getElementById('modal-phone-input').value = '';
    }
};

window.savePhone = async () => {
    const phone = document.getElementById('modal-phone-input').value.trim();
    const btn   = document.getElementById('save-phone-btn');

    if (phone.length !== 8) {
        showToast('⚠️ رقم الهاتف يجب أن يكون 8 أرقام', 'error');
        return;
    }

    const fullPhone = '+222' + phone;

    // التحقق من أن الرقم غير مسجل مسبقاً
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('phone', fullPhone)
        .single();

    if (existing) {
        showToast('⚠️ رقم الهاتف مسجل لدى حساب آخر', 'error');
        return;
    }

    btn.innerText = 'جاري الحفظ...';
    btn.disabled  = true;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { error } = await supabase
        .from('users')
        .update({ phone: fullPhone })
        .eq('id', user.id);

    if (error) {
        showToast('خطأ في الحفظ: ' + error.message, 'error');
        btn.innerText = 'حفظ الرقم';
        btn.disabled  = false;
        return;
    }

    // تحديث الواجهة
    document.getElementById('user-display-phone').textContent = fullPhone;
    document.getElementById('user-display-phone').style.color = '';
    document.getElementById('add-phone-btn').style.display = 'none';
    document.getElementById('phone-modal').style.display   = 'none';
    document.getElementById('modal-phone-input').value     = '';
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ الرقم';
    btn.disabled  = false;

    showToast('✅ تم حفظ رقم الهاتف!');
    setTimeout(() => window.location.reload(), 1000);
};

// ==================== رفع الصورة ====================
window.triggerPhotoUpload = function() {
    document.getElementById('photo-input').click();
};

document.getElementById('photo-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const filePath = `avatars/${user.id}`;
    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        showToast('خطأ في رفع الصورة: ' + uploadError.message, 'error');
        return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const freshUrl = data.publicUrl + '?t=' + Date.now();

    const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: freshUrl })
        .eq('id', user.id);

    if (dbError) {
        showToast('خطأ في حفظ الصورة', 'error');
        return;
    }

    await supabase.auth.updateUser({ data: { avatar_url: freshUrl } });

    displayUserPhoto(freshUrl);
    window.updateHeaderAvatar?.(freshUrl);
    showToast('✅ تم تحديث الصورة!');
});

// ==================== تحديث أيقونة الهيدر ====================
function updateHeaderAvatar(photoUrl) {
    const userBtn = document.getElementById('user-icon-btn');
    if (!userBtn) return;

    if (photoUrl) {
        userBtn.innerHTML = `
            <img src="${photoUrl}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                 style="width:32px; height:32px; border-radius:50%; object-fit:cover;
                        border:2px solid #f97316; display:block;">
            <i class="fas fa-user-check" style="display:none;"></i>
        `;
        userBtn.style.cssText = 'padding:0; background:transparent; border:none; cursor:pointer;';
    } else {
        userBtn.innerHTML = '<i class="fas fa-user-check"></i>';
    }

    userBtn.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('user-dropdown')?.classList.toggle('show');
    };
}

// ==================== تسجيل الخروج ====================
window.handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

// ==================== SC-ID ====================
function generateSCId(uuid) {
    const hash = uuid.replace(/-/g, '');
    let num = 0;
    for (let i = 0; i < hash.length; i++) {
        num = (num * 31 + hash.charCodeAt(i)) % 900000;
    }
    return `SC-${String(num + 100000).padStart(6, '0')}`;
}

// ==================== عرض الصورة ====================
function displayUserPhoto(photoUrl) {
    const imgElement  = document.getElementById('user-display-photo');
    const iconElement = document.getElementById('default-avatar-icon');

    if (photoUrl) {
        imgElement.src = photoUrl;
        imgElement.style.display = 'block';
        iconElement.style.display = 'none';
    } else {
        imgElement.style.display  = 'none';
        iconElement.style.display = 'block';
    }
}

// ==================== Theme ====================
function initTheme() {
    const btn   = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateIcon(saved);
    if (!btn) return;
    btn.onclick = () => {
        const cur  = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateIcon(next);
    };
}

function updateIcon(theme) {
    const i = document.querySelector('#theme-toggle i');
    if (i) i.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ==================== Toast ====================
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