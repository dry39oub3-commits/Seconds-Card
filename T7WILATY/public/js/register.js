import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            if (!email.includes('@') || !email.includes('.')) {
    showToast('⚠️ يرجى إدخال بريد إلكتروني صحيح مثال: example@gmail.com');
    return;
}
            const pass = document.getElementById('reg-pass').value;
            const regBtn = document.getElementById('register-btn');

            if (pass.length < 6) {
                showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                return;
            }

            regBtn.innerText = "جاري إنشاء الحساب...";
            regBtn.disabled = true;

            const { data, error } = await supabase.auth.signUp({ 
                email, 
                password: pass,
                options: {
                    data: { full_name: name }
                }
            });

            if (error) {
                if (error.message.includes('already')) {
                    showToast("هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول.");
                } else {
                    showToast("خطأ: " + error.message);
                }
                regBtn.innerText = "إنشاء الحساب";
                regBtn.disabled = false;
                return;
            }

            if (data.user) {
                await supabase.from('users').upsert({
                    id: data.user.id,
                    fullName: name,
                    balance: 0,
                    role: 'user'
                });
            }

            showToast(`✅ تم إنشاء حسابك بنجاح! مرحباً بك يا ${name}`);
            window.location.href = "index.html";
        });
    }
});

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