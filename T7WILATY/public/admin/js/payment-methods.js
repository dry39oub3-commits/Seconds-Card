import { supabase } from '../js/supabase-config.js';

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
                                onclick="toggleMethod('${m.id}', ${m.is_active})">
                            ${m.is_active ? '✅ مفعّل' : '⏸ معطّل'}
                        </button>
                        <button class="delete-btn" onclick="deleteMethod('${m.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        window.addMethod = async function() {
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
        };

        window.toggleMethod = async function(id, currentStatus) {
            await supabase
                .from('payment_methods')
                .update({ is_active: !currentStatus })
                .eq('id', id);
            loadMethods();
        };

        window.deleteMethod = async function(id) {
            if (!confirm('هل تريد حذف هذه الطريقة؟')) return;
            await supabase.from('payment_methods').delete().eq('id', id);
            loadMethods();
        };

        loadMethods();