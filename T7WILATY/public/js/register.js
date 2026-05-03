import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    // ── عرض/إخفاء كلمة المرور ──
    const togglePass = document.getElementById('toggle-reg-pass');
    const passInput  = document.getElementById('reg-pass');
    if (togglePass && passInput) {
        togglePass.addEventListener('click', () => {
            const isHidden = passInput.type === 'password';
            passInput.type = isHidden ? 'text' : 'password';
            togglePass.classList.toggle('fa-eye', !isHidden);
            togglePass.classList.toggle('fa-eye-slash', isHidden);
        });
    }

    // ── السماح بالأرقام فقط في حقل الهاتف ──
    const phoneInput = document.getElementById('reg-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '');
        });
    }

    // ── التسجيل ──
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name  = document.getElementById('reg-name').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const pass  = document.getElementById('reg-pass').value;
            const regBtn = document.getElementById('register-btn');

            // التحقق من البريد
            if (!email.includes('@') || !email.includes('.')) {
                showToast('⚠️ يرجى إدخال بريد إلكتروني صحيح');
                return;
            }

            // التحقق من الهاتف
            if (phone.length !== 8) {
                showToast('⚠️ رقم الهاتف يجب أن يكون 8 أرقام');
                return;
            }

            // التحقق من كلمة المرور
            if (pass.length < 6) {
                showToast('⚠️ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                return;
            }

            const fullPhone = '+222' + phone;

            regBtn.innerText = 'جاري إنشاء الحساب...';
            regBtn.disabled  = true;

            // التحقق من أن رقم الهاتف غير مسجل مسبقاً
            const { data: existingPhone } = await supabase
                .from('users')
                .select('id')
                .eq('phone', fullPhone)
                .single();

            if (existingPhone) {
                showToast('⚠️ رقم الهاتف مسجل مسبقاً، يرجى تسجيل الدخول');
                regBtn.innerText = 'إنشاء الحساب';
                regBtn.disabled  = false;
                return;
            }

            // إنشاء الحساب
            const { data, error } = await supabase.auth.signUp({
                email,
                password: pass,
                options: {
                    data: {
                        full_name: name,
                        phone: fullPhone
                    }
                }
            });

            if (error) {
                if (error.message.includes('already')) {
                    showToast('⚠️ هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول');
                } else {
                    showToast('خطأ: ' + error.message);
                }
                regBtn.innerText = 'إنشاء الحساب';
                regBtn.disabled  = false;
                return;
            }

            // حفظ بيانات المستخدم مع الهاتف
            if (data.user) {
                await supabase.from('users').upsert({
                id:        data.user.id,
                full_name: name,       // ← اسم الحقل الصحيح
                fullName:  name,       // ← للتوافق مع القديم
                phone:     fullPhone,
                balance:   0,
                role:      'user'
            });
          }

            showToast(`✅ تم إنشاء حسابك بنجاح! مرحباً بك يا ${name}`);
            setTimeout(() => window.location.href = 'index.html', 1500);
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
        background: ${type === 'error' ? '#ef4444' : '#22c55e'};
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