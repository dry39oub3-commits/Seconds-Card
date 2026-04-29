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
                    ${p.category ? `<span style="background:rgba(249,115,22,0.15);color:#f97316;
                        border-radius:10px;padding:2px 8px;font-size:11px;margin-right:4px;">
                        ${p.category}
                    </span>` : ''}
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
                <button onclick="event.stopPropagation(); addPriceToProduct('${p.id}')"
                    style="background:#22c55e; color:white; border:none; padding:7px 12px; border-radius:8px; cursor:pointer; margin-right:6px;">
                    <i class="fas fa-plus"></i>
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

// ✅ أضف هذه الدالة
function recalcAllUSDT() {
    allProducts.forEach(product => {
        if (!product.prices) return;
        product.prices.forEach((item, index) => {
            const rate      = parseFloat(document.getElementById(`rate-input-${product.id}-${index}`)?.value) || item.exchange_rate || 43;
            const sellPrice = parseFloat(document.getElementById(`price-input-${product.id}-${index}`)?.value) || item.value || 0;
            const usdtInput = document.getElementById(`usdt-input-${product.id}-${index}`);
            
            if (usdtInput && sellPrice > 0 && rate > 0) {
                // إذا مفيش سعر USDT محفوظ → احسبه تلقائياً
                if (!item.usdt_price || item.usdt_price === 0) {
                    usdtInput.value = (sellPrice / rate).toFixed(2);
                }
            }
        });
    });
}

// ==================== تحديث معاينة الربح فقط (دالة مشتركة) ====================
function updateProfitPreview(productId, priceIndex) {
    const cost      = parseFloat(document.getElementById(`cost-input-${productId}-${priceIndex}`)?.value)  || 0;
    const rate      = parseFloat(document.getElementById(`rate-input-${productId}-${priceIndex}`)?.value)  || 43;
    const sellPrice = parseFloat(document.getElementById(`price-input-${productId}-${priceIndex}`)?.value) || 0;
    const preview   = document.getElementById(`profit-preview-${productId}-${priceIndex}`);
    const usdtInput = document.getElementById(`usdt-input-${productId}-${priceIndex}`);

    // ✅ حساب USDT تلقائياً = سعر البيع MRU ÷ سعر الصرف
    if (usdtInput && sellPrice > 0 && rate > 0) {
        usdtInput.value = (sellPrice / rate).toFixed(2);
    }

    if (!preview) return;

    if (cost > 0 && rate > 0 && sellPrice > 0) {
        const profitMRU = sellPrice - (cost * rate);
        const profitUSD = profitMRU / rate;
        const color     = profitMRU >= 0 ? '#22c55e' : '#ef4444';
        preview.innerHTML = `
            <span style="color:${color}; font-size:11px; font-weight:700;">
                ربح: ${profitMRU.toFixed(1)} MRU (${profitUSD.toFixed(2)}$)
            </span>`;
    } else {
        preview.innerHTML = '';
    }
}

// ==================== تغيير سعر المورد / ربح/دولار / سعر الصرف ====================
// → يحسب سعر البيع ويحدّث المعاينة
window.calcAutoPrice = (productId, priceIndex) => {
    const cost   = parseFloat(document.getElementById(`cost-input-${productId}-${priceIndex}`)?.value)   || 0;
    const profit = parseFloat(document.getElementById(`profit-input-${productId}-${priceIndex}`)?.value) || 0;
    const rate   = parseFloat(document.getElementById(`rate-input-${productId}-${priceIndex}`)?.value)   || 43;
    const priceInput = document.getElementById(`price-input-${productId}-${priceIndex}`);

    if (cost > 0 && rate > 0 && priceInput) {
        priceInput.value = Math.ceil((cost * rate) + (cost * profit));
    }

    updateProfitPreview(productId, priceIndex);
};

// ==================== تغيير سعر البيع يدوياً ====================
// → ربح/دولار يبقى ثابت تماماً، فقط المعاينة تتحدث
window.calcProfitFromPrice = (productId, priceIndex) => {
    updateProfitPreview(productId, priceIndex);
};

