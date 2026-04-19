import { supabase } from './supabase-config.js';

let currentUser = null;
let subscription = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    currentUser = user;

    await loadMessages();
    subscribeToMessages();

    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input  = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const message = input.value.trim();
        if (!message) return;

        input.value = '';
        sendBtn.disabled = true;

        const { error } = await supabase.from('chats').insert({
            user_id:    currentUser.id,
            user_email: currentUser.email,
            message,
            sender:     'user'
        });

        sendBtn.disabled = false;
        if (error) console.error('Send error:', error.message);
    });
});

async function loadMessages() {
    const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

    const box = document.getElementById('chat-messages');

    if (error) {
        box.innerHTML = '<div class="loading-chat">❌ خطأ في تحميل الرسائل</div>';
        return;
    }

    if (!data || data.length === 0) {
        box.innerHTML = `
            <div class="empty-chat">
                <i class="fas fa-comments"></i>
                <span>لا توجد رسائل بعد، ابدأ المحادثة!</span>
            </div>`;
        return;
    }

    box.innerHTML = '';
    data.forEach(msg => appendMessage(msg));
    box.scrollTop = box.scrollHeight;
}

function subscribeToMessages() {
    subscription = supabase
        .channel('chat-' + currentUser.id)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats',
            filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
            const box = document.getElementById('chat-messages');
            const emptyDiv = box.querySelector('.empty-chat');
            if (emptyDiv) emptyDiv.remove();
            appendMessage(payload.new);
            box.scrollTop = box.scrollHeight;
        })
        .subscribe();
}

function appendMessage(msg) {
    const box = document.createElement('div');
    box.className = `chat-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-admin'}`;
    box.innerHTML = `
        ${msg.sender === 'admin' ? '<span class="bubble-label">🎧 الدعم الفني</span>' : ''}
        <span>${escHtml(msg.message)}</span>
        <small>${formatTime(msg.created_at)}</small>
    `;
    document.getElementById('chat-messages').appendChild(box);
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