import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const pass = document.getElementById('reg-pass').value;
            const regBtn = document.getElementById('register-btn');

            if (pass.length < 6) {
                alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                return;
            }

            const email = `${phone}@secondscard.com`;

            regBtn.innerText = "جاري إنشاء الحساب...";
            regBtn.disabled = true;

            const { data, error } = await supabase.auth.signUp({ 
                email, 
                password: pass,
                options: {
                    data: { full_name: name, phone }
                }
            });

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
            if (data.user) {
                await supabase.from('users').upsert({
                    id: data.user.id,
                    fullName: name,
                    phone: phone,
                    balance: 0,
                    role: 'user'
                });
            }

            alert(`✅ تم إنشاء حسابك بنجاح! مرحباً بك يا ${name}`);
            window.location.href = "index.html";
        });
    }
});