// ==================== توليد بطاقات الفئات ====================
function generatePriceCards(product) {
    if (!product.prices || product.prices.length === 0)
        return "<p style='color:var(--text-muted); padding:10px;'>لا توجد فئات سعرية</p>";

    return product.prices.map((item, index) => {
        const suppliers = item.suppliers      || [];
        const costVal   = item.cost_usd       || '';
        const profitVal = item.profit_per_usd || '';
        const rateVal   = item.exchange_rate  || 43;

        return `
        <div class="sub-card-item">
            <!-- الصف الأول: تفعيل + اسم الفئة + حذف -->
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
                <label class="toggle-switch" style="flex-shrink:0;">
                    <input type="checkbox" ${item.active !== false ? 'checked' : ''}
                           onchange="togglePriceActive('${product.id}', ${index}, this.checked)">
                    <span class="slider"></span>
                </label>

                <strong style="font-size:15px; color:var(--text-primary); min-width:70px;">${item.label || 'فئة'}</strong>

                <button onclick="deletePriceItem('${product.id}', ${index})"
                    style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3);
                           padding:5px 10px; border-radius:7px; cursor:pointer; font-size:12px;
                           display:flex; align-items:center; gap:4px; margin-right:auto;">
                    <i class="fas fa-trash-alt"></i> حذف الفئة
                </button>
            </div>

            <!-- حقول الحساب -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px; margin-bottom:10px;">

                <!-- سعر المورد -->
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:11px; color:var(--text-muted); font-weight:600;">💲 سعر المورد ($)</label>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number" step="0.01"
                               id="cost-input-${product.id}-${index}"
                               value="${costVal}" placeholder="0.00"
                               oninput="calcAutoPrice('${product.id}', ${index})"
                               class="price-field cost-field">
                        <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">$</span>
                    </div>
                </div>

                <!-- ربح / دولار -->
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:11px; color:var(--text-muted); font-weight:600;">📈 ربح / دولار (MRU)</label>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number" step="0.5"
                               id="profit-input-${product.id}-${index}"
                               value="${profitVal}" placeholder="4"
                               oninput="calcAutoPrice('${product.id}', ${index})"
                               class="price-field profit-field">
                        <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">MRU</span>
                    </div>
                </div>

                <!-- سعر الصرف -->
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:11px; color:var(--text-muted); font-weight:600;">💱 سعر الصرف ($ → MRU)</label>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number" step="0.5"
                               id="rate-input-${product.id}-${index}"
                               value="${rateVal}" placeholder="43"
                               oninput="calcAutoPrice('${product.id}', ${index})"
                               class="price-field rate-field">
                        <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">MRU/$</span>
                    </div>
                </div>

                <!-- سعر البيع -->
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:11px; color:var(--text-muted); font-weight:600;">🏷️ سعر البيع (MRU)</label>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number"
                            id="price-input-${product.id}-${index}"
                            value="${item.value}"
                            oninput="calcProfitFromPrice('${product.id}', ${index})"
                            class="price-field sell-field">
                        <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">MRU</span>
                    </div>
                </div>

                <!-- سعر USDT - أضف هذا -->
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <label style="font-size:11px; color:var(--text-muted); font-weight:600;">💵 سعر البيع (USDT)</label>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number" step="0.01"
                            id="usdt-input-${product.id}-${index}"
                            value="${item.usdt_price || ''}" placeholder="0.00"
                            class="price-field">
                        <span style="color:var(--text-muted); font-size:11px; flex-shrink:0;">USDT</span>
                    </div>
                </div>
            </div>

            <!-- معاينة الربح -->
            <div id="profit-preview-${product.id}-${index}" style="min-height:18px; margin-bottom:8px;"></div>

            <!-- الموردون -->
            <div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px; font-weight:600;">🏪 الموردون</div>
                <div style="display:flex; flex-direction:column; gap:6px;" id="sup-container-${product.id}-${index}">
                    ${suppliers.map((s, si) => renderSupplier(product.id, index, si, s.name, s.url)).join('')}
                </div>
            </div>

            <!-- أزرار -->
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                <button class="add-sup-btn" style="padding:7px 14px; white-space:nowrap;"
                        onclick="addSupplier('${product.id}', ${index})">
                    <i class="fas fa-plus"></i> مورد
                </button>
                <button class="save-btn-sm" style="padding:8px 18px; white-space:nowrap; margin-top:0;"
                        onclick="savePriceData('${product.id}')">
                    <i class="fas fa-save"></i> حفظ الكل
                </button>
            </div>
        </div>`;
    }).join('');
}



