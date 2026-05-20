import { supabase } from '../../js/supabase-config.js';

window._allUsers      = [];
window._filterMode    = 'all';
window._selectedHours = null;

// ==================== واتساب ====================
async function loadWhatsappNumber() {
    const { data, error } = await supabase
        .from('settings')
        .select('whatsapp_number')
        .eq('id', 1)
        .single();

    if (!error && data) {
        const input = document.getElementById('wa-number-input');
        if (input) input.value = data.whatsapp_number || '';
    }
}

window.saveWhatsappNumber = async () => {
    const input  = document.getElementById('wa-number-input');
    const btn    = document.getElementById('wa-save-btn');
    const number = input?.value.trim();

    if (!number) { showToast('⚠️ أدخل رقم الهاتف أولاً', 'error'); return; }
    if (!/^\d{10,15}$/.test(number)) { showToast('⚠️ الرقم غير صحيح — أرقام فقط بدون +', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const { error } = await supabase
        .from('settings')
        .update({ whatsapp_number: number })
        .eq('id', 1);

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ';

    showToast(error ? '❌ خطأ في الحفظ' : '✅ تم حفظ الرقم بنجاح', error ? 'error' : 'success');
};

// ==================== تحميل المستخدمين ====================
window.loadUsers = async () => {
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = `<tr><td colspan="7" class="empty"><span class="spinner"></span> جاري التحميل...</td></tr>`;

    const { data: users, error } = await supabase
        .from('users')
        .select('id, full_name, phone, email, created_at, is_blocked, is_active, banned_until')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty" style="color:var(--red);">❌ خطأ: ${error.message}</td></tr>`;
        return;
    }

    // ✅ رفع الحظر تلقائياً لمن انتهت مدتهم
    const now     = new Date();
    const expired = (users || []).filter(u =>
        u.is_blocked && u.banned_until && new Date(u.banned_until) < now
    );

    if (expired.length > 0) {
        const ids = expired.map(u => u.id);
        await supabase
            .from('users')
            .update({ is_blocked: false, banned_until: null })
            .in('id', ids);

        expired.forEach(u => {
            u.is_blocked   = false;
            u.banned_until = null;
        });
    }

    window._allUsers = users || [];
    updateStats(users);
    renderTable();
};

// ==================== إحصائيات ====================
function updateStats(users) {
    const active   = users.filter(u => !u.is_blocked && u.is_active).length;
    const inactive = users.filter(u => !u.is_blocked && !u.is_active).length;
    const blocked  = users.filter(u => u.is_blocked).length;

    document.getElementById('stat-total').textContent    = users.length;
    document.getElementById('stat-active').textContent   = active;
    document.getElementById('stat-inactive').textContent = inactive;
    document.getElementById('stat-blocked').textContent  = blocked;
}

// ==================== رندر الجدول ====================
window.renderTable = () => {
    const tbody  = document.getElementById('users-table');
    const search = document.getElementById('search-input').value.trim().toLowerCase();
    const filter = window._filterMode;

    let users = [...window._allUsers];

    if (search) {
        users = users.filter(u =>
            (u.phone     || '').toLowerCase().includes(search) ||
            (u.full_name || '').toLowerCase().includes(search) ||
            (u.email     || '').toLowerCase().includes(search)
        );
    }

    if (filter === 'inactive') users = users.filter(u => !u.is_blocked && !u.is_active);
    if (filter === 'active')   users = users.filter(u => !u.is_blocked &&  u.is_active);
    if (filter === 'blocked')  users = users.filter(u =>  u.is_blocked);

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty">📭 لا يوجد مستخدمون</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map((u, i) => {
        const date = u.created_at
            ? new Date(u.created_at).toLocaleString('fr-FR', {
                day:'2-digit', month:'2-digit', year:'numeric',
                hour:'2-digit', minute:'2-digit'
              })
            : '—';

        const isBlocked  = !!u.is_blocked;
        const isActive   = !isBlocked && !!u.is_active;
        const isInactive = !isBlocked && !u.is_active;

        const bannedUntilText = isBlocked
            ? (() => {
                if (!u.banned_until) {
                    return `
                        <div style="font-size:10px;color:#ef4444;margin-top:4px;
                                    background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);
                                    border-radius:6px;padding:3px 8px;display:inline-block;">
                            🚫 محظور للأبد
                        </div>`;
                }

                const until    = new Date(u.banned_until);
                const now      = new Date();
                const diffMs   = until - now;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHrs  = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHrs / 24);

                let remaining = '';
                if (diffMs <= 0)       remaining = `<span style="color:#22c55e;">انتهى الحظر</span>`;
                else if (diffDays > 0) remaining = `متبقي: ${diffDays} يوم`;
                else if (diffHrs > 0)  remaining = `متبقي: ${diffHrs} ساعة`;
                else                   remaining = `متبقي: ${diffMins} دقيقة`;

                return `
                    <div style="font-size:10px;color:#f59e0b;margin-top:4px;
                                background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);
                                border-radius:6px;padding:3px 8px;display:inline-block;">
                        <i class="fas fa-clock" style="font-size:9px;"></i>
                        حتى: ${until.toLocaleString('fr-FR',{
                            day:'2-digit', month:'2-digit', year:'numeric',
                            hour:'2-digit', minute:'2-digit'
                        })}
                        <br>
                        <span style="color:#fcd535;">${remaining}</span>
                    </div>`;
            })()
            : '';

        const statusBadge = isBlocked
            ? `<div>
                <span class="badge badge-blocked"><i class="fas fa-ban"></i> محظور</span>
                ${bannedUntilText}
               </div>`
            : isActive
            ? `<span class="badge badge-active"><i class="fas fa-check-circle"></i> مفعّل</span>`
            : `<span class="badge badge-inactive"><i class="fas fa-times-circle"></i> غير مفعّل</span>`;

        const activateBtn = isInactive
            ? `<button class="btn-sm" onclick="activateUser('${u.id}', '${u.phone || u.full_name || ''}')"
                style="background:var(--green);color:white;">
                <i class="fas fa-check"></i> تفعيل
               </button>`
            : isActive
            ? `<button class="btn-sm" onclick="deactivateUser('${u.id}')"
                style="background:var(--red);color:white;">
                <i class="fas fa-times"></i> إلغاء التفعيل
               </button>`
            : '';

        const blockBtn = !isBlocked
            ? `<button class="btn-sm" onclick="showBlockModal('${u.id}', '${(u.full_name || u.phone || '').replace(/'/g, '')}')"
                style="background:#f59e0b;color:white;">
                <i class="fas fa-ban"></i> حظر
               </button>`
            : `<button class="btn-sm" onclick="toggleBlock('${u.id}', false)"
                style="background:var(--blue);color:white;">
                <i class="fas fa-unlock"></i> رفع الحظر
               </button>`;

        return `
        <tr id="row-${u.id}">
            <td style="color:var(--muted);font-size:12px;">${i + 1}</td>
            <td><div style="font-weight:700;">${u.full_name || '—'}</div></td>
            <td>
                <div style="font-family:monospace;color:var(--yellow);direction:ltr;text-align:right;">
                    ${u.phone || '—'}
                </div>
            </td>
            <td style="font-size:12px;color:var(--muted);">${u.email || '—'}</td>
            <td><small style="color:var(--muted);">${date}</small></td>
            <td>${statusBadge}</td>
            <td>
                <div class="actions">
                    ${activateBtn}
                    ${blockBtn}
                </div>
            </td>
        </tr>`;
    }).join('');
};

