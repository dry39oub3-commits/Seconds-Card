import { supabase } from '../../js/supabase-config.js';

let allProducts = [];

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
    if (!priceSelect) return;

    priceSelect.innerHTML = '<option value="">-- اختر الفئة السعرية --</option>';
    const product = allProducts.find(p => p.id === productId);
    if (product?.prices) {
        product.prices.forEach((price, index) => {
            priceSelect.innerHTML += `<option value="${index}">${price.label} - ${price.value} MRU</option>`;
        });
    }
};

// --- 3. إضافة أكواد للمخزون ---
async function addCodesToStock() {
    const productId = document.getElementById('productSelect').value;
    const priceIndex = document.getElementById('priceSelect').value;
    const codesInput = document.getElementById('codesInput').value.trim();
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

        const { error } = await supabase
            .from('products')
            .update({ prices: updatedPrices })
            .eq('id', productId);

        if (error) throw error;

        alert(`✅ تم إضافة ${newCodes.length} كود بنجاح!`);
        document.getElementById('codesInput').value = '';
        initializeStockPage();

    } catch (error) {
        console.error(error);
        alert("فشل تحديث المخزون: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'تحديث المخزون';
    }
}

// --- 4. عرض جدول المخزون ---
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    allProducts.forEach(product => {
        if (product.prices) {
            product.prices.forEach((price, index) => {
                const count = (price.codes || []).length;
                const statusClass = count > 0 ? 'stock-good' : 'stock-low';
                const lastUpdate = price.lastUpdate
                    ? new Date(price.lastUpdate).toLocaleString('ar-EG')
                    : 'غير محدد';

                tbody.innerHTML += `
                    <tr>
                        <td><b>${product.name}</b></td>
                        <td>${price.label}</td>
                        <td>
                            <span class="stock-count-badge ${statusClass}">
                                ${count} كود متوفر
                            </span>
                        </td>
                        <td>${lastUpdate}</td>
                        <td>
                            <button class="btn-remove" onclick="clearStock('${product.id}', ${index})">
                                <i class="fas fa-eraser"></i> تصفير
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
    });
}

// --- 5. تصفير المخزون ---
window.clearStock = async (productId, priceIndex) => {
    if (!confirm("هل أنت متأكد من مسح جميع الأكواد لهذه الفئة؟")) return;

    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const updatedPrices = [...product.prices];
    updatedPrices[priceIndex].codes = [];
    updatedPrices[priceIndex].lastUpdate = new Date().toISOString();

    const { error } = await supabase
        .from('products')
        .update({ prices: updatedPrices })
        .eq('id', productId);

    if (error) alert("خطأ: " + error.message);
    else initializeStockPage();
};

document.addEventListener('DOMContentLoaded', () => {
    initializeStockPage();
    const addBtn = document.getElementById('addCodesBtn');
    if (addBtn) addBtn.addEventListener('click', addCodesToStock);
});