function renderSupplier(pId, priceIdx, sIdx, name = '', url = '') {
    return `
        <div class="supplier-row">
            <input type="text" placeholder="اسم المورد" class="sup-name" value="${name}">
            <input type="url" placeholder="رابط المورد" class="sup-url" value="${url}">
            <button onclick="this.parentElement.remove()"
                style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;">
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

window.deletePriceItem = async (productId, priceIndex) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const label = product.prices[priceIndex]?.label || 'هذه الفئة';
    if (!confirm(`هل تريد حذف فئة "${label}" نهائياً؟`)) return;

    const updatedPrices = product.prices.filter((_, i) => i !== priceIndex);
    const { error } = await supabase.from('products').update({ prices: updatedPrices }).eq('id', productId);

    if (error) showToast('❌ خطأ في الحذف: ' + error.message, true);
    else { product.prices = updatedPrices; showToast('🗑️ تم حذف الفئة'); loadProducts(); }
};

window.savePriceData = async (productId) => {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const updatedPrices = product.prices.map((item, index) => {
        const container = document.getElementById(`sup-container-${productId}-${index}`);
        const newValue  = parseFloat(document.getElementById(`price-input-${productId}-${index}`)?.value) || item.value;
        const newCost   = parseFloat(document.getElementById(`cost-input-${productId}-${index}`)?.value)  || null;
        const newProfit = parseFloat(document.getElementById(`profit-input-${productId}-${index}`)?.value)|| null;
        const newRate   = parseFloat(document.getElementById(`rate-input-${productId}-${index}`)?.value)  || 43;
        const newUSDT   = parseFloat(document.getElementById(`usdt-input-${productId}-${index}`)?.value)  || null; // ← داخل الـ map

        const suppliers = container
            ? [...container.querySelectorAll('.supplier-row')].map(row => ({
                name: row.querySelector('.sup-name').value,
                url:  row.querySelector('.sup-url').value
              }))
            : item.suppliers;

        return { 
            ...item, 
            value:          newValue, 
            cost_usd:       newCost, 
            profit_per_usd: newProfit, 
            exchange_rate:  newRate, 
            usdt_price:     newUSDT, // ← إضافة
            suppliers 
        };
    });

    const { error } = await supabase.from('products').update({ prices: updatedPrices }).eq('id', productId);
    if (error) showToast('❌ خطأ في الحفظ: ' + error.message, true);
    else { product.prices = updatedPrices; showToast('✅ تم الحفظ بنجاح!'); }
};

window.toggleDetails = (id) => {
    const area  = document.getElementById(`details-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    const isHidden = area.style.display === 'none';
    area.style.display = isHidden ? 'block' : 'none';
    arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.deleteProduct = async (id) => {
    if (!confirm("هل تريد حذف هذا المنتج نهائياً؟")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) showToast('❌ خطأ في الحذف: ' + error.message, true);
    else loadProducts();
};

document.addEventListener("DOMContentLoaded", loadProducts);

window.editProduct = (product) => {
    document.getElementById('edit-product-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'edit-product-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;`;
    modal.innerHTML = `
        <div style="background:#1e293b;border-radius:16px;padding:28px;width:100%;max-width:500px;color:#e2e8f0;position:relative;">
            <button onclick="document.getElementById('edit-product-modal').remove()"
                style="position:absolute;top:14px;left:14px;background:#ef4444;color:white;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;">✕ إغلاق</button>
            <h3 style="text-align:center;color:#f97316;margin-bottom:20px;">تعديل المنتج</h3>
            <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:5px;">اسم المنتج</label>
            <input type="text" id="edit-p-name" value="${product.name || ''}"
                style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;margin-bottom:14px;box-sizing:border-box;">
            <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:5px;">الدولة / المنطقة</label>
            <input type="text" id="edit-p-country" value="${product.country || ''}"
                style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;margin-bottom:14px;box-sizing:border-box;">
            <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:5px;">التصنيف</label>
            <select id="edit-p-category"
                style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;margin-bottom:14px;box-sizing:border-box;">
                <option value="ألعاب"       ${product.category === 'ألعاب'       ? 'selected' : ''}>🎮 ألعاب</option>
                <option value="بطاقات Apple" ${product.category === 'بطاقات Apple' ? 'selected' : ''}>🍎 بطاقات Apple</option>
                <option value="ستريمينغ"    ${product.category === 'ستريمينغ'    ? 'selected' : ''}>📺 ستريمينغ</option>
                <option value="متاجر"       ${product.category === 'متاجر'       ? 'selected' : ''}>🛍️ متاجر</option>
                <option value="أخرى"        ${product.category === 'أخرى'        ? 'selected' : ''}>🏷️ أخرى</option>
            </select>
            <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:5px;">رابط الصورة</label>
            <input type="url" id="edit-p-image" value="${product.image || ''}"
                style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;margin-bottom:6px;box-sizing:border-box;">
            <img id="edit-p-preview" src="${product.image || ''}"
                style="width:60px;height:60px;object-fit:contain;border-radius:8px;background:white;padding:4px;margin-bottom:14px;${product.image ? '' : 'display:none;'}">
            <button onclick="saveProductEdit('${product.id}')"
                style="width:100%;padding:13px;background:#22c55e;color:white;border:none;border-radius:10px;font-size:15px;cursor:pointer;font-weight:bold;">
                <i class="fas fa-save"></i> حفظ التعديلات
            </button>
        </div>`;
    modal.querySelector('#edit-p-image').addEventListener('input', (e) => {
        const preview = modal.querySelector('#edit-p-preview');
        preview.src = e.target.value;
        preview.style.display = e.target.value ? 'block' : 'none';
    });
    document.body.appendChild(modal);
};

window.saveProductEdit = async (productId) => {
    const name     = document.getElementById('edit-p-name').value.trim();
    const country  = document.getElementById('edit-p-country').value.trim();
    const image    = document.getElementById('edit-p-image').value.trim();
    const category = document.getElementById('edit-p-category').value;
    if (!name) { showToast('⚠️ اسم المنتج مطلوب!', true); return; }
    const { error } = await supabase.from('products').update({ name, country, image, category }).eq('id', productId);
    if (error) showToast('❌ خطأ: ' + error.message, true);
    else { document.getElementById('edit-product-modal').remove(); showToast('✅ تم تحديث المنتج!'); loadProducts(); }
};

window.addPriceToProduct = (productId) => {
    document.getElementById('add-price-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'add-price-modal';
    modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;`;
    modal.innerHTML = `
        <div style="background:#1e293b;border-radius:16px;padding:28px;width:100%;max-width:420px;color:#e2e8f0;position:relative;">
            <button onclick="document.getElementById('add-price-modal').remove()"
                style="position:absolute;top:14px;left:14px;background:#ef4444;color:white;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;">✕ إغلاق</button>
            <h3 style="text-align:center;color:#22c55e;margin-bottom:20px;">إضافة فئة سعرية</h3>
            <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:5px;">اسم الفئة</label>
            <input type="text" id="new-price-label" placeholder="مثال: 15€"
                style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;margin-bottom:14px;box-sizing:border-box;">
            <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:5px;">السعر (MRU)</label>
            <input type="number" id="new-price-value" placeholder="0"
                style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;margin-bottom:20px;box-sizing:border-box;">
            <button onclick="saveNewPrice('${productId}')"
                style="width:100%;padding:13px;background:#22c55e;color:white;border:none;border-radius:10px;font-size:15px;cursor:pointer;font-weight:bold;">
                <i class="fas fa-plus"></i> إضافة الفئة
            </button>
        </div>`;
    document.body.appendChild(modal);
};

window.saveNewPrice = async (productId) => {
    const label = document.getElementById('new-price-label').value.trim();
    const value = parseFloat(document.getElementById('new-price-value').value);
    if (!label)               { showToast('⚠️ اسم الفئة مطلوب!', true); return; }
    if (!value || value <= 0) { showToast('⚠️ أدخل سعراً صحيحاً!', true); return; }
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    const updatedPrices = [...(product.prices || []),
        { label, value, active: true, suppliers: [], cost_usd: null, profit_per_usd: null, exchange_rate: 43 }];
    const { error } = await supabase.from('products').update({ prices: updatedPrices }).eq('id', productId);
    if (error) showToast('❌ خطأ: ' + error.message, true);
    else { document.getElementById('add-price-modal').remove(); showToast('✅ تمت إضافة الفئة!'); loadProducts(); }
};

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
        background:${isError ? '#ef4444' : '#22c55e'}; color:white;
        padding:14px 28px; border-radius:12px; font-size:15px;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
        transition:opacity 0.5s; font-weight:bold; direction:rtl;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2500);
}