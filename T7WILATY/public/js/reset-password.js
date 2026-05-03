import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const form    = document.getElementById('reset-form');
    const btn     = document.getElementById('reset-btn');
    const passErr = document.getElementById('pass-error');
    const success = document.getElementById('reset-success');

    // ── إظهار/إخفاء كلمة المرور ──
    document.getElementById('toggle-new').addEventListener('click', () => {
        const input = document.getElementById('new-pass');
        input.type  = input.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('toggle-confirm').addEventListener('click', () => {
        const input = document.getElementById('confirm-pass');
        input.type  = input.type === 'password' ? 'text' : 'password';
    });

    // ── التحقق من الجلسة (Supabase يرسل التوكن في الـ URL) ──
    supabase.auth.onAuthStateChange(async (event) => {
        if (event === 'PASSWORD_RECOVERY') {
            // المستخدم وصل من رابط الإيميل — الجلسة جاهزة
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPass     = document.getElementById('new-pass').value;
        const confirmPass = document.getElementById('confirm-pass').value;

        // التحقق من التطابق
        if (newPass !== confirmPass) {
            passErr.style.display = 'block';
            return;
        }
        passErr.style.display = 'none';

        btn.innerText = 'جاري الحفظ...';
        btn.disabled  = true;

        const { error } = await supabase.auth.updateUser({ password: newPass });

        if (error) {
            alert('حدث خطأ، حاول مجدداً أو اطلب رابطاً جديداً');
            btn.innerText = 'حفظ كلمة المرور';
            btn.disabled  = false;
            return;
        }

        // نجح التغيير
        form.style.display    = 'none';
        success.style.display = 'block';

        // تحويل لصفحة الدخول بعد 2 ثانية
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    });
});