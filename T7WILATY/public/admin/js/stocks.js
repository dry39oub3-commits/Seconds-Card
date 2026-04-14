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
    const costPrice = parseFloat(document.getElementById('costPriceInput')?.value) || 0;
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

        const existingCodes = updatedPrices[priceIndex].codes.map(c => 
            typeof c === 'string' ? c : c.code
        );

        // ✅ تحقق من تكرار الأكواد
        const duplicateCodes = newCodes.filter(c => existingCodes.includes(c));
        if (duplicateCodes.length > 0) {
            alert(`⚠️ الأكواد التالية موجودة بالفعل في المخزون:\n${duplicateCodes.join('\n')}`);
            return;
        }

        // ✅ تحقق من تكرار Order ID
        const existingOrderIds = [...new Set(
            updatedPrices[priceIndex].codes
                .map(c => typeof c === 'object' ? c.supplierOrderId : null)
                .filter(id => id)
        )];

        if (supplierOrderId && existingOrderIds.includes(supplierOrderId)) {
            const confirm_ = confirm(`⚠️ Order ID "${supplierOrderId}" مستخدم بالفعل!\n\nهل تريد المتابعة على أي حال؟`);
            if (!confirm_) return;
        }

        const costPerCode = newCodes.length > 0 ? costPrice / newCodes.length : costPrice;

        const newCodeObjects = newCodes.map(code => ({
            code: code,
            supplierOrderId: supplierOrderId,
            supplierName: supplierName,
            costPrice: parseFloat(costPerCode.toFixed(4)),
            addedAt: new Date().toISOString()
        }));

        updatedPrices[priceIndex].codes = [...updatedPrices[priceIndex].codes, ...newCodeObjects];
        updatedPrices[priceIndex].lastUpdate = new Date().toISOString();

        const { error } = await supabase
            .from('products')
            .update({ prices: updatedPrices })
            .eq('id', productId);

        if (error) throw error;

        alert(`✅ تم إضافة ${newCodes.length} كود بنجاح!`);
        document.getElementById('codesInput').value = '';
        document.getElementById('supplierOrderId').value = '';
        if (document.getElementById('costPriceInput')) document.getElementById('costPriceInput').value = '';
        initializeStockPage();

    } catch (error) {
        console.error(error);
        alert("فشل تحديث المخزون: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> تحديث المخزون';
    }
}

// --- تعبئة فلاتر الجدول ---
function populateTableFilters() {
    const filterProduct = document.getElementById('filterProduct');
    if (!filterProduct) return;

    const current = filterProduct.value;
    filterProduct.innerHTML = '<option value="">-- كل المنتجات --</option>';

    allProducts.forEach(p => {
        const hasStock = p.prices?.some(pr => (pr.codes || []).length > 0);
        if (hasStock) {
            filterProduct.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        }
    });

    if (current) filterProduct.value = current;
}

// --- تحديث فلتر الفئات عند اختيار منتج ---
window.filterInventoryTable = function() {
    const productId = document.getElementById('filterProduct').value;
    const filterPriceWrapper = document.getElementById('filterPriceWrapper');
    const filterPrice = document.getElementById('filterPrice');

    if (productId) {
        const product = allProducts.find(p => p.id === productId);
        filterPrice.innerHTML = '<option value="">-- كل الفئات --</option>';

        if (product?.prices) {
            product.prices.forEach((pr, idx) => {
                const count = (pr.codes || []).length;
                if (count > 0) {
                    filterPrice.innerHTML += `<option value="${idx}">${pr.label} (${count} كود)</option>`;
                }
            });
        }
        filterPriceWrapper.style.display = 'block';
    } else {
        filterPriceWrapper.style.display = 'none';
        filterPrice.innerHTML = '<option value="">-- كل الفئات --</option>';
    }

    renderInventoryTable();
};

