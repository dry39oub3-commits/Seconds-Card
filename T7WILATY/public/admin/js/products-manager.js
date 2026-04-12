import { supabase } from '../../js/supabase-config.js';

let allProducts = [];

const loadProducts = async () => {
    const container = document.getElementById('products-list-body');
    container.innerHTML = "<p style='text-align:center; padding:20px;'>جاري التحميل...</p>";

    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = "<p style='color:red; text-align:center;'>خطأ في التحميل</p>";
        return;
    }

    if (!products || products.length === 0) {
        container.innerHTML = "<p style='text-align:center;'>لا توجد منتجات</p>";
        return;
    }

    allProducts = products;
    container.innerHTML = products.map(p => `
        <div class="product-row-item">
            <div class="product-main-info" onclick="toggleDetails('${p.id}')">
                <div class="p-identity">
                    <img src="${p.image || ''}" class="p-img-thumb" onerror="this.style.display='none'">
                    <span class="p-name">${p.name}</span>
                    <span style="color:#94a3b8; font-size:13px;">${p.country || ''}</span>
                </div>
                <div class="p-meta">
                    <span>${p.prices?.length || 0} فئات</span>
                    <i class="fas fa-chevron-down" id="arrow-${p.id}" style="transition:0.3s;"></i>
                </div>
                <button class="delete-p-btn" onclick="event.stopPropagation(); deleteProduct('${p.id}')">
                    <i class="fas fa-trash"></i>
                </button>
                <button onclick="event.stopPropagation(); editProduct(${JSON.stringify(p).replace(/"/g, '&quot;')})" 
                    style="background:#3b82f6; color:white; border:none; padding:7px 12px; border-radius:8px; cursor:pointer; margin-right:6px;">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div id="details-${p.id}" class="product-details-area" style="display:none;">
                <div class="cards-sub-grid">
                    ${generatePriceCards(p)}
                </div>
            </div>
        </div>
    `).join('');
};

function generatePriceCards(product) {
    if (!product.prices || product.prices.length === 0) return "<p>لا توجد فئات سعرية</p>";

    return product.prices.map((item, index) => {
        const suppliers = item.suppliers || [];
        const usdValue = item.value ? (item.value / 40).toFixed(2) : '0';

        return `
        <div class="sub-card-item" style="display:flex; align-items:center; gap:15px; padding:12px 18px; border-radius:10px; background:#0f172a; margin-bottom:10px;">
            
            <label class="toggle-switch" style="flex-shrink:0;">
                <input type="checkbox" ${item.active !== false ? 'checked' : ''} 
                       onchange="togglePriceActive('${product.id}', ${index}, this.checked)">
                <span class="slider"></span>
            </label>

            <strong style="min-width:80px;">${item.label || 'فئة'}</strong>

            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <input type="number" 
                       id="price-input-${product.id}-${index}"
                       value="${item.value}" 
                       style="width:90px; padding:5px 8px; background:#1e293b; border:1px solid #f97316; border-radius:6px; color:#f97316; font-weight:bold; text-align:center;">
                <span style="color:#94a3b8; font-size:12px;">MRU</span>
                <span class="price-usd" id="usd-${product.id}-${index}">${usdValue} $</span>
            </div>

            <div style="flex:1; display:flex; flex-direction:column; gap:6px;" id="sup-container-${product.id}-${index}">
                ${suppliers.map((s, si) => renderSupplier(product.id, index, si, s.name, s.url)).join('')}
            </div>

            <button class="add-sup-btn" style="width:auto; padding:7px 14px; white-space:nowrap;" onclick="addSupplier('${product.id}', ${index})">
                <i class="fas fa-plus"></i> مورد
            </button>

            <button class="save-btn-sm" style="width:auto; padding:8px 14px; white-space:nowrap; margin-top:0;" onclick="savePriceData('${product.id}')">
                <i class="fas fa-save"></i> حفظ
            </button>
        </div>`;
    }).join('');
}

