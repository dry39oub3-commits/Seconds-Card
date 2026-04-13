import { supabase } from '../../js/supabase-config.js';

let allUsers = [];

async function initializeUsersPage() {
    const tbody = document.getElementById('users-list-body');
    if (!tbody) return;

    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("خطأ في جلب المستخدمين:", error.message);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">❌ خطأ في جلب البيانات</td></tr>';
        return;
    }

    allUsers = users || [];
    renderUsersTable(allUsers);
    document.getElementById('user-count').innerText = allUsers.length;
}

function renderUsersTable(usersList) {
    const tbody = document.getElementById('users-list-body');

    if (!usersList || usersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا يوجد عملاء</td></tr>';
        return;
    }

    tbody.innerHTML = usersList.map(user => {
        const statusClass = user.is_blocked ? 'status-blocked' : 'status-active';
        const statusText = user.is_blocked ? 'محظور' : 'نشط';
        const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString('ar-EG') : 'غير معروف';
        const name = user.fullName || user.full_name || 'بدون اسم';

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:35px; height:35px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:#f97316; font-weight:bold;">
                            ${name.charAt(0).toUpperCase()}
                        </div>
                        <b>${name}</b>
                    </div>
                </td>
                <td>${user.email || '---'}</td>
                <td>${user.phone || '---'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${joinDate}</td>
                <td>
                    <button onclick="openEditModal('${user.id}')" style="background:none; border:none; color:#f97316; cursor:pointer;">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.filterUsers = function() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    const filtered = allUsers.filter(user => {
        const name = (user.fullName || user.full_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const id = user.id || '';

        const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm) || id.includes(searchTerm);
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'blocked' && user.is_blocked) ||
            (statusFilter === 'active' && !user.is_blocked);

        return matchesSearch && matchesStatus;
    });

    renderUsersTable(filtered);
};

window.openEditModal = function(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-name').value = user.fullName || user.full_name || '';
    document.getElementById('edit-email').value = user.email || '';
    document.getElementById('edit-status').value = user.is_blocked ? 'blocked' : 'active';
    document.getElementById('edit-password').value = '';
    document.getElementById('editModal').style.display = 'block';
};

window.closeModal = function() {
    document.getElementById('editModal').style.display = 'none';
};

window.saveUserChanges = async function() {
    const userId = document.getElementById('edit-user-id').value;
    const newName = document.getElementById('edit-name').value;
    const newEmail = document.getElementById('edit-email').value;
    const newPassword = document.getElementById('edit-password').value;
    const newStatus = document.getElementById('edit-status').value;

    // 1. تحديث بيانات جدول users العادي
    const { error: dbError } = await supabase
        .from('users')
        .update({
            full_name: newName,   // جرب full_name بدل fullName
            email: newEmail,
            is_blocked: newStatus === 'blocked'
        })
        .eq('id', userId);

    if (dbError) {
        alert("❌ خطأ في تحديث البيانات: " + dbError.message);
        return;
    }

    alert("✅ تم تحديث بيانات العميل بنجاح");
    closeModal();
    initializeUsersPage();
};

window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) closeModal();
};

document.addEventListener('DOMContentLoaded', initializeUsersPage);