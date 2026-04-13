import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

   

    // عرض البيانات الأساسية
    document.getElementById('user-uid').textContent = user.id;
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

    const name = userData?.fullName || user.user_metadata?.full_name || 'مستخدم';
    const photo = userData?.photoURL || user.user_metadata?.avatar_url || '';

    document.getElementById('user-display-name').value = name;
    document.getElementById('user-name').textContent = name;

    if (photo) {
        const img = document.getElementById('user-display-photo');
        img.src = photo;
        img.style.display = 'block';
    }

    // إظهار زر الحفظ عند تعديل الاسم
    document.getElementById('user-display-name').addEventListener('input', () => {
        document.getElementById('save-profile-btn').style.display = 'block';
    });
});

// حفظ التعديلات
window.updateProfileData = async function() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const newName = document.getElementById('user-display-name').value.trim();

    const { error } = await supabase
        .from('users')
        .upsert({ id: user.id, fullName: newName })
        .eq('id', user.id);

    if (error) {
        alert('خطأ في الحفظ: ' + error.message);
    } else {
        alert('✅ تم حفظ التعديلات!');
        document.getElementById('save-profile-btn').style.display = 'none';
        document.getElementById('user-name').textContent = newName;
    }
};

// رفع الصورة
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

    if (uploadError) { alert('خطأ في رفع الصورة'); return; }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const photoURL = data.publicUrl;

    await supabase.from('users').upsert({ id: user.id, photoURL }).eq('id', user.id);

    const img = document.getElementById('user-display-photo');
    img.src = photoURL + '?t=' + Date.now();
    img.style.display = 'block';
    alert('✅ تم تحديث الصورة!');
});

