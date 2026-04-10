// استيراد الخدمات من ملف الإعدادات الرئيسي
import { auth, db } from './supabase-config.js';
import { 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const registerForm = document.getElementById('register-form');

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('reg-name').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const pass = document.getElementById('reg-pass').value;
        const regBtn = document.getElementById('register-btn');

        // تحويل الهاتف إلى إيميل وهمي للتعامل مع Firebase Auth بمشروع StorCards
        const email = `${phone}@storcards.com`;

        // تغيير حالة الزر
        regBtn.innerText = "جاري إنشاء الحساب...";
        regBtn.disabled = true;

        try {
            // 1. إنشاء الحساب في Firebase Authentication (الإصدار الجديد)
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // 2. إنشاء وثيقة المستخدم في Firestore (الإصدار الجديد)
            // نستخدم setDoc مع doc لتحديد معرف الوثيقة بـ UID الخاص بالمستخدم
            await setDoc(doc(db, "users", user.uid), {
                fullName: name,
                phone: phone,
                balance: 0, // رصيد افتراضي
                role: "user",
                createdAt: serverTimestamp()
            });

            alert(`تم إنشاء حسابك بنجاح! مرحباً بك يا ${name}`);
            
            // التوجيه للصفحة الرئيسية
            window.location.href = "index.html";

        } catch (error) {
            console.error("Registration Error:", error.code);
            
            // معالجة الأخطاء الشائعة
            if (error.code === 'auth/email-already-in-use') {
                alert("هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول.");
            } else if (error.code === 'auth/weak-password') {
                alert("كلمة المرور ضعيفة، يرجى اختيار 6 أحرف أو أكثر.");
            } else if (error.code === 'auth/invalid-email') {
                alert("تنسيق الرقم غير صحيح.");
            } else {
                alert("حدث خطأ أثناء التسجيل: " + error.message);
            }
        } finally {
            // إعادة حالة الزر
            regBtn.innerText = "إنشاء الحساب";
            regBtn.disabled = false;
        }
    });
}