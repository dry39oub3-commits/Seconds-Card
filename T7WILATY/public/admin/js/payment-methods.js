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

            <button class="delete-btn" data-id="${m.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    </div>
`).join('');

                // ربط أحداث الأزرار
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

    document.getElementById('save-btn').addEventListener('click', async () => {
        const name = document.getElementById('method-name').value.trim();
        const logo_url = document.getElementById('method-logo').value.trim();
        const account_number = document.getElementById('method-account').value.trim();

        if (!name) { showToast('⚠️ أدخل اسم البنك!'); return; }

        const { error } = await supabase
            .from('payment_methods')
            .insert({ name, logo_url, account_number, is_active: true });

        if (error) { showToast('❌ خطأ: ' + error.message); return; }

        document.getElementById('method-name').value = '';
        document.getElementById('method-logo').value = '';
        document.getElementById('method-account').value = '';
        loadMethods();
    });

    loadMethods();





window.toggleMethodVisibility = async (id, field, currentValue) => {
    const { error } = await supabase
        .from('payment_methods')
        .update({ [field]: !currentValue })
        .eq('id', id);

    if (error) {
        showToast('❌ خطأ: ' + error.message);
        return;
    }

    loadMethods();
};

function showToast(message, type = 'success') {
    document.getElementById('_toast')?.remove();
    const t = document.createElement('div');
    t.id = '_toast';
    t.textContent = message;
    t.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(-10px);
        background: ${type === 'success' ? '#22c55e' : '#ef4444'};
        color: white;
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 700;
        font-family: 'Tajawal', sans-serif;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        opacity: 0;
        transition: opacity 0.3s, transform 0.3s;
        pointer-events: none;
        white-space: nowrap;
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