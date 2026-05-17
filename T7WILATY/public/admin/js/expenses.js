import { supabase } from '../../js/supabase-config.js';

// ==================== ألوان الفئات ====================
const CAT_COLORS = {
    'استضافة': { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
    'دومين':   { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc' },
    'API':     { bg: 'rgba(252,213,53,0.15)',   color: '#fcd535' },
    'تسويق':   { bg: 'rgba(249,115,22,0.15)',   color: '#f97316' },
    'برمجة':   { bg: 'rgba(34,197,94,0.15)',    color: '#22c55e' },
    'أخرى':    { bg: 'rgba(148,163,184,0.15)',  color: '#94a3b8' },
};

const USD_MRU = 43;
let allExpenses = [];

// ==================== تحميل البيانات ====================
window.loadExpenses = async () => {
    const tbody = document.getElementById('expenses-table');
    tbody.innerHTML = `<tr><td colspan="7" class="empty"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</td></tr>`;

    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('paid_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty" style="color:var(--red);">❌ خطأ: ${error.message}</td></tr>`;
        return;
    }

    allExpenses = data || [];
    updateStats();
    renderTable();
};

// ==================== إحصائيات ====================
function updateStats() {
    const now   = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();

    // ✅ جلب الشهر من الفلتر إذا كان محدداً
    const monthFilter = document.getElementById('filter-month')?.value;
    let filterMonth = month;
    let filterYear  = year;
    if (monthFilter) {
        const [y, m] = monthFilter.split('-');
        filterYear   = parseInt(y);
        filterMonth  = parseInt(m) - 1;
    }

    let totalUSD = 0, totalMRU = 0, monthTotalMRU = 0;

    allExpenses.forEach(e => {
        const amt = parseFloat(e.amount) || 0;

        // إجمالي كل المصاريف
        if (e.currency === 'MRU')      totalMRU += amt;
        else if (e.currency === 'EUR') totalUSD += amt * 1.08;
        else                           totalUSD += amt;

        // ✅ مصاريف الشهر المحدد بـ MRU
        const d = new Date(e.paid_at);
        if (d.getMonth() === filterMonth && d.getFullYear() === filterYear) {
            if (e.currency === 'MRU')      monthTotalMRU += amt;
            else if (e.currency === 'EUR') monthTotalMRU += amt * 1.08 * USD_MRU;
            else                           monthTotalMRU += amt * USD_MRU;
        }
    });

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('stat-total-usd', `$${totalUSD.toFixed(2)}`);
    el('stat-total-mru', `${Math.round(totalMRU).toLocaleString()} MRU`);
    el('stat-month',     `${Math.round(monthTotalMRU).toLocaleString()} MRU`);
    el('stat-count',     allExpenses.length);

    // ✅ تحديث عنوان الكارت
    const lbl = document.querySelector('#stat-month + .lbl') ||
                document.querySelector('[id="stat-month"]')?.nextElementSibling;
    const monthName = new Date(filterYear, filterMonth).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    const lblEl = document.querySelector('.stat-card .lbl:last-of-type');
    document.querySelectorAll('.stat-card').forEach(card => {
        if (card.querySelector('#stat-month')) {
            const l = card.querySelector('.lbl');
            if (l) l.textContent = `مصاريف ${monthName}`;
        }
    });
}

// ✅ تنسيق التاريخ بـ fr-FR
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

// ==================== عرض الجدول ====================
window.renderTable = () => {
    const tbody  = document.getElementById('expenses-table');
    const search = document.getElementById('search-inp')?.value.toLowerCase() || '';
    const catF   = document.getElementById('filter-category')?.value || '';
    const curF   = document.getElementById('filter-currency')?.value || '';
    const monthF = document.getElementById('filter-month')?.value || '';

    const filtered = allExpenses.filter(e => {
        const matchSearch = !search || e.title?.toLowerCase().includes(search) || e.note?.toLowerCase().includes(search);
        const matchCat    = !catF   || e.category === catF;
        const matchCur    = !curF   || e.currency === curF;
        const matchMonth  = !monthF || e.paid_at?.startsWith(monthF);
        return matchSearch && matchCat && matchCur && matchMonth;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty">📭 لا توجد سجلات</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((e, i) => {
        const cat      = CAT_COLORS[e.category] || CAT_COLORS['أخرى'];
        const date = formatDate(e.paid_at);
        const amtColor = e.currency === 'MRU' ? '#a78bfa' : e.currency === 'EUR' ? '#fcd535' : '#ef4444';

        return `
        <tr>
            <td style="color:var(--muted);">${i + 1}</td>
            <td><strong>${e.title || '—'}</strong></td>
            <td style="color:${amtColor};font-weight:700;font-size:15px;">
                ${parseFloat(e.amount).toFixed(2)} ${e.currency}
            </td>
            <td>
                <span class="cat-badge" style="background:${cat.bg};color:${cat.color};">
                    ${e.category || '—'}
                </span>
            </td>
            <td style="color:var(--muted);font-size:12px;">${date}</td>
            <td style="color:var(--muted);font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${e.note || ''}">
                ${e.note || '—'}
            </td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button onclick="openEditModal('${e.id}')"
                        style="padding:5px 10px;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:7px;cursor:pointer;font-size:12px;font-family:'Tajawal',sans-serif;">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteExpense('${e.id}')"
                        style="padding:5px 10px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:7px;cursor:pointer;font-size:12px;font-family:'Tajawal',sans-serif;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

window.filterTable = () => {
    updateStats(); // ✅ تحديث الإحصائيات عند تغيير الفلتر
    renderTable();
};

// ==================== تبديل حقل التصنيف المخصص ====================
window.toggleCustomCategory = (select, inputId) => {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    if (select.value === 'أخرى') {
        inp.style.display = 'block';
        inp.focus();
    } else {
        inp.style.display = 'none';
        inp.value = '';
    }
};

// ==================== حفظ مصروف جديد ====================
window.saveExpense = async () => {
    const title     = document.getElementById('inp-title').value.trim();
    const amount    = document.getElementById('inp-amount').value.trim();
    const currency  = document.getElementById('inp-currency').value;
    const catSelect = document.getElementById('inp-category').value;
    const catCustom = document.getElementById('inp-custom-cat')?.value.trim() || '';
    const category  = catSelect === 'أخرى' && catCustom ? catCustom : catSelect;
    const note      = document.getElementById('inp-note').value.trim();
    const paid_at   = document.getElementById('inp-date').value;

    if (!title)                            { showToast('⚠️ اسم المصروف مطلوب!', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0){ showToast('⚠️ أدخل مبلغاً صحيحاً!', 'error'); return; }

    const { error } = await supabase.from('expenses').insert({
        title, amount: parseFloat(amount), currency, category,
        note: note || null,
        paid_at: paid_at || new Date().toISOString().split('T')[0]
    });

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    showToast('✅ تم حفظ المصروف!', 'success');
    clearForm();
    loadExpenses();
};

window.clearForm = () => {
    document.getElementById('inp-title').value    = '';
    document.getElementById('inp-amount').value   = '';
    document.getElementById('inp-currency').value = 'USD';
    document.getElementById('inp-category').value = 'استضافة';
    document.getElementById('inp-note').value     = '';
    document.getElementById('inp-date').value     = new Date().toISOString().split('T')[0];
    const customInp = document.getElementById('inp-custom-cat');
    if (customInp) { customInp.value = ''; customInp.style.display = 'none'; }
};

// ==================== تعديل ====================
window.openEditModal = (id) => {
    const e = allExpenses.find(x => x.id === id);
    if (!e) return;

    document.getElementById('edit-id').value       = e.id;
    document.getElementById('edit-title').value    = e.title || '';
    document.getElementById('edit-amount').value   = e.amount || '';
    document.getElementById('edit-currency').value = e.currency || 'USD';
    document.getElementById('edit-note').value     = e.note || '';
    document.getElementById('edit-date').value     = e.paid_at || '';

    // ✅ تحديد التصنيف — إذا كان مخصصاً
    const editCat    = document.getElementById('edit-category');
    const editCustom = document.getElementById('edit-custom-cat');
    const knownCats  = ['استضافة', 'دومين', 'API', 'تسويق', 'برمجة', 'أخرى'];

    if (knownCats.includes(e.category)) {
        editCat.value = e.category;
        if (editCustom) { editCustom.style.display = 'none'; editCustom.value = ''; }
    } else {
        editCat.value = 'أخرى';
        if (editCustom) { editCustom.style.display = 'block'; editCustom.value = e.category || ''; }
    }

    document.getElementById('edit-modal').style.display = 'flex';
};

window.closeEditModal = () => {
    document.getElementById('edit-modal').style.display = 'none';
};

window.updateExpense = async () => {
    const id        = document.getElementById('edit-id').value;
    const title     = document.getElementById('edit-title').value.trim();
    const amount    = document.getElementById('edit-amount').value.trim();
    const currency  = document.getElementById('edit-currency').value;
    const catSelect = document.getElementById('edit-category').value;
    const catCustom = document.getElementById('edit-custom-cat')?.value.trim() || '';
    const category  = catSelect === 'أخرى' && catCustom ? catCustom : catSelect;
    const note      = document.getElementById('edit-note').value.trim();
    const paid_at   = document.getElementById('edit-date').value;

    if (!title || !amount) { showToast('⚠️ يرجى تعبئة الحقول المطلوبة!', 'error'); return; }

    const { error } = await supabase.from('expenses').update({
        title, amount: parseFloat(amount), currency, category,
        note: note || null, paid_at: paid_at || null
    }).eq('id', id);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    showToast('✅ تم التحديث!', 'success');
    closeEditModal();
    loadExpenses();
};

// ==================== حذف ====================
window.deleteExpense = async (id) => {
    if (!confirm('هل تريد حذف هذا المصروف نهائياً؟')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }
    showToast('🗑️ تم الحذف', 'success');
    loadExpenses();
};

// ==================== Toast ====================
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `show ${type}`;
    setTimeout(() => t.className = '', 2800);
}

// ==================== Theme ====================
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const cur  = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const i = document.querySelector('#theme-toggle i');
        if (i) i.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    });
}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    document.getElementById('inp-date').value = new Date().toISOString().split('T')[0];
    loadExpenses();
});