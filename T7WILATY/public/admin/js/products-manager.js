import { supabase } from '../../js/supabase-config.js';

const loadProducts = async () => {
    const tbody = document.getElementById('products-list-body');
    tbody.innerHTML = "<tr><td colspan='5'>جاري التحميل...</td></tr>";
    
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = "";

        if (!products || products.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5'>لا توجد منتجات</td></tr>";
            return;
        }

        products.forEach(p => {
            const firstPrice = p.prices?.[0];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <img src="${p.image}" style="width:40px; border-radius:6px; margin-left:8px;">
                    ${p.name}
                </td>
                <td>${firstPrice?.label || '-'}</td>
                <td>${firstPrice?.value || '-'} MRU</td>
                <td>0</td>
                <td>
                    <button onclick="deleteProduct('${p.id}')">🗑️ حذف</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("خطأ:", error);
        tbody.innerHTML = "<tr><td colspan='5'>خطأ في التحميل</td></tr>";
    }
};

window.deleteProduct = async (id) => {
    if (!confirm("هل تريد حذف هذا المنتج؟")) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert("خطأ في الحذف: " + error.message);
    else loadProducts();
};

document.addEventListener("DOMContentLoaded", loadProducts);