// ==================== تفعيل ====================
window.activateUser = async (userId, identifier) => {
    showToast('⏳ جاري التفعيل...', 'info');

    const { error } = await supabase
        .from('users')
        .update({ is_active: true, is_blocked: false })
        .eq('id', userId);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    const user = window._allUsers.find(u => u.id === userId);
    if (user) { user.is_active = true; user.is_blocked = false; }

    showToast(`✅ تم تفعيل: ${identifier}`, 'success');
    renderTable();
    updateStats(window._allUsers);
};

// ==================== إلغاء التفعيل ====================
window.deactivateUser = async (userId) => {
    if (!confirm('هل تريد إلغاء تفعيل هذا الحساب؟')) return;

    const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', userId);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    const user = window._allUsers.find(u => u.id === userId);
    if (user) user.is_active = false;

    showToast('✅ تم إلغاء التفعيل', 'success');
    renderTable();
    updateStats(window._allUsers);
};

// ==================== تفعيل الكل ====================
window.activateAll = async () => {
    const inactive = window._allUsers.filter(u => !u.is_blocked && !u.is_active);

    if (inactive.length === 0) {
        showToast('✅ جميع الحسابات مفعّلة', 'info');
        return;
    }

    if (!confirm(`هل تريد تفعيل ${inactive.length} حساب؟`)) return;

    showToast(`⏳ جاري تفعيل ${inactive.length} حساب...`, 'info');

    const ids = inactive.map(u => u.id);
    const { error } = await supabase
        .from('users')
        .update({ is_active: true, is_blocked: false })
        .in('id', ids);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    window._allUsers.forEach(u => {
        if (ids.includes(u.id)) { u.is_active = true; u.is_blocked = false; }
    });

    showToast(`✅ تم تفعيل ${inactive.length} حساب`, 'success');
    renderTable();
    updateStats(window._allUsers);
};

