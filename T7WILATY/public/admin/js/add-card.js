import { supabase } from '../../js/supabase-config.js';

// دالة إضافة حقول الأسعار الديناميكية
const addPriceField = () => {
    const container = document.getElementById('prices-container');
    const div = document.createElement('div');
    div.className = 'input-row price-item';
    div.style = "display: flex; gap: 10px; margin-bottom: 12px;";
    div.innerHTML = `
        <input type="text" class="pr-label" placeholder="الفئة (مثلاً: 500 وحدة)" required style="flex: 2; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
        <input type="number" class="pr-mru" placeholder="السعر" required style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
        <button type="button" class="remove-btn" style="color: red; border: none; background: none; cursor: pointer;"><i class="fas fa-trash"></i></button>
    `;
    div.querySelector('.remove-btn').onclick = () => div.remove();
    container.appendChild(div);
};

// الدالة الأساسية لحفظ المنتج
const saveProduct = async () => {
    const saveBtn = document.getElementById('saveProductBtn');

    const priceItems = [];
    document.querySelectorAll('.price-item').forEach(item => {
        const label = item.querySelector('.pr-label').value;
        const value = item.querySelector('.pr-mru').value;
        if (label && value) {
            priceItems.push({ label, value: parseFloat(value) });
        }
    });

    const name = document.getElementById('mainProductName').value;
    const country = document.getElementById('productCountry').value;
    const image = document.getElementById('mainProductImage').value;

    if (!name || priceItems.length === 0) {
        alert("يرجى إدخال اسم المنتج وإضافة فئة سعر واحدة على الأقل.");
        return;
    }

    try {
        console.log("Saving...");
        saveBtn.disabled = true;
        saveBtn.innerHTML = "جاري الحفظ...";

        const { data, error } = await supabase
            .from('products')
            .insert([{ name, country, image, prices: priceItems }]);

        if (error) throw error;

        console.log("تم الحفظ!", data);
        window.location.href = "products-manager.html";

    } catch (error) {
        console.error("ERROR:", error);
        alert("خطأ: " + error.message);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> حفظ ونشر المنتج';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('prices-container').childElementCount === 0) {
        addPriceField();
    }
    document.getElementById('addPriceBtn').addEventListener('click', addPriceField);
    document.getElementById('saveProductBtn').addEventListener('click', saveProduct);
});