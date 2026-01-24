import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// إعدادات Firebase الخاصة بمشروعك "trend-jomla"
const firebaseConfig = {
  apiKey: "AIzaSyDElVuFjIc2_N3PlieSQa0CE4JFObLTaRc",
  authDomain: "trend-jomla.firebaseapp.com",
  databaseURL: "https://trend-jomla-default-rtdb.firebaseio.com", // الرابط المستخرج من صورتك
  projectId: "trend-jomla",
  storageBucket: "trend-jomla.firebasestorage.app",
  messagingSenderId: "243297350402",
  appId: "1:243297350402:web:c9edba7477bb74a7fd481b",
  measurementId: "G-42D33N1BFW"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const productsRef = ref(db, "products");

// دالة إضافة المنتج (تعمل عند الضغط على زر الحفظ)
window.addProduct = function() {
    const title = document.getElementById('pTitle').value;
    const price = document.getElementById('pPrice').value;
    const link = document.getElementById('pLink').value;
    const fileInput = document.getElementById('pImg');

    if (title && price && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            push(productsRef, {
                title: title,
                price: price,
                link: link || "#",
                img: e.target.result
            }).then(() => {
                alert("تم بنجاح! المنتج سيظهر في الأسفل فوراً.");
                // تفريغ الحقول بعد الإضافة
                document.getElementById('pTitle').value = "";
                document.getElementById('pPrice').value = "";
                document.getElementById('pLink').value = "";
                fileInput.value = "";
            });
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        alert("يرجى إدخال اسم المنتج والسعر واختيار صورة");
    }
};

// دالة عرض المنتجات تلقائياً في الأسفل (تحديث لحظي)
onValue(productsRef, (snapshot) => {
    const data = snapshot.val();
    const display = document.getElementById('adminDisplay') || document.getElementById('productDisplay');
    if (!display) return;
    
    display.innerHTML = ""; 
    for (let id in data) {
        const p = data[id];
        display.innerHTML += `
            <div class="card">
                <img src="${p.img}">
                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p class="price">${p.price}</p>
                    <a href="${p.link}" target="_blank" class="btn-buy">اطلب الآن</a>
                    ${display.id === 'adminDisplay' ? `<button onclick="window.deleteProduct('${id}')" style="background:#c0392b; margin-top:10px; border:none; color:white; padding:5px; width:100%; cursor:pointer;">حذف المنتج ❌</button>` : ""}
                </div>
            </div>`;
    }
});

// دالة حذف المنتج
window.deleteProduct = function(id) {
    if(confirm("هل تريد حذف هذا المنتج نهائياً؟")) {
        remove(ref(db, `products/${id}`));
    }
};