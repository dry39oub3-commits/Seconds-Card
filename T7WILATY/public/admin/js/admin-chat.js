import { supabase } from '../../js/supabase-config.js';

let selectedUserId    = null;
let selectedUserEmail = null;
let msgSubscription   = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadConversations();
    subscribeToNewMessages();

    document.getElementById('admin-chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedUserId) return;

        const input   = document.getElementById('admin-chat-input');
        const sendBtn = document.getElementById('admin-send-btn');
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        sendBtn.disabled = true;

        const { error } = await supabase.from('chats').insert({
            user_id:    selectedUserId,
            user_email: selectedUserEmail,
            message,
            sender:     'admin'
        });

        sendBtn.disabled = false;
        if (error) console.error('Admin send error:', error.message);
    });
});

async function loadConversations() {
    const { data, error } = await supabase
        .from('chats')
        .select('user_id, user_email, message, created_at, sender')
        .order('created_at', { ascending: false });

    if (error) {
        document.getElementById('conversations-list').innerHTML =
            '<div class="no-conversations">❌ خطأ في تحميل المحادثات</div>';
        return;
    }

    // استخرج المحادثات الفريدة (آخر رسالة لكل مستخدم)
    const seen = new Set();
    const conversations = (data || []).filter(m => {
        if (seen.has(m.user_id)) return false;
        seen.add(m.user_id);
        return true;
    });

    const list = document.getElementById('conversations-list');

    if (!conversations.length) {
        list.innerHTML = '<div class="no-conversations">لا توجد محادثات بعد</div>';
        return;
    }

    list.innerHTML = conversations.map(c => `
        <div class="conv-item ${selectedUserId === c.user_id ? 'active' : ''}"
             onclick="openConversation('${c.user_id}', '${escAttr(c.user_email)}')">
            <div class="conv-email">${escHtml(c.user_email)}</div>
            <div class="conv-preview">${escHtml(c.message.substring(0, 45))}${c.message.length > 45 ? '...' : ''}</div>
            <div class="conv-time">${formatTime(c.created_at)}</div>
        </div>
    `).join('');
}

window.openConversation = async (userId, userEmail) => {
    selectedUserId    = userId;
    selectedUserEmail = userEmail;

    // تحديث UI
    document.getElementById('chat-with').textContent    = userEmail;
    document.getElementById('chat-status').textContent  = '🟢 نشط';
    document.getElementById('admin-chat-input').disabled  = false;
    document.getElementById('admin-send-btn').disabled    = false;

    // تحديث التمييز في قائمة المحادثات
    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
    event?.currentTarget?.classList.add('active');

    // إلغاء الاشتراك القديم
    if (msgSubscription) supabase.removeChannel(msgSubscription);

    // تحميل الرسائل
    const { data } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    const box = document.getElementById('admin-chat-messages');
    box.innerHTML = '';

    if (!data || data.length === 0) {
        box.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><span>لا توجد رسائل</span></div>';
    } else {
        data.forEach(msg => appendMessage(msg));
        box.scrollTop = box.scrollHeight;
    }

    // اشتراك للرسائل الجديدة في هذه المحادثة
    msgSubscription = supabase
        .channel('admin-chat-' + userId)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const emptyDiv = box.querySelector('.empty-state');
            if (emptyDiv) emptyDiv.remove();
            appendMessage(payload.new);
            box.scrollTop = box.scrollHeight;
        })
        .subscribe();
};

function appendMessage(msg) {
    const box = document.getElementById('admin-chat-messages');
    const div = document.createElement('div');
    const isAdmin = msg.sender === 'admin';
    div.className = `chat-bubble ${isAdmin ? 'bubble-admin-sent' : 'bubble-client'}`;
    div.innerHTML = `
        ${!isAdmin ? `<span class="bubble-label">👤 ${escHtml(msg.user_email || 'عميل')}</span>` : ''}
        <span>${escHtml(msg.message)}</span>
        <small>${formatTime(msg.created_at)}</small>
    `;
    box.appendChild(div);
}

function subscribeToNewMessages() {
    supabase.channel('admin-all-new-msgs')
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats',
            filter: `sender=eq.user`
        }, () => {
            loadConversations();
        })
        .subscribe();
}

function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escAttr(str) {
    return String(str).replace(/'/g, "\\'");
}