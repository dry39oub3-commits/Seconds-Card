import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
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

    const name = userData?.full_name || user.user_metadata?.full_name || 'مستخدم';
const photo = user.user_metadata?.avatar_url || '';

    document.getElementById('user-display-name').value = name;
    document.getElementById('user-name').textContent = name;

displayUserPhoto(photo);

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
       .update({ full_name: newName })
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

await supabase.auth.updateUser({ data: { avatar_url: photoURL } });
displayUserPhoto(photoURL + '?t=' + Date.now());
alert('✅ تم تحديث الصورة!');

// تسجيل الخروج
window.handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        localStorage.clear();
        window.location.href = "index.html";
    }
};

// دالة تحول الـ UUID إلى SC-XXXXXX
function generateSCId(uuid) {
    const hash = uuid.replace(/-/g, '');
    let num = 0;
    for (let i = 0; i < hash.length; i++) {
        num = (num * 31 + hash.charCodeAt(i)) % 900000;
    }
    const scNumber = String(num + 100000).padStart(6, '0');
    return `SC-${scNumber}`;
}


// وظيفة تحديث الصورة في الواجهة
function displayUserPhoto(photoUrl) {
    const imgElement = document.getElementById('user-display-photo');
    const iconElement = document.getElementById('default-avatar-icon');

    if (photoUrl) {
        imgElement.src = photoUrl;
        imgElement.style.display = 'block'; // إظهار الصورة
        iconElement.style.display = 'none'; // إخفاء الأيقونة تماماً
    } else {
        imgElement.style.display = 'none';
        iconElement.style.display = 'block';
    }
}