function renderSupplier(pId, priceIdx, sIdx, name = '', url = '') {
    return `
        <div class="supplier-row">
            <input type="text" placeholder="اسم المورد" class="sup-name" value="${name}">
            <input type="url" placeholder="رابط المورد" class="sup-url" value="${url}">
            <button onclick="this.parentElement.remove()" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
}

window.addSupplier = (productId, priceIndex) => {
    const container = document.getElementById(`sup-container-${productId}-${priceIndex}`);
    const div = document.createElement('div');
    div.innerHTML = renderSupplier(productId, priceIndex, container.children.length);
    container.appendChild(div.firstElementChild);
};

window.togglePriceActive = async (productId, priceIndex, isActive) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const updatedPrices = [...product.prices];
    updatedPrices[priceIndex] = { ...updatedPrices[priceIndex], active: isActive };
    await supabase.from('products').update({ prices: updatedPrices }).eq('id', productId);
    product.prices = updatedPrices;
};

window.savePriceData = async (productId) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const updatedPrices = product.prices.map((item, index) => {
        const container = document.getElementById(`sup-container-${productId}-${index}`);
        const priceInput = document.getElementById(`price-input-${productId}-${index}`);
        
        const newValue = priceInput ? parseFloat(priceInput.value) : item.value;
        
        const suppliers = container ? [...container.querySelectorAll('.supplier-row')].map(row => ({
            name: row.querySelector('.sup-name').value,
            url: row.querySelector('.sup-url').value
        })) : item.suppliers;

        return { ...item, value: newValue, suppliers };
    });

    const { error } = await supabase
        .from('products')
        .update({ prices: updatedPrices })
        .eq('id', productId);

    if (error) alert('خطأ في الحفظ: ' + error.message);
    else {
        product.prices = updatedPrices;
        alert('✅ تم الحفظ بنجاح!');
    }
};

window.toggleDetails = (id) => {
    const area = document.getElementById(`details-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    const isHidden = area.style.display === 'none';
    area.style.display = isHidden ? 'block' : 'none';
    arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.deleteProduct = async (id) => {
    if (!confirm("هل تريد حذف هذا المنتج نهائياً؟")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert("خطأ في الحذف: " + error.message);
    else loadProducts();
};

document.addEventListener("DOMContentLoaded", loadProducts);

window.editProduct = (product) => {
    // إزالة modal قديم إن وجد
    document.getElementById('edit-product-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'edit-product-modal';
    modal.style.cssText = `
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.7); z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:20px; box-sizing:border-box;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border-radius:16px; padding:28px; width:100%; max-width:500px; color:#e2e8f0; position:relative;">
            <button onclick="document.getElementById('edit-product-modal').remove()"
                style="position:absolute; top:14px; left:14px; background:#ef4444; color:white; border:none; border-radius:8px; padding:5px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>

            <h3 style="text-align:center; color:#f97316; margin-bottom:20px;">تعديل المنتج</h3>

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">اسم المنتج</label>
            <input type="text" id="edit-p-name" value="${product.name || ''}"
                style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; margin-bottom:14px; box-sizing:border-box;">

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">الدولة / المنطقة</label>
            <input type="text" id="edit-p-country" value="${product.country || ''}"
                style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; margin-bottom:14px; box-sizing:border-box;">

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">رابط الصورة</label>
            <input type="url" id="edit-p-image" value="${product.image || ''}"
                style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; color:#e2e8f0; margin-bottom:6px; box-sizing:border-box;">
            <img id="edit-p-preview" src="${product.image || ''}" 
                style="width:60px; height:60px; object-fit:contain; border-radius:8px; background:white; padding:4px; margin-bottom:14px; ${product.image ? '' : 'display:none;'}">

            <button onclick="saveProductEdit('${product.id}')"
                style="width:100%; padding:13px; background:#22c55e; color:white; border:none; border-radius:10px; font-size:15px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-save"></i> حفظ التعديلات
            </button>
        </div>
    `;

    // معاينة الصورة عند الكتابة
    modal.querySelector('#edit-p-image').addEventListener('input', (e) => {
        const preview = modal.querySelector('#edit-p-preview');
        preview.src = e.target.value;
        preview.style.display = e.target.value ? 'block' : 'none';
    });

    document.body.appendChild(modal);
};

window.saveProductEdit = async (productId) => {
    const name    = document.getElementById('edit-p-name').value.trim();
    const country = document.getElementById('edit-p-country').value.trim();
    const image   = document.getElementById('edit-p-image').value.trim();

    if (!name) { alert('⚠️ اسم المنتج مطلوب!'); return; }

    const { error } = await supabase
        .from('products')
        .update({ name, country, image })
        .eq('id', productId);

    if (error) {
        alert('خطأ: ' + error.message);
    } else {
        document.getElementById('edit-product-modal').remove();
        alert('✅ تم تحديث المنتج!');
        loadProducts();
    }
};

(function(){
    // تطبيق الثيم المحفوظ فوراً
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    document.getElementById('theme-toggle').onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };
})();