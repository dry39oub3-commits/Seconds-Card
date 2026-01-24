// مصفوفة المنتجات (تُحمل من الذاكرة المحلية أو تكون فارغة)
let products = JSON.parse(localStorage.getItem('myProducts')) || [];

// وظيفة إضافة منتج (للإدارة)
async function addProduct() {
    const title = document.getElementById('pTitle').value;
    const price = document.getElementById('pPrice').value;
    const link = document.getElementById('pLink').value;
    const fileInput = document.getElementById('pImg');

    if(title && price && link && fileInput.files[0]) {
        // تحويل الصورة من المعرض إلى نص يمكن حفظه
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgBase64 = e.target.result;
            
            const newProduct = { 
                id: Date.now(), 
                title, 
                price, 
                link, 
                img: imgBase64 // الصورة أصبحت الآن نصاً محفوظاً
            };
            
            products.push(newProduct);
            // لاحظ: يجب نسخ مصفوفة products الجديدة ووضعها في الكود يدوياً
            // لتظهر للجميع في تيك توك كما اتفقنا سابقاً
            console.log("انسخ هذا المنتج وأضفه للمصفوفة في script.js:", newProduct);
            alert("تم تجهيز المنتج! تأكد من حفظ التغييرات في VS Code ونشرها.");
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        alert("يرجى ملء جميع الخانات واختيار صورة!");
    }
}

// وظيفة عرض المنتجات للزبون
function displayProducts() {
    const display = document.getElementById('productDisplay');
    if(!display) return;
    
    display.innerHTML = products.map(p => `
        <div class="card">
            <img src="${p.img}" alt="${p.title}">
            <div class="card-content">
                <h3>${p.title}</h3>
                <p class="price">${p.price}</p>
                <a href="${p.link}" target="_blank" class="btn-buy">عرض المنتج</a>
            </div>
        </div>
    `).join('');
}

// وظيفة البحث (للزوار)
function filterProducts() {
    let term = document.getElementById('searchInput').value.toLowerCase();
    let cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        let title = card.querySelector('h3').innerText.toLowerCase();
        card.style.display = title.includes(term) ? "block" : "none";
    });
}

// وظيفة الإدارة (للحذف)
function displayAdminProducts() {
    const display = document.getElementById('adminDisplay');
    if(!display) return;

    display.innerHTML = products.map(p => `
        <div class="card" style="border: 2px solid red;">
            <h3>${p.title}</h3>
            <button class="delete-btn" onclick="deleteProduct(${p.id})">حذف المنتج ❌</button>
        </div>
    `).join('');
}

function deleteProduct(id) {
    products = products.filter(p => p.id !== id);
    localStorage.setItem('myProducts', JSON.stringify(products));
    location.reload();
}

// تشغيل العرض للزبائن تلقائياً
displayProducts();