import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const phone = document.getElementById('user-phone').value.trim();
            const pass = document.getElementById('user-pass').value;
            const loginBtn = document.getElementById('login-btn');

            const email = `${phone}@secondscard.com`;

            loginBtn.innerText = "جاري التحقق...";
            loginBtn.disabled = true;

            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

            if (error) {
                alert("رقم الهاتف أو كلمة المرور غير صحيحة");
            } else {
                window.location.href = "index.html";
            }

            loginBtn.innerText = "دخول آمن";
            loginBtn.disabled = false;
        });
    }
});