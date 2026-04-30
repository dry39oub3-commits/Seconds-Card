import { supabase } from '../../js/supabase-config.js';

async function loadMethods() {
    const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('created_at', { ascending: false });

    const list = document.getElementById('methods-list');
    if (error || !data || data.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#94a3b8;">لا توجد طرق دفع مضافة.</p>';
        return;
    }

    list.innerHTML = data.map(m => `
        <div class="method-card">
            <img src="${m.logo_url || 'https://via.placeholder.com/55'}"
                onerror="this.src='https://via.placeholder.com/55'" alt="${m.name}">
            <div class="method-info">
                <h3>${m.name}</h3>
                <p><i class="fas fa-hashtag"></i> ${m.account_number || 'لا يوجد رقم حساب'}</p>
            </div>
            <div class="method-actions">
                <button class="toggle-btn ${m.is_active ? 'active' : 'inactive'}"
                        data-id="${m.id}" data-active="${m.is_active}">
                    ${m.is_active ? '✅ مفعّل' : '⏸ معطّل'}
                </button>
                <button onclick="toggleMethodVisibility('${m.id}', 'show_in_checkout', ${m.show_in_checkout})"
                    style="background:${m.show_in_checkout ? 'rgba(249,115,22,0.15)' : 'rgba(100,116,139,0.15)'};
                           color:${m.show_in_checkout ? '#f97316' : '#64748b'};
                           border:1px solid ${m.show_in_checkout ? '#f97316' : '#475569'};
                           padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px;">
                    🛒 ${m.show_in_checkout ? 'ظاهر في الدفع' : 'مخفي في الدفع'}
                </button>
                <button onclick="toggleMethodVisibility('${m.id}', 'show_in_wallet', ${m.show_in_wallet})"
                    style="background:${m.show_in_wallet ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)'};
                           color:${m.show_in_wallet ? '#22c55e' : '#64748b'};
                           border:1px solid ${m.show_in_wallet ? '#22c55e' : '#475569'};
                           padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px;">
                    👛 ${m.show_in_wallet ? 'ظاهر في المحفظة' : 'مخفي في المحفظة'}
                </button>
                <button onclick="openEditModal('${m.id}', '${m.name}', '${m.logo_url || ''}', '${m.account_number || ''}')"
                    style="background:rgba(59,130,246,0.15); color:#3b82f6;
                           border:1px solid #3b82f6; padding:4px 10px;
                           border-radius:6px; cursor:pointer; font-size:12px;">
                    ✏️ تعديل
                </button>
                <button class="delete-btn" data-id="${m.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            const current = btn.dataset.active === 'true';
            await supabase.from('payment_methods').update({ is_active: !current }).eq('id', id);
            loadMethods();
        };
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('هل تريد حذف هذه الطريقة؟')) return;
            await supabase.from('payment_methods').delete().eq('id', btn.dataset.id);
            loadMethods();
        };
    });
}

// ===== modal التعديل =====
window.openEditModal = (id, name, logo_url, account_number) => {
    document.getElementById('edit-method-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'edit-method-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.7);
        z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;
    `;

    modal.innerHTML = `
        <div style="background:#1e293b; border-radius:16px; padding:28px;
                    width:100%; max-width:460px; color:#e2e8f0; position:relative;">
            <button onclick="document.getElementById('edit-method-modal').remove()"
                style="position:absolute; top:14px; left:14px; background:#ef4444;
                       color:white; border:none; border-radius:8px; padding:5px 12px; cursor:pointer;">
                ✕ إغلاق
            </button>
            <h3 style="text-align:center; color:#f97316; margin-bottom:20px;">✏️ تعديل طريقة الدفع</h3>

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">اسم البنك</label>
            <input type="text" id="edit-method-name" value="${name}"
                style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155;
                       border-radius:8px; color:#e2e8f0; margin-bottom:14px; box-sizing:border-box;">

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">رابط الشعار</label>
            <input type="url" id="edit-method-logo" value="${logo_url}"
                style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155;
                       border-radius:8px; color:#e2e8f0; margin-bottom:6px; box-sizing:border-box;">
            <img id="edit-logo-preview" src="${logo_url}"
                style="width:50px; height:50px; object-fit:contain; background:white;
                       border-radius:8px; padding:4px; margin-bottom:14px;
                       ${logo_url ? '' : 'display:none;'}">

            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:5px;">رقم الحساب</label>
            <input type="text" id="edit-method-account" value="${account_number}"
                style="width:100%; padding:10px; background:#0f172a; border:1px solid #334155;
                       border-radius:8px; color:#e2e8f0; margin-bottom:20px; box-sizing:border-box;">

            <button onclick="saveMethodEdit('${id}')"
                style="width:100%; padding:13px; background:#22c55e; color:white;
                       border:none; border-radius:10px; font-size:15px; cursor:pointer; font-weight:bold;">
                <i class="fas fa-save"></i> حفظ التعديلات
            </button>
        </div>
    `;

    // معاينة الشعار عند التغيير
    modal.querySelector('#edit-method-logo').addEventListener('input', (e) => {
        const preview = modal.querySelector('#edit-logo-preview');
        preview.src = e.target.value;
        preview.style.display = e.target.value ? 'block' : 'none';
    });

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

window.saveMethodEdit = async (id) => {
    const name           = document.getElementById('edit-method-name').value.trim();
    const logo_url       = document.getElementById('edit-method-logo').value.trim();
    const account_number = document.getElementById('edit-method-account').value.trim();

    if (!name) { showToast('⚠️ اسم البنك مطلوب!', 'error'); return; }

    const { error } = await supabase
        .from('payment_methods')
        .update({ name, logo_url, account_number })
        .eq('id', id);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    document.getElementById('edit-method-modal').remove();
    showToast('✅ تم تحديث طريقة الدفع!');
    loadMethods();
};

document.getElementById('save-btn').addEventListener('click', async () => {
    const name           = document.getElementById('method-name').value.trim();
    const logo_url       = document.getElementById('method-logo').value.trim();
    const account_number = document.getElementById('method-account').value.trim();

    if (!name) { showToast('⚠️ أدخل اسم البنك!', 'error'); return; }

    const { error } = await supabase
        .from('payment_methods')
        .insert({ name, logo_url, account_number, is_active: true });

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    document.getElementById('method-name').value = '';
    document.getElementById('method-logo').value = '';
    document.getElementById('method-account').value = '';
    showToast('✅ تمت الإضافة بنجاح!');
    loadMethods();
});

window.toggleMethodVisibility = async (id, field, currentValue) => {
    const { error } = await supabase
        .from('payment_methods')
        .update({ [field]: !currentValue })
        .eq('id', id);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }
    loadMethods();
};

function showToast(message, type = 'success') {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.textContent = message;
    t.style.cssText = `
        position:fixed; top:24px; left:50%;
        transform:translateX(-50%) translateY(-10px);
        background:${type === 'success' ? '#22c55e' : '#ef4444'};
        color:white; padding:12px 24px; border-radius:10px;
        font-size:14px; font-weight:700; font-family:'Tajawal',sans-serif;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.3);
        opacity:0; transition:opacity 0.3s,transform 0.3s;
        pointer-events:none; white-space:nowrap;
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
        t.style.opacity = '1';
        t.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => t.remove(), 300);
    }, 2800);
}

loadMethods();