import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const googleBtn = document.getElementById('google-login-btn');

    // تسجيل الدخول بالهاتف وكلمة المرور
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('user-phone').value.trim();
    const pass = document.getElementById('user-pass').value;
    const loginBtn = document.getElementById('login-btn');

    // تحقق إذا كان المدخل إيميل أو رقم هاتف
    const email = phone.includes('@') ? phone : `${phone}@storcards.com`;

    loginBtn.innerText = "جاري التحقق...";
    loginBtn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

    if (error) {
        alert("البيانات غير صحيحة: " + error.message);
    } else {
        window.location.href = "index.html";
    }

    loginBtn.innerText = "دخول آمن";
    loginBtn.disabled = false;
});

    // تسجيل الدخول بـ Google
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/index.html' }
            });
            if (error) alert("خطأ في تسجيل الدخول بـ Google: " + error.message);
        });
    }
});