import { supabase } from '../../js/supabase-config.js';
let allUsers = [];

// ==================== SC-ID ====================
function generateSCId(uuid) {
    const hash = uuid.replace(/-/g, '');
    let num = 0;
    for (let i = 0; i < hash.length; i++) {
        num = (num * 31 + hash.charCodeAt(i)) % 900000;
    }
    return `SC-${String(num + 100000).padStart(6, '0')}`;
}

async function initializeUsersPage() {
    const tbody = document.getElementById('users-list-body');
    if (!tbody) return;

    // ===== إضافة حاوية السكرول التلقائية للهاتف =====
    const table = tbody.closest('table');
    if (table && !table.parentElement.classList.contains('table-container')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-container';
        // نضع الـ table داخل الـ wrapper
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    }
    // ==================================================

    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("خطأ في جلب المستخدمين:", error.message);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #94a3b8; padding: 20px;">❌ خطأ في جلب البيانات</td></tr>';
        return;
    }

    allUsers = users || [];
    renderUsersTable(allUsers);
    document.getElementById('user-count').innerText = allUsers.length;
}

function renderUsersTable(usersList) {
    const tbody = document.getElementById('users-list-body');

    if (!usersList || usersList.length === 0) {
        // إضافة لون رمادي للنص ليظهر في الوضع الداكن
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #94a3b8; padding: 20px;">لا يوجد عملاء</td></tr>`;
        return;
    }

    tbody.innerHTML = usersList.map(user => {
        const scId        = generateSCId(user.id);
        const statusClass = user.is_blocked ? 'status-blocked' : 'status-active';
        const statusText  = user.is_blocked ? 'محظور' : 'نشط';
        const joinDate    = user.created_at ? new Date(user.created_at).toLocaleDateString('ar-EG') : 'غير معروف';
        const name        = user.fullName || user.full_name || 'بدون اسم';

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:35px; height:35px; border-radius:50%; background:#334155;
                                    display:flex; align-items:center; justify-content:center;
                                    color:#f97316; font-weight:bold;">
                            ${name.charAt(0).toUpperCase()}
                        </div>
                        <b>${name}</b>
                    </div>
                </td>
                <td>${user.email || '---'}</td>
                <td>${user.phone || '---'}</td>
                <td>
                    <span style="font-family:monospace; font-size:13px; color:#f97316;
                                 background:rgba(249,115,22,0.1); padding:3px 8px;
                                 border-radius:6px; border:1px solid rgba(249,115,22,0.25);">
                        ${scId}
                    </span>
                </td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${joinDate}</td>
                <td>
                    <button onclick="openEditModal('${user.id}')"
                        style="background:none; border:none; color:#f97316; cursor:pointer;">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.filterUsers = function() {
    const searchTerm   = document.getElementById('userSearch').value.toLowerCase().trim();
    const statusFilter = document.getElementById('statusFilter').value;

    const filtered = allUsers.filter(user => {
        const name  = (user.fullName || user.full_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const scId  = generateSCId(user.id).toLowerCase();

        const matchesSearch = !searchTerm ||
            name.includes(searchTerm)  ||
            email.includes(searchTerm) ||
            scId.includes(searchTerm);

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'blocked' && user.is_blocked) ||
            (statusFilter === 'active'  && !user.is_blocked);

        return matchesSearch && matchesStatus;
    });

    renderUsersTable(filtered);
};

window.openEditModal = function(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('edit-user-id').value    = user.id;
    document.getElementById('edit-name').value        = user.fullName || user.full_name || '';
    document.getElementById('edit-email').value       = user.email || '';
    document.getElementById('edit-status').value      = user.is_blocked ? 'blocked' : 'active';
    document.getElementById('edit-password').value    = '';
    document.getElementById('editModal').style.display = 'block';
};

window.closeModal = function() {
    document.getElementById('editModal').style.display = 'none';
};

window.saveUserChanges = async function() {
    const userId    = document.getElementById('edit-user-id').value;
    const newName   = document.getElementById('edit-name').value;
    const newEmail  = document.getElementById('edit-email').value;
    const newStatus = document.getElementById('edit-status').value;
    const newPass   = document.getElementById('edit-password').value.trim();

    // تحديث البيانات الأساسية في جدول users
    const { error: dbError } = await supabase
        .from('users')
        .update({
            full_name:  newName,
            email:      newEmail,
            is_blocked: newStatus === 'blocked'
        })
        .eq('id', userId);

    if (dbError) {
        alert("❌ خطأ: " + dbError.message);
        return;
    }

    // تغيير كلمة المرور عبر Edge Function
    if (newPass) {
    const SUPABASE_ANON_KEY = "sb_publishable_UKw4zfQRW6-RsX8ntT_Ssw_ZnZuhvKd";

    const res = await fetch(
        'https://btcmfdfepykwimukbiad.supabase.co/functions/v1/update-user-password',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ userId, password: newPass })
        }
    );

    const result = await res.json();

    if (result.error) {
        alert('❌ خطأ في تغيير كلمة المرور: ' + result.error);
        return;
    }

    alert("✅ تم تحديث البيانات وكلمة المرور بنجاح");
} else {
    alert("✅ تم تحديث البيانات بنجاح");
}

closeModal();
initializeUsersPage();
};

window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) closeModal();
};

document.addEventListener('DOMContentLoaded', initializeUsersPage);