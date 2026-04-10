// استيراد auth من ملف الإعدادات الرئيسي
import { auth } from './supabase-config.js';
import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. مراقب حالة تسجيل الدخول في مشروع StorCards
onAuthStateChanged(auth, (user) => {
    if (user) {
        // عرض رقم التعريف (UID)
        const userUidElem = document.getElementById('user-uid');
        if (userUidElem) userUidElem.textContent = user.uid;

        // عرض اسم المستخدم (نستخدم "مستخدم StorCards" كاسم افتراضي)
        const userNameElem = document.getElementById('user-name');
        if (userNameElem) {
            userNameElem.textContent = user.displayName || "مستخدم StorCards";
        }

        // عرض وتنسيق تاريخ الانضمام
        const userJoinedElem = document.getElementById('user-joined');
        if (userJoinedElem && user.metadata && user.metadata.creationTime) {
            const creationDate = new Date(user.metadata.creationTime);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            userJoinedElem.textContent = creationDate.toLocaleDateString('ar-SA', options);
        }

        // تحديث حقول الهيدر إذا كانت موجودة (Input أو Text)
        const loadingHeader = document.getElementById('user-display-name');
        if (loadingHeader) {
            loadingHeader.value = user.displayName || "مستخدم StorCards";
        }
        
        const loadingEmail = document.getElementById('user-display-email');
        if (loadingEmail) {
            loadingEmail.textContent = user.email;
        }

    } else {
        // إذا لم يكن هناك مستخدم مسجل، يتم توجيهه لصفحة الدخول
        console.log("No user detected, redirecting...");
        window.location.href = "login.html";
    }
});

/**
 * 2. دالة تسجيل الخروج (لزر الخروج في الصفحة)
 * قمت بجعلها دالة عالمية ليتمكن زر HTML من الوصول إليها
 */
window.handleLogout = async () => {
    try {
        await signOut(auth);
        // مسح بيانات التخزين المحلي والتوجه للرئيسية
        localStorage.clear();
        window.location.href = "index.html";
    } catch (error) {
        console.error("خطأ أثناء تسجيل الخروج:", error);
        alert("حدث خطأ أثناء محاولة تسجيل الخروج.");
    }
};