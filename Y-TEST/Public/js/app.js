import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ضع إعدادات مشروعك هنا (تجدها في إعدادات Firebase Console)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

window.submitOrder = async () => {
    const btn = document.getElementById('submitBtn');
    const msg = document.getElementById('statusMsg');
    const file = document.getElementById('receiptImage').files[0];
    
    // التحقق من البيانات
    if (!file || !document.getElementById('userName').value) {
        alert("يرجى ملء جميع الحقول ورفع الصورة");
        return;
    }

    btn.disabled = true;
    btn.innerText = "جاري الإرسال...";
    msg.classList.remove('hidden');
    msg.innerText = "يتم الآن رفع الصورة والبيانات...";

    try {
        // 1. رفع الصورة إلى Storage
        const storageRef = ref(storage, 'receipts/' + Date.now() + "_" + file.name);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 2. حفظ البيانات في Firestore
        await addDoc(collection(db, "orders"), {
            name: document.getElementById('userName').value,
            service: document.getElementById('serviceType').value,
            details: document.getElementById('accountDetails').value,
            receiptUrl: downloadURL,
            status: "pending",
            createdAt: serverTimestamp()
        });

        msg.className = "text-center text-green-600 font-bold mt-2";
        msg.innerText = "تم إرسال طلبك بنجاح! سنتواصل معك قريباً.";
        btn.innerText = "تم الإرسال ✓";
        
    } catch (e) {
        console.error("Error: ", e);
        msg.className = "text-center text-red-600 mt-2";
        msg.innerText = "حدث خطأ أثناء الإرسال، حاول مرة أخرى.";
        btn.disabled = false;
        btn.innerText = "إرسال الطلب الآن";
    }
};