// --- 4. عرض جدول المخزون ---
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterProductId = document.getElementById('filterProduct')?.value || '';
    const filterPriceIdx = document.getElementById('filterPrice')?.value;

    let hasRows = false;

    allProducts.forEach(product => {
        if (filterProductId && product.id !== filterProductId) return;

        if (product.prices) {
            product.prices.forEach((price, index) => {
                const count = (price.codes || []).length;
                if (count === 0) return;
                if (filterPriceIdx !== "" && filterPriceIdx !== undefined && parseInt(filterPriceIdx) !== index) return;

                hasRows = true;
                const lastUpdate = price.lastUpdate
                    ? new Date(price.lastUpdate).toLocaleString('ar-EG')
                    : 'غير محدد';

                // جمع الموردين الفريدين من الأكواد
                const suppliersSet = new Set(
                    (price.codes || [])
                        .map(c => typeof c === 'object' ? c.supplierName : null)
                        .filter(s => s && s !== '-- اختر المورد --')
                );
                const suppliersText = suppliersSet.size > 0
                    ? [...suppliersSet].map(s => `<span class="supplier-chip"><i class="fas fa-store"></i> ${s}</span>`).join(' ')
                    : '<span style="color:#475569;">—</span>';

                // جمع Order IDs الفريدة
                const orderIdsSet = new Set(
                    (price.codes || [])
                        .map(c => typeof c === 'object' ? c.supplierOrderId : null)
                        .filter(id => id)
                );
                const orderIdsText = orderIdsSet.size > 0
                    ? [...orderIdsSet].map(id => `<span class="order-chip">${id}</span>`).join(' ')
                    : '<span style="color:#475569;">—</span>';

                tbody.innerHTML += `
                    <tr>
                        <td><span class="product-name">${product.name}</span></td>
                        <td><span class="price-badge">${price.label}</span></td>
                        <td>${suppliersText}</td>
                        <td>${orderIdsText}</td>
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

    if (!hasRows) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد بطاقات تطابق الفلتر</p>
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

    if (codes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>لا توجد أكواد في هذه الفئة</p>
            </div>`;
        return;
    }

    container.innerHTML = codes.map((item, i) => {
        // دعم الصيغتين: string قديم أو object جديد
        const code = typeof item === 'string' ? item : item.code;
        const orderId = typeof item === 'object' ? item.supplierOrderId : null;
        const supplier = typeof item === 'object' ? item.supplierName : null;
        const cost = typeof item === 'object' ? item.costPrice : null;

        return `
        <div class="code-item">
            <div class="code-item-content">
                <span class="code-text">${code}</span>
                <div style="font-size:11px; color:#64748b; margin-top:4px; display:flex; gap:12px; flex-wrap:wrap;">
                    ${orderId ? `<span><i class="fas fa-hashtag" style="color:#3b82f6;"></i> ${orderId}</span>` : ''}
                    ${supplier && supplier !== '-- اختر المورد --' ? `<span><i class="fas fa-store" style="color:#22c55e;"></i> ${supplier}</span>` : ''}
                    ${cost ? `<span><i class="fas fa-dollar-sign" style="color:#f97316;"></i> ${cost}$</span>` : ''}
                </div>
            </div>
            <button class="btn-del-single" onclick="deleteSingleCode(${i})" title="حذف">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `}).join('');
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

    const modal = document.getElementById('codesModal');
    if (modal) modal.addEventListener('click', function(e) {
        if (e.target === this) closeCodesModal();
    });

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
            calcStockProfit();
        });
    }

    // ربط أحداث حساب الربح
    document.getElementById('costPriceInput')?.addEventListener('input', calcStockProfit);
    document.getElementById('codesInput')?.addEventListener('input', calcStockProfit);
});

// ===== حساب الربح الفوري =====
function calcStockProfit() {
    const costPrice = parseFloat(document.getElementById('costPriceInput')?.value) || 0;
    const codesInput = document.getElementById('codesInput')?.value.trim() || '';
    const priceIndex = document.getElementById('priceSelect')?.value;
    const productId = document.getElementById('productSelect')?.value;

    const profitBox = document.getElementById('stock-profit-preview');
    if (!profitBox) return;

    if (!costPrice || !codesInput || priceIndex === '' || !productId) {
        profitBox.style.display = 'none';
        return;
    }

    const codesCount = codesInput.split('\n').filter(c => c.trim() !== '').length;
    if (codesCount === 0) { profitBox.style.display = 'none'; return; }

    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const priceObj = product.prices[parseInt(priceIndex)];
    const salePriceMRU = parseFloat(priceObj?.value) || 0;

    const costPerCode = costPrice / codesCount;
    const costPerCodeMRU = costPerCode * 43;
    const profitPerCode = salePriceMRU - costPerCodeMRU;

    profitBox.style.display = 'block';
    profitBox.innerHTML = `
        <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
            <div>
                <span style="color:#94a3b8; font-size:12px;">عدد الأكواد</span>
                <div style="color:#e2e8f0; font-weight:bold;">${codesCount} كود</div>
            </div>
            <div>
                <span style="color:#94a3b8; font-size:12px;">تكلفة/كود</span>
                <div style="color:#f97316; font-weight:bold;">$${costPerCode.toFixed(3)}</div>
            </div>
            <div>
                <span style="color:#94a3b8; font-size:12px;">سعر البيع</span>
                <div style="color:#e2e8f0; font-weight:bold;">${salePriceMRU} MRU</div>
            </div>
            <div>
                <span style="color:#94a3b8; font-size:12px;">ربح/كود</span>
                <div style="color:${profitPerCode >= 0 ? '#22c55e' : '#ef4444'}; font-weight:bold; font-size:16px;">
                    ${profitPerCode.toFixed(0)} MRU
                </div>
            </div>
        </div>
    `;
}

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