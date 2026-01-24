import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 1. إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDElVuFjIc2_N3PlieSQa0CE4JFObLTaRc",
    authDomain: "trend-jomla.firebaseapp.com",
    databaseURL: "https://trend-jomla-default-rtdb.firebaseio.com",
    projectId: "trend-jomla",
    storageBucket: "trend-jomla.firebasestorage.app",
    messagingSenderId: "243297350402",
    appId: "1:243297350402:web:c9edba7477bb74a7fd481b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const productsRef = ref(db, "products");

// 2. دالة واحدة شاملة لإضافة المنتج (صور متعددة + خصم + وصف)
window.addProduct = async function() {
    const title = document.getElementById('pTitle').value;
    const priceOld = parseFloat(document.getElementById('pPriceOld').value) || 0;
    const priceNew = parseFloat(document.getElementById('pPriceNew').value);
    const link = document.getElementById('pLink').value;
    const desc = document.getElementById('pDesc').value;
    const fileInput = document.getElementById('pImgs');

    if (title && priceNew && fileInput.files.length > 0) {
        // حساب نسبة الخصم تلقائياً
        const discountPercent = priceOld > priceNew ? Math.round(((priceOld - priceNew) / priceOld) * 100) : 0;
        
        const imageUrls = [];
        // تحويل كافة الصور إلى Base64
        for (let file of fileInput.files) {
            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            imageUrls.push(dataUrl);
        }

        // إرسال البيانات إلى Firebase
        push(productsRef, {
            title,
            priceOld,
            priceNew,
            discount: discountPercent,
            link: link || "#",
            description: desc,
            images: imageUrls,
            date: Date.now()
        }).then(() => {
            alert("تم نشر المنتج بنجاح!");
            location.reload(); 
        }).catch(err => alert("خطأ في الحفظ: " + err));
    } else {
        alert("يرجى إكمال البيانات: العنوان، السعر الجديد، وصورة واحدة على الأقل.");
    }
};

// 3. دالة واحدة شاملة لعرض المنتجات (تحديث لحظي)
onValue(productsRef, (snapshot) => {
    const display = document.getElementById('adminDisplay') || document.getElementById('productDisplay');
    if (!display) return;
    
    display.innerHTML = "";
    const data = snapshot.val();
    if (!data) return;

    Object.keys(data).forEach((id) => {
        const p = data[id];
        const images = p.images || [];
        const mainImg = images[0] || "";

        // بناء معرض الصور المصغر
        let galleryHtml = "";
        if (images.length > 1) {
            images.forEach(img => {
                galleryHtml += `<img src="${img}" class="thumb" onclick="document.getElementById('img-${id}').src=this.src">`;
            });
        }

        display.innerHTML += `
            <div class="card" style="position: relative;">
                ${p.discount > 0 ? `<div class="discount-badge">خصم ${p.discount}%</div>` : ""}
                
                <img src="${mainImg}" id="img-${id}" class="main-img">
                
                <div class="img-gallery">${galleryHtml}</div>

                <div class="price-box">
                    <span class="price-new">${p.priceNew} $</span>
                    ${p.priceOld > 0 ? `<span class="price-old">${p.priceOld} $</span>` : ""}
                </div>

                <div class="card-content">
                    <h3>${p.title}</h3>
                    <p class="product-desc">${p.description || ""}</p>
                </div>

                <a href="${p.link}" target="_blank" class="btn-buy">اشتري الآن</a>
                
                ${display.id === 'adminDisplay' ? `<button onclick="window.deleteProduct('${id}')" class="del-btn">حذف المنتج ❌</button>` : ""}
            </div>`;
    });
});

// 4. دالة حذف المنتج
window.deleteProduct = (id) => {
    if(confirm("هل تريد حذف هذا المنتج نهائياً؟")) {
        remove(ref(db, `products/${id}`));
    }
};