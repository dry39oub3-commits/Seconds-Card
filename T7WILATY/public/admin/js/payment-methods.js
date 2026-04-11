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

        if (!name) { alert('أدخل اسم البنك!'); return; }

        const { error } = await supabase
            .from('payment_methods')
            .insert({ name, logo_url, account_number, is_active: true });

        if (error) { alert('خطأ: ' + error.message); return; }

        document.getElementById('method-name').value = '';
        document.getElementById('method-logo').value = '';
        document.getElementById('method-account').value = '';
        loadMethods();
    });

    loadMethods();


    