// ==================== حظر / رفع حظر ====================
window.toggleBlock = async (userId, block) => {
    const { error } = await supabase
        .from('users')
        .update({ is_blocked: block, ...(block === false && { banned_until: null }) })
        .eq('id', userId);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    const user = window._allUsers.find(u => u.id === userId);
    if (user) { user.is_blocked = block; if (!block) user.banned_until = null; }

    showToast(block ? '🚫 تم الحظر' : '✅ تم رفع الحظر', block ? 'error' : 'success');
    renderTable();
    updateStats(window._allUsers);
};

// ==================== modal الحظر ====================
window.showBlockModal = (userId, name) => {
    document.getElementById('block-modal')?.remove();
    window._selectedHours = null;

    const modal = document.createElement('div');
    modal.id = 'block-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.75);
        z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;
    `;

    modal.innerHTML = `
    <div style="background:var(--ds-bg, #1e293b); border:1px solid var(--ds-border, #334155); border-radius:16px;
                padding:28px; width:100%; max-width:420px;
                font-family:'Tajawal',sans-serif; color:var(--ds-text, #e2e8f0);">
            <h3 style="text-align:center; color:#f59e0b; margin-bottom:20px;">
                <i class="fas fa-ban"></i> حظر — ${name}
            </h3>
            <label style="font-size:13px; color:#94a3b8; display:block; margin-bottom:8px;">اختر مدة الحظر</label>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
                ${[
                    { label: 'ساعة',    hours: 1    },
                    { label: '6 ساعات', hours: 6    },
                    { label: '12 ساعة', hours: 12   },
                    { label: 'يوم',     hours: 24   },
                    { label: '3 أيام',  hours: 72   },
                    { label: 'أسبوع',   hours: 168  },
                    { label: 'شهر',     hours: 720  },
                    { label: '3 أشهر',  hours: 2160 },
                    { label: 'سنة',     hours: 8760 },
                ].map(opt => `
                    <button onclick="selectDuration(${opt.hours}, this)" class="duration-btn"
                        style="padding:9px 6px; background:#0f172a; border:1px solid #334155;
                               border-radius:8px; color:#94a3b8; cursor:pointer;
                               font-family:'Tajawal',sans-serif; font-size:12px; font-weight:700;
                               transition:all 0.2s;">
                        ${opt.label}
                    </button>
                `).join('')}
            </div>
            <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center;">
                <input type="number" id="custom-hours" placeholder="عدد الساعات يدوياً"
                    min="1" oninput="updateBlockInfoCustom()"
                    style="flex:1; padding:10px; background:#0f172a; border:1px solid #334155;
                           border-radius:8px; color:#e2e8f0; font-family:'Tajawal',sans-serif;
                           font-size:13px; outline:none;">
                <span style="color:#94a3b8; font-size:13px; white-space:nowrap;">ساعة</span>
            </div>
            <div id="block-duration-info"
                style="text-align:center; font-size:12px; color:#f59e0b; margin-bottom:12px; min-height:18px;"></div>
            <button onclick="applyBlock('${userId}')"
                style="width:100%; padding:12px; background:#f59e0b; color:white; border:none;
                       border-radius:10px; font-size:15px; font-weight:800; cursor:pointer;
                       font-family:'Tajawal',sans-serif; margin-bottom:8px;">
                <i class="fas fa-ban"></i> تطبيق الحظر المؤقت
            </button>
            <button onclick="applyPermanentBlock('${userId}')"
                style="width:100%; padding:11px; background:rgba(239,68,68,0.12); color:#ef4444;
                       border:1px solid #ef4444; border-radius:10px; font-size:14px; font-weight:800;
                       cursor:pointer; font-family:'Tajawal',sans-serif; margin-bottom:8px;
                       transition:background 0.2s;"
                onmouseover="this.style.background='rgba(239,68,68,0.25)'"
                onmouseout="this.style.background='rgba(239,68,68,0.12)'">
                🚫 حظر للأبد
            </button>
            <button onclick="document.getElementById('block-modal').remove()"
                style="width:100%; padding:10px; background:transparent; color:#94a3b8;
                       border:1px solid #334155; border-radius:10px; font-size:14px;
                       cursor:pointer; font-family:'Tajawal',sans-serif;">
                إلغاء
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
};

window.selectDuration = (hours, btn) => {
    document.querySelectorAll('.duration-btn').forEach(b => {
        b.style.background  = '#0f172a';
        b.style.borderColor = '#334155';
        b.style.color       = '#94a3b8';
    });
    btn.style.background  = 'rgba(245,158,11,0.2)';
    btn.style.borderColor = '#f59e0b';
    btn.style.color       = '#f59e0b';
    window._selectedHours = hours;
    document.getElementById('custom-hours').value = '';
    updateBlockInfo(hours);
};

window.updateBlockInfoCustom = () => {
    const hours = parseInt(document.getElementById('custom-hours')?.value);
    if (hours > 0) {
        window._selectedHours = null;
        updateBlockInfo(hours);
    }
};

function updateBlockInfo(hours) {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    document.getElementById('block-duration-info').textContent =
        `ينتهي الحظر: ${until.toLocaleString('fr-FR', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit'
        })}`;
}

// ==================== تطبيق الحظر المؤقت ====================
window.applyBlock = async (userId) => {
    const customHours = parseInt(document.getElementById('custom-hours')?.value);
    const hours = customHours > 0 ? customHours : window._selectedHours;

    if (!hours || hours <= 0) { showToast('⚠️ اختر مدة الحظر أولاً', 'error'); return; }

    const bannedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
        .from('users')
        .update({ is_blocked: true, banned_until: bannedUntil })
        .eq('id', userId);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    const user = window._allUsers.find(u => u.id === userId);
    if (user) { user.is_blocked = true; user.banned_until = bannedUntil; }

    document.getElementById('block-modal')?.remove();
    showToast(`🚫 تم الحظر لمدة ${hours} ساعة`, 'error');
    renderTable();
    updateStats(window._allUsers);
};

// ==================== حظر للأبد ====================
window.applyPermanentBlock = async (userId) => {
    if (!confirm('هل تريد حظر هذا الحساب للأبد؟')) return;

    const { error } = await supabase
        .from('users')
        .update({ is_blocked: true, banned_until: null })
        .eq('id', userId);

    if (error) { showToast('❌ خطأ: ' + error.message, 'error'); return; }

    const user = window._allUsers.find(u => u.id === userId);
    if (user) { user.is_blocked = true; user.banned_until = null; }

    document.getElementById('block-modal')?.remove();
    showToast('🚫 تم الحظر للأبد', 'error');
    renderTable();
    updateStats(window._allUsers);
};

// ==================== فلتر ====================
window.setFilter = (mode, btn) => {
    window._filterMode = mode;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderTable();
};

window.filterTable = () => renderTable();

// ==================== Toast ====================
window.showToast = (msg, type = 'success') => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `show ${type}`;
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
};

// ==================== تشغيل ====================
document.addEventListener('DOMContentLoaded', () => {
    loadWhatsappNumber();
    loadUsers();
});