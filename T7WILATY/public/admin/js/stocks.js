import { supabase } from '../../js/supabase-config.js';

let allProducts = [];
let allStocks = [];
let _modalProductId = null;
let _modalPriceLabel = null;

// --- 1. تهيئة صفحة المخزون ---
async function initializeStockPage() {
    const productSelect = document.getElementById('productSelect');
    if (!productSelect) return;

    // جلب المنتجات
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

    // جلب المخزون من جدول stocks
    const { data: stocksData, error: stocksError } = await supabase
        .from('stocks')
        .select('*')
        .eq('is_used', false);

    if (stocksError) { console.error(stocksError); return; }

    allStocks = stocksData || [];

    populateTableFilters();
    renderInventoryTable();
}

// --- 2. تحديث خيارات الأسعار ---
window.updatePriceOptions = function () {
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
window.toggleBuyButton = function () {
    const supplierSelect = document.getElementById('supplierSelect');
    const buyButtonContainer = document.getElementById('buyButtonContainer');
    if (supplierSelect.value !== "") {
        buyButtonContainer.style.display = 'block';
    } else {
        buyButtonContainer.style.display = 'none';
    }
};

// --- فتح رابط المورد ---
window.openSupplierLink = function () {
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
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const priceObj = product.prices[parseInt(priceIndex)];

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';

        // ✅ تحقق من تكرار الأكواد في جدول stocks
        const { data: existingCodes, error: checkError } = await supabase
            .from('stocks')
            .select('code')
            .eq('product_id', productId)
            .eq('price_label', priceObj.label)
            .in('code', newCodes);

        if (checkError) throw checkError;

        if (existingCodes && existingCodes.length > 0) {
            const duplicates = existingCodes.map(c => c.code);
            alert(`⚠️ الأكواد التالية موجودة بالفعل:\n${duplicates.join('\n')}`);
            return;
        }

        // ✅ تحقق من تكرار Order ID
        if (supplierOrderId) {
            const { data: existingOrder } = await supabase
                .from('stocks')
                .select('id')
                .eq('product_id', productId)
                .eq('supplier_order_id', supplierOrderId)
                .limit(1);

            if (existingOrder && existingOrder.length > 0) {
                const confirm_ = confirm(`⚠️ Order ID "${supplierOrderId}" مستخدم بالفعل!\n\nهل تريد المتابعة على أي حال؟`);
                if (!confirm_) return;
            }
        }

        const costPerCode = newCodes.length > 0 ? costPrice / newCodes.length : costPrice;

        // ✅ بناء الصفوف للإدخال
        const rows = newCodes.map(code => ({
            product_id: productId,
            product_name: product.name,
            price_label: priceObj.label,
            price_index: parseInt(priceIndex),
            code: code,
            supplier_name: supplierName !== '-- اختر المورد --' ? supplierName : null,
            supplier_order_id: supplierOrderId || null,
            cost_price: parseFloat(costPerCode.toFixed(4)),
            is_used: false,
            created_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
            .from('stocks')
            .insert(rows);

        if (insertError) throw insertError;

        alert(`✅ تم إضافة ${newCodes.length} كود بنجاح!`);
        document.getElementById('codesInput').value = '';
        document.getElementById('supplierOrderId').value = '';
        if (document.getElementById('costPriceInput'))
            document.getElementById('costPriceInput').value = '';

        await initializeStockPage();

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

    // استخرج المنتجات الفريدة من allStocks
    const productsInStock = new Map();
    allStocks.forEach(s => {
        if (!productsInStock.has(s.product_id)) {
            productsInStock.set(s.product_id, s.product_name);
        }
    });

    productsInStock.forEach((name, id) => {
        filterProduct.innerHTML += `<option value="${id}">${name}</option>`;
    });

    if (current) filterProduct.value = current;
}

// --- تحديث فلتر الفئات عند اختيار منتج ---
window.filterInventoryTable = function () {
    const productId = document.getElementById('filterProduct').value;
    const filterPriceWrapper = document.getElementById('filterPriceWrapper');
    const filterPrice = document.getElementById('filterPrice');

    if (productId) {
        // استخرج الفئات الفريدة لهذا المنتج من allStocks
        const labelsInStock = new Map();
        allStocks.forEach(s => {
            if (s.product_id === productId) {
                if (!labelsInStock.has(s.price_label)) {
                    labelsInStock.set(s.price_label, 0);
                }
                labelsInStock.set(s.price_label, labelsInStock.get(s.price_label) + 1);
            }
        });

        filterPrice.innerHTML = '<option value="">-- كل الفئات --</option>';
        labelsInStock.forEach((count, label) => {
            filterPrice.innerHTML += `<option value="${label}">${label} (${count} كود)</option>`;
        });

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
    const filterPriceLabel = document.getElementById('filterPrice')?.value || '';

    // تجميع الأكواد حسب المنتج + الفئة
    const grouped = {};

    allStocks.forEach(stock => {
        if (filterProductId && stock.product_id !== filterProductId) return;
        if (filterPriceLabel && stock.price_label !== filterPriceLabel) return;

        const key = `${stock.product_id}_${stock.price_label}`;
        if (!grouped[key]) {
            grouped[key] = {
                product_id: stock.product_id,
                product_name: stock.product_name,
                price_label: stock.price_label,
                codes: [],
                suppliers: new Set(),
                orderIds: new Set(),
                lastUpdate: stock.created_at
            };
        }

        grouped[key].codes.push(stock);
        if (stock.supplier_name) grouped[key].suppliers.add(stock.supplier_name);
        if (stock.supplier_order_id) grouped[key].orderIds.add(stock.supplier_order_id);
        if (stock.created_at > grouped[key].lastUpdate)
            grouped[key].lastUpdate = stock.created_at;
    });

    const rows = Object.values(grouped);

    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد بطاقات تطابق الفلتر</p>
                </td>
            </tr>`;
        return;
    }

    rows.forEach(row => {
        const lastUpdate = row.lastUpdate
            ? new Date(row.lastUpdate).toLocaleString('ar-EG')
            : 'غير محدد';

        const suppliersText = row.suppliers.size > 0
            ? [...row.suppliers].map(s =>
                `<span class="supplier-chip"><i class="fas fa-store"></i> ${s}</span>`).join(' ')
            : '<span style="color:#475569;">—</span>';

        const orderIdsText = row.orderIds.size > 0
            ? [...row.orderIds].map(id =>
                `<span class="order-chip">${id}</span>`).join(' ')
            : '<span style="color:#475569;">—</span>';

        tbody.innerHTML += `
            <tr>
                <td><span class="product-name">${row.product_name}</span></td>
                <td><span class="price-badge">${row.price_label}</span></td>
                <td>${suppliersText}</td>
                <td>${orderIdsText}</td>
                <td>
                    <span class="stock-badge good">
                        <i class="fas fa-check-circle"></i>
                        ${row.codes.length} كود
                    </span>
                </td>
                <td style="font-size:12px; color:var(--text-muted);">${lastUpdate}</td>
                <td>
                    <button class="btn-view"
                        onclick="openCodesModal('${row.product_id}', '${row.price_label}')">
                        <i class="fas fa-eye"></i> عرض
                    </button>
                </td>
            </tr>
        `;
    });
}

// --- 5. فتح مودال الأكواد ---
window.openCodesModal = function (productId, priceLabel) {
    _modalProductId = productId;
    _modalPriceLabel = priceLabel;

    const codes = allStocks.filter(
        s => s.product_id === productId && s.price_label === priceLabel
    );

    const productName = codes.length > 0 ? codes[0].product_name : '';

    document.getElementById('modalTitle').textContent =
        `${productName} — ${priceLabel} (${codes.length} كود)`;

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

    container.innerHTML = codes.map((item) => {
        return `
        <div class="code-item" data-id="${item.id}">
            <div class="code-item-content">
                <span class="code-text">${item.code}</span>
                <div style="font-size:11px; color:#64748b; margin-top:4px; display:flex; gap:12px; flex-wrap:wrap;">
                    ${item.supplier_order_id ? `<span><i class="fas fa-hashtag" style="color:#3b82f6;"></i> ${item.supplier_order_id}</span>` : ''}
                    ${item.supplier_name ? `<span><i class="fas fa-store" style="color:#22c55e;"></i> ${item.supplier_name}</span>` : ''}
                    ${item.cost_price ? `<span><i class="fas fa-dollar-sign" style="color:#f97316;"></i> ${item.cost_price}$</span>` : ''}
                </div>
            </div>
            <button class="btn-del-single" onclick="deleteSingleCode('${item.id}')" title="حذف">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    }).join('');
}

// --- حذف كود واحد ---
window.deleteSingleCode = async function (stockId) {
    if (!confirm("هل تريد حذف هذا الكود؟")) return;

    const { error } = await supabase
        .from('stocks')
        .delete()
        .eq('id', stockId);

    if (error) { alert("خطأ: " + error.message); return; }

    // تحديث allStocks محلياً
    allStocks = allStocks.filter(s => s.id !== stockId);

    const codes = allStocks.filter(
        s => s.product_id === _modalProductId && s.price_label === _modalPriceLabel
    );

    const productName = codes.length > 0 ? codes[0].product_name : '';
    document.getElementById('modalTitle').textContent =
        `${productName} — ${_modalPriceLabel} (${codes.length} كود)`;

    renderCodesList(codes);
    renderInventoryTable();
};

// --- حذف جميع الأكواد ---
window.deleteAllCodes = async function () {
    if (!confirm("هل أنت متأكد من حذف جميع الأكواد؟")) return;

    const { error } = await supabase
        .from('stocks')
        .delete()
        .eq('product_id', _modalProductId)
        .eq('price_label', _modalPriceLabel);

    if (error) { alert("خطأ: " + error.message); return; }

    // تحديث allStocks محلياً
    allStocks = allStocks.filter(
        s => !(s.product_id === _modalProductId && s.price_label === _modalPriceLabel)
    );

    const productName = allProducts.find(p => p.id === _modalProductId)?.name || '';
    document.getElementById('modalTitle').textContent =
        `${productName} — ${_modalPriceLabel} (0 كود)`;

    renderCodesList([]);
    renderInventoryTable();
};

// --- إغلاق المودال ---
window.closeCodesModal = function () {
    document.getElementById('codesModal').style.display = 'none';
    _modalProductId = null;
    _modalPriceLabel = null;
};

// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    initializeStockPage();

    const addBtn = document.getElementById('addCodesBtn');
    if (addBtn) addBtn.addEventListener('click', addCodesToStock);

    const modal = document.getElementById('codesModal');
    if (modal) modal.addEventListener('click', function (e) {
        if (e.target === this) closeCodesModal();
    });

    const priceSelect = document.getElementById('priceSelect');
    if (priceSelect) {
        priceSelect.addEventListener('change', function () {
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
(function () {
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