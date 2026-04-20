import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // عرض البيانات الأساسية
    document.getElementById('user-uid').textContent = generateSCId(user.id);
    document.getElementById('user-display-email').textContent = user.email || '--';

    // تاريخ الانضمام
    const creationDate = new Date(user.created_at);
    document.getElementById('user-joined').textContent = creationDate.toLocaleDateString('ar-SA', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // جلب بيانات المستخدم من جدول users
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    const name  = userData?.full_name || user.user_metadata?.full_name || 'مستخدم';

    // ← التعديل الأول: نقرأ الصورة من جدول users أولاً، ثم metadata كـ بديل
    const photo = userData?.avatar_url || user.user_metadata?.avatar_url || '';

    document.getElementById('user-display-name').value = name;
    document.getElementById('user-name').textContent   = name;

    displayUserPhoto(photo);
    updateHeaderAvatar(photo);

    // إظهار زر الحفظ عند تعديل الاسم
    document.getElementById('user-display-name').addEventListener('input', () => {
        document.getElementById('save-profile-btn').style.display = 'block';
    });
});

// ==================== حفظ التعديلات ====================
window.updateProfileData = async function() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const newName = document.getElementById('user-display-name').value.trim();

    const { error } = await supabase
        .from('users')
        .update({ full_name: newName })
        .eq('id', user.id);

    if (error) {
        showToast('خطأ في الحفظ: ' + error.message, 'error');
    } else {
        showToast('✅ تم حفظ التعديلات!');
        document.getElementById('save-profile-btn').style.display = 'none';
        document.getElementById('user-name').textContent = newName;
    }
};

// ==================== رفع الصورة (مُصلح بالكامل) ====================
window.triggerPhotoUpload = function() {
    document.getElementById('photo-input').click();
};

document.getElementById('photo-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // 1) رفع الملف إلى Storage
    const filePath = `avatars/${user.id}`;
    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

    if (uploadError) {
        showToast('خطأ في رفع الصورة: ' + uploadError.message, 'error');
        return;
    }

    // 2) الحصول على الرابط العام
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const photoURL = data.publicUrl;
    const freshUrl = photoURL + '?t=' + Date.now();

    // 3) ← التعديل الثاني: حفظ الرابط في جدول users (المصدر الموثوق)
    const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: freshUrl })
        .eq('id', user.id);

    if (dbError) {
        showToast('خطأ في حفظ الصورة في قاعدة البيانات', 'error');
        return;
    }

    // 4) تحديث metadata في Auth (كمصدر ثانوي)
    const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: freshUrl }
    });

    if (metaError) {
        console.warn('تحذير: لم يتم تحديث metadata:', metaError.message);
        // لا نوقف العملية لأننا حفظنا في جدول users بنجاح
    }

    // 5) تحديث الواجهة فوراً
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

// ==================== عرض الصورة في البروفيل ====================
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