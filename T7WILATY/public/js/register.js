import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const googleBtn = document.getElementById('google-register-btn');

    // التسجيل بالهاتف وكلمة المرور
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const pass = document.getElementById('reg-pass').value;
            const regBtn = document.getElementById('register-btn');
            const email = `${phone}@secondscard.com`;

            regBtn.innerText = "جاري إنشاء الحساب...";
            regBtn.disabled = true;

            const { data, error } = await supabase.auth.signUp({ email, password: pass });

            if (error) {
                if (error.message.includes('already')) {
                    alert("هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول.");
                } else {
                    alert("خطأ: " + error.message);
                }
                regBtn.innerText = "إنشاء الحساب";
                regBtn.disabled = false;
                return;
            }

            // إنشاء بيانات المستخدم في جدول users
            await supabase.from('users').insert({
                id: data.user.id,
                fullName: name,
                phone: phone,
                balance: 0,
                role: 'user'
            });

            alert(`تم إنشاء حسابك بنجاح! مرحباً بك يا ${name}`);
            window.location.href = "index.html";
        });
    }

    // التسجيل بـ Google
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/index.html' }
            });
            if (error) alert("خطأ: " + error.message);
        });
    }
});