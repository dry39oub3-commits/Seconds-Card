import { supabase } from '../../js/supabase-config.js';

let allProducts = [];
let _modalProductId = null;
let _modalPriceIndex = null;

// --- 1. تهيئة صفحة المخزون ---
async function initializeStockPage() {
    const productSelect = document.getElementById('productSelect');
    if (!productSelect) return;

    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }

    allProducts = products || [];
    productSelect.innerHTML = '<option value="">-- اختر المنتج --</option>';
    allProducts.forEach(p => {
        productSelect.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });

    renderInventoryTable();
}

// --- 2. تحديث خيارات الأسعار ---
window.updatePriceOptions = function() {
    const productId = document.getElementById('productSelect').value;
    const priceSelect = document.getElementById('priceSelect');
    const supplierSelect = document.getElementById('supplierSelect');
    const buyButtonContainer = document.getElementById('buyButtonContainer');

    if (!priceSelect || !supplierSelect) return;

    priceSelect.innerHTML = '<option value="">-- اختر الفئة --</option>';
    supplierSelect.innerHTML = '<option value="">-- اختر المورد --</option>';
    if (buyButtonContainer) buyButtonContainer.style.display = 'none';

    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    if (product.prices && Array.isArray(product.prices)) {
        product.prices.forEach((p, index) => {
            priceSelect.innerHTML += `<option value="${index}">${p.label} — ${p.value} MRU</option>`;
        });
    }
};

// --- إظهار زر الشراء ---
window.toggleBuyButton = function() {
    const supplierSelect = document.getElementById('supplierSelect');
    const buyButtonContainer = document.getElementById('buyButtonContainer');
    if (supplierSelect.value !== "") {
        buyButtonContainer.style.display = 'block';
    } else {
        buyButtonContainer.style.display = 'none';
    }
};

// --- فتح رابط المورد ---
window.openSupplierLink = function() {
    const url = document.getElementById('supplierSelect').value;
    if (url) window.open(url, '_blank');
};

// --- 3. إضافة أكواد للمخزون ---
async function addCodesToStock() {
    const productId = document.getElementById('productSelect').value;
    const priceIndex = document.getElementById('priceSelect').value;
    const codesInput = document.getElementById('codesInput').value.trim();
    const supplierOrderId = document.getElementById('supplierOrderId')?.value.trim() || '';
    const supplierSelect = document.getElementById('supplierSelect');
    const supplierName = supplierSelect.options[supplierSelect.selectedIndex]?.text || '';
    const btn = document.getElementById('addCodesBtn');

    if (!productId || priceIndex === "" || !codesInput) {
        alert("يرجى إكمال جميع الحقول.");
        return;
    }

    const newCodes = codesInput.split('\n').map(c => c.trim()).filter(c => c !== "");

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';

        const product = allProducts.find(p => p.id === productId);
        if (!product) return;

        const updatedPrices = [...product.prices];
        if (!updatedPrices[priceIndex].codes) updatedPrices[priceIndex].codes = [];
        updatedPrices[priceIndex].codes = [...updatedPrices[priceIndex].codes, ...newCodes];
        updatedPrices[priceIndex].lastUpdate = new Date().toISOString();
        updatedPrices[priceIndex].supplierOrderId = supplierOrderId;
        updatedPrices[priceIndex].supplierName = supplierName;

        const { error } = await supabase
            .from('products')
            .update({ prices: updatedPrices })
            .eq('id', productId);

        if (error) throw error;

        alert(`✅ تم إضافة ${newCodes.length} كود بنجاح!`);
        document.getElementById('codesInput').value = '';
        document.getElementById('supplierOrderId').value = '';
        initializeStockPage();

    } catch (error) {
        console.error(error);
        alert("فشل تحديث المخزون: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> تحديث المخزون';
    }
}

