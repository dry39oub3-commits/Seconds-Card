import { supabase } from './supabase-config.js';

// ✅ تسجيل الدخول بـ Google
window.signInWithGoogle = async () => {
    const btn = document.getElementById('google-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/index.html'
        }
    });

    if (error) {
        showToast('⚠️ فشل تسجيل الدخول بـ Google');
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
};

// ── الوضع الحالي: email أو phone ──
let loginMode = 'email';

window.switchTab = (mode) => {
    loginMode = mode;

    document.getElementById('tab-email').classList.toggle('active', mode === 'email');
    document.getElementById('tab-phone').classList.toggle('active', mode === 'phone');

    document.getElementById('field-email').style.display = mode === 'email' ? 'block' : 'none';
    document.getElementById('field-phone').style.display = mode === 'phone' ? 'block' : 'none';

    document.getElementById('reg-email').required = mode === 'email';
    document.getElementById('reg-phone').required = mode === 'phone';
};

document.addEventListener('DOMContentLoaded', () => {

    // السماح بالأرقام فقط في حقل الهاتف
    const phoneInput = document.getElementById('reg-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '');
        });
    }

    // عرض/إخفاء كلمة المرور
    const togglePass = document.getElementById('toggle-pass');
    const passInput  = document.getElementById('user-pass');
    if (togglePass && passInput) {
        togglePass.addEventListener('click', () => {
            const isHidden = passInput.type === 'password';
            passInput.type = isHidden ? 'text' : 'password';
            togglePass.classList.toggle('fa-eye', !isHidden);
            togglePass.classList.toggle('fa-eye-slash', isHidden);
        });
    }

    // تسجيل الدخول بالإيميل أو الهاتف
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pass     = passInput.value;
            const loginBtn = document.getElementById('login-btn');

            loginBtn.innerText = 'جاري التحقق...';
            loginBtn.disabled  = true;

            let email = '';

            if (loginMode === 'email') {
                email = document.getElementById('reg-email').value.trim();
            } else {
                const phone = document.getElementById('reg-phone').value.trim();

                if (phone.length !== 8) {
                    showToast('⚠️ رقم الهاتف يجب أن يكون 8 أرقام');
                    loginBtn.innerText = 'دخول آمن';
                    loginBtn.disabled  = false;
                    return;
                }

                const fullPhone = '+222' + phone;

                const { data: profile, error: profileError } = await supabase
                    .from('users')
                    .select('email')
                    .eq('phone', fullPhone)
                    .single();

                if (profileError || !profile?.email) {
                    showToast('⚠️ رقم الهاتف غير مسجل');
                    loginBtn.innerText = 'دخول آمن';
                    loginBtn.disabled  = false;
                    return;
                }

                email = profile.email;
            }

            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

            if (error) {
                showToast('⚠️ ' + (loginMode === 'phone'
                    ? 'رقم الهاتف أو كلمة المرور غير صحيحة'
                    : 'البريد الإلكتروني أو كلمة المرور غير صحيحة'));
                loginBtn.innerText = 'دخول آمن';
                loginBtn.disabled  = false;
                return;
            }

            const redirectTo = localStorage.getItem('redirectAfterLogin') || 'index.html';
            localStorage.removeItem('redirectAfterLogin');
            window.location.replace(redirectTo);
        });
    }
});

function showToast(message) {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.textContent = message;
    t.style.cssText = `
        position:fixed; top:24px; left:50%;
        transform:translateX(-50%) translateY(-10px);
        background:#ef4444; color:white;
        padding:12px 24px; border-radius:10px;
        font-size:14px; font-weight:700;
        font-family:'Tajawal',sans-serif;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
        opacity:0; transition:opacity 0.3s,transform 0.3s;
        pointer-events:none; white-space:nowrap;
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