import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const form    = document.getElementById('forgot-form');
    const btn     = document.getElementById('forgot-btn');
    const success = document.getElementById('success-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('forgot-email').value.trim();
        btn.innerText = 'جاري الإرسال...';
        btn.disabled  = true;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password.html`
        });

        if (error) {
            alert('حدث خطأ، تأكد من البريد الإلكتروني وحاول مجدداً');
            btn.innerText = 'إرسال رابط الاستعادة';
            btn.disabled  = false;
            return;
        }

        // إخفاء الفورم وإظهار رسالة النجاح
        form.style.display    = 'none';
        success.style.display = 'block';
    });
});