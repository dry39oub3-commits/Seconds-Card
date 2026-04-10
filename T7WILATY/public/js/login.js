// استيراد auth من ملف الإعدادات الرئيسي
import { auth } from './supabase-config.js';
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const phone = document.getElementById('user-phone').value.trim();
        const pass = document.getElementById('user-pass').value;
        const loginBtn = document.getElementById('login-btn');

        // تحويل رقم الهاتف إلى إيميل ليعمل مع Firebase Auth في مشروع StorCards
        const email = `${phone}@storcards.com`;

        loginBtn.innerText = "جاري التحقق سحابياً...";
        loginBtn.disabled = true;

        try {
            // تسجيل الدخول في Firebase Auth (الإصدار الجديد)
            await signInWithEmailAndPassword(auth, email, pass);
            
            alert("مرحباً بك في StorCards");
            window.location.href = "index.html";

        } catch (error) {
            console.error("Login Error:", error.code);
            
            // معالجة الأخطاء الشائعة
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                alert("رقم الهاتف أو كلمة المرور غير صحيحة");
            } else if (error.code === 'auth/too-many-requests') {
                alert("محاولات كثيرة خاطئة، يرجى المحاولة لاحقاً.");
            } else {
                alert("حدث خطأ أثناء الدخول: " + error.message);
            }
        } finally {
            loginBtn.innerText = "دخول آمن";
            loginBtn.disabled = false;
        }
    });
}

// مراقب حالة تسجيل الدخول لتحديث واجهة المستخدم
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("StorCards Auth: المستخدم مسجل دخوله بـ ID:", user.uid);
        // هنا يمكنك إضافة كود لإظهار أزرار المحفظة أو إخفاء زر الدخول
    } else {
        console.log("StorCards Auth: لا يوجد مستخدم مسجل حالياً");
    }
});