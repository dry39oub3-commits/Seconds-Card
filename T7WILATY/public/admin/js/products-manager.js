import { supabase } from '../../js/supabase-config.js';

const loadProducts = async () => {
    const container = document.getElementById('products-list-body');
    container.innerHTML = "<div class='loading'>جاري التحميل...</div>";
    
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        container.innerHTML = "";

        if (!products || products.length === 0) {
            container.innerHTML = "<div class='no-data'>لا توجد منتجات</div>";
            return;
        }

        products.forEach(p => {
            const productDiv = document.createElement('div');
            productDiv.className = 'product-row-item';
            
            // هيكل المنتج الرئيسي مع زر الحذف الأساسي
            productDiv.innerHTML = `
                <div class="product-main-info" onclick="toggleDetails('${p.id}')">
                    <div class="p-identity">
                        <img src="${p.image}" class="p-img-thumb">
                        <span class="p-name">${p.name}</span>
                    </div>
                    <div class="p-meta">
                        <span>${p.prices?.length || 0} فئات</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <button class="delete-p-btn" onclick="event.stopPropagation(); window.deleteProduct('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </div>
                </div>
                <div id="details-${p.id}" class="product-details-area" style="display:none;">
                    <div class="cards-sub-grid">
                        ${generatePriceCards(p.prices)}
                    </div>
                </div>
            `;
            container.appendChild(productDiv);
        });

    } catch (error) {
        console.error("خطأ:", error);
        container.innerHTML = "<div class='error'>خطأ في التحميل</div>";
    }
};

// دالة لتوليد بطاقات الفئات داخل المنتج
// دالة لتوليد بطاقات الفئات داخل المنتج مع خيارات الموردين
// دالة لتوليد بطاقات الفئات مع دعم الموردين المتعددين
function generatePriceCards(prices, productId) {
    if (!prices || prices.length === 0) return "<p>لا توجد فئات سعرية</p>";
    
    return prices.map((item, index) => {
        // نتحقق إذا كان هناك قائمة موردين سابقة، وإلا ننشئ قائمة فارغة
        const suppliers = item.suppliers || []; 
        
        return `
        <div class="sub-card-item" id="card-${productId}-${index}">
            <div class="card-header">
                <strong>${item.label || 'فئة جديدة'}</strong>
                <label class="switch">
                    <input type="checkbox" ${item.active ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
            
            <div class="card-body">
                <p class="price-info">${item.value} MRU | $${(item.value / 40).toFixed(2)}</p>
                
                <div id="suppliers-container-${productId}-${index}" class="suppliers-list">
                    ${suppliers.map((s, sIndex) => renderSupplierFields(productId, index, sIndex, s.name, s.url)).join('')}
                </div>

                <button class="add-new-sup-field" onclick="addNewSupplierField('${productId}', ${index})">
                    <i class="fas fa-plus-circle"></i> إضافة مورد جديد لهذه الفئة
                </button>

                <button class="save-all-btn" onclick="saveAllProductData('${productId}')">
                    <i class="fas fa-save"></i> حفظ جميع التغييرات
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// دالة مساعدة لرسم حقول المورد
function renderSupplierFields(pId, priceIdx, sIdx, name = '', url = '') {
    return `
        <div class="supplier-entry" data-index="${sIdx}">
            <div class="input-row">
                <input type="text" placeholder="اسم المورد" class="sup-name" value="${name}">
                <input type="url" placeholder="رابط المورد" class="sup-url" value="${url}">
                <button class="remove-field" onclick="this.parentElement.parentElement.remove()"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `;
}

// الوظيفة المطلوبة: إضافة خانة مورد جديدة عند الضغط
window.addNewSupplierField = (productId, priceIndex) => {
    const container = document.getElementById(`suppliers-container-${productId}-${priceIndex}`);
    const newIndex = container.children.length;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderSupplierFields(productId, priceIndex, newIndex);
    container.appendChild(tempDiv.firstElementChild);
};

window.saveAllProductData = async (productId) => {
    // منطق جمع البيانات من الـ DOM وحفظها في الحقل JSON الخاص بـ Supabase
    const productRows = document.querySelectorAll(`[id^="card-${productId}"]`);
    let updatedPrices = [];

    productRows.forEach((row, idx) => {
        const supEntries = row.querySelectorAll('.supplier-entry');
        let suppliersList = [];
        
        supEntries.forEach(entry => {
            suppliersList.push({
                name: entry.querySelector('.sup-name').value,
                url: entry.querySelector('.sup-url').value
            });
        });

        // هنا نفترض أن لديك البيانات الأساسية محفوظة في سمات مخصصة أو متغير عام
        updatedPrices.push({
            ...originalPrices[idx], // البيانات القديمة (Label, Value)
            suppliers: suppliersList // الموردين الجدد
        });
    });

    const { error } = await supabase.from('products').update({ prices: updatedPrices }).eq('id', productId);
    if (!error) alert("تم تحديث جميع الموردين بنجاح!");
};

window.toggleDetails = (id) => {
    const area = document.getElementById(`details-${id}`);
    const icon = area.previousElementSibling.querySelector('.fa-chevron-down');
    if (area.style.display === "none") {
        area.style.display = "block";
        icon.style.transform = "rotate(180deg)";
    } else {
        area.style.display = "none";
        icon.style.transform = "rotate(0deg)";
    }
};

window.deleteProduct = async (id) => {
    if (!confirm("هل تريد حذف هذا المنتج نهائياً؟")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert("خطأ في الحذف: " + error.message);
    else loadProducts();
};

document.addEventListener("DOMContentLoaded", loadProducts);