// --- 4. عرض جدول المخزون ---
// --- 4. عرض جدول المخزون ---
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    allProducts.forEach(product => {
        if (product.prices) {
            product.prices.forEach((price, index) => {
                const count = (price.codes || []).length;
                
                // ✅ تخطي الفئات الفارغة
                if (count === 0) return;

                const lastUpdate = price.lastUpdate
                    ? new Date(price.lastUpdate).toLocaleString('ar-EG')
                    : 'غير محدد';

                tbody.innerHTML += `
                    <tr>
                        <td><span class="product-name">${product.name}</span></td>
                        <td><span class="price-badge">${price.label}</span></td>
                        <td>
                            ${price.supplierName && price.supplierName !== '-- اختر المورد --'
                                ? `<span class="supplier-chip"><i class="fas fa-store"></i> ${price.supplierName}</span>`
                                : '<span style="color:#475569;">—</span>'
                            }
                        </td>
                        <td>
                            ${price.supplierOrderId
                                ? `<span class="order-chip">${price.supplierOrderId}</span>`
                                : '<span style="color:#475569;">—</span>'
                            }
                        </td>
                        <td>
                            <span class="stock-badge good">
                                <i class="fas fa-check-circle"></i>
                                ${count} كود
                            </span>
                        </td>
                        <td style="font-size:12px; color:var(--text-muted);">${lastUpdate}</td>
                        <td>
                            <button class="btn-view" onclick="openCodesModal('${product.id}', ${index})">
                                <i class="fas fa-eye"></i> عرض
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
    });

    // إذا لم يكن هناك أي صفوف
    if (tbody.innerHTML === '') {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد بطاقات في المخزون حالياً</p>
                </td>
            </tr>`;
    }
}

// --- 5. فتح مودال الأكواد ---
window.openCodesModal = function(productId, priceIndex) {
    _modalProductId = productId;
    _modalPriceIndex = priceIndex;

    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const price = product.prices[priceIndex];
    const codes = price.codes || [];

    document.getElementById('modalTitle').textContent =
        `${product.name} — ${price.label} (${codes.length} كود)`;

    renderCodesList(codes);
    document.getElementById('codesModal').style.display = 'flex';
};

// --- عرض قائمة الأكواد ---
function renderCodesList(codes) {
    const container = document.getElementById('codesListContainer');
    const product = allProducts.find(p => p.id === _modalProductId);
    const orderId = product?.prices[_modalPriceIndex]?.supplierOrderId || null;

    if (codes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>لا توجد أكواد في هذه الفئة</p>
            </div>`;
        return;
    }

    container.innerHTML = codes.map((code, i) => `
        <div class="code-item">
            <div class="code-item-content">
                <span class="code-text">${code}</span>
                ${orderId
                    ? `<span class="code-order">
                           <i class="fas fa-hashtag"></i> Order ID: ${orderId}
                       </span>`
                    : ''
                }
            </div>
            <button class="btn-del-single" onclick="deleteSingleCode(${i})" title="حذف">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

// --- حذف كود واحد ---
window.deleteSingleCode = async function(codeIndex) {
    if (!confirm("هل تريد حذف هذا الكود؟")) return;

    const product = allProducts.find(p => p.id === _modalProductId);
    if (!product) return;

    const updatedPrices = [...product.prices];
    updatedPrices[_modalPriceIndex].codes.splice(codeIndex, 1);
    updatedPrices[_modalPriceIndex].lastUpdate = new Date().toISOString();

    const { error } = await supabase
        .from('products')
        .update({ prices: updatedPrices })
        .eq('id', _modalProductId);

    if (error) { alert("خطأ: " + error.message); return; }

    product.prices = updatedPrices;
    const codes = updatedPrices[_modalPriceIndex].codes;
    document.getElementById('modalTitle').textContent =
        `${product.name} — ${product.prices[_modalPriceIndex].label} (${codes.length} كود)`;
    renderCodesList(codes);
    renderInventoryTable();
};

// --- حذف جميع الأكواد ---
window.deleteAllCodes = async function() {
    if (!confirm("هل أنت متأكد من حذف جميع الأكواد؟")) return;

    const product = allProducts.find(p => p.id === _modalProductId);
    if (!product) return;

    const updatedPrices = [...product.prices];
    updatedPrices[_modalPriceIndex].codes = [];
    updatedPrices[_modalPriceIndex].lastUpdate = new Date().toISOString();

    const { error } = await supabase
        .from('products')
        .update({ prices: updatedPrices })
        .eq('id', _modalProductId);

    if (error) { alert("خطأ: " + error.message); return; }

    product.prices = updatedPrices;
    document.getElementById('modalTitle').textContent =
        `${product.name} — ${product.prices[_modalPriceIndex].label} (0 كود)`;
    renderCodesList([]);
    renderInventoryTable();
};

// --- إغلاق المودال ---
window.closeCodesModal = function() {
    document.getElementById('codesModal').style.display = 'none';
    _modalProductId = null;
    _modalPriceIndex = null;
};

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    initializeStockPage();

    const addBtn = document.getElementById('addCodesBtn');
    if (addBtn) addBtn.addEventListener('click', addCodesToStock);

    // إغلاق المودال بالضغط خارجه
    const modal = document.getElementById('codesModal');
    if (modal) modal.addEventListener('click', function(e) {
        if (e.target === this) closeCodesModal();
    });

    // استدعاء الموردين عند تغيير الفئة السعرية
    const priceSelect = document.getElementById('priceSelect');
    if (priceSelect) {
        priceSelect.addEventListener('change', function() {
            const productId = document.getElementById('productSelect').value;
            const supplierSelect = document.getElementById('supplierSelect');
            const buyButtonContainer = document.getElementById('buyButtonContainer');
            const idx = parseInt(this.value);

            supplierSelect.innerHTML = '<option value="">-- اختر المورد --</option>';
            if (buyButtonContainer) buyButtonContainer.style.display = 'none';

            if (isNaN(idx) || !productId) return;

            const product = allProducts.find(p => p.id === productId);
            if (!product) return;

            const priceObj = product.prices[idx];
            const targetSuppliers = (priceObj && Array.isArray(priceObj.suppliers) && priceObj.suppliers.length > 0)
                ? priceObj.suppliers
                : (Array.isArray(product.suppliers) ? product.suppliers : []);

            if (targetSuppliers.length > 0) {
                targetSuppliers.forEach(s => {
                    if (s.name && s.url) {
                        supplierSelect.innerHTML += `<option value="${s.url}">${s.name}</option>`;
                    }
                });
            } else {
                supplierSelect.innerHTML += `<option value="" disabled>لا يوجد موردون لهذه الفئة</option>`;
            }

            window.toggleBuyButton();
        });
    }
});

// --- الثيم ---
(function(){
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.onclick = () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            const icon = document.querySelector('#theme-toggle i');
            if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        };
    }
})();