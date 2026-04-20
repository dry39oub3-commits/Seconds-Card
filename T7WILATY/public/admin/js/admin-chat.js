import { supabase } from '../../js/supabase-config.js';

let selectedUserId    = null;
let selectedUserEmail = null;
let msgSubscription   = null;
let newMsgSubscription = null;
let badgeSubscription  = null;
let isWidgetOpen      = false;
let unreadCounts      = {};
const seenMsgIds = new Set();

// ✅ وقت تحميل الصفحة — فقط الرسائل بعد هذا الوقت تُحسب كجديدة
const SESSION_START = new Date().toISOString();

// ==================== بناء Widget الأدمن ====================
function buildAdminWidget() {
    if (document.getElementById('admin-chat-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'admin-chat-widget';
    widget.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 24px;
        width: 680px;
        max-width: calc(100vw - 32px);
        height: 520px;
        background: #111827;
        border: 1px solid #1e2d42;
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.7);
        display: grid;
        grid-template-columns: 240px 1fr;
        overflow: hidden;
        z-index: 99998;
        opacity: 0;
        transform: translateY(16px) scale(0.97);
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
        font-family: 'Tajawal','Segoe UI',sans-serif;
        direction: rtl;
    `;

    widget.innerHTML = `
        <!-- قائمة المحادثات -->
        <div style="background:#0d1424;border-left:1px solid #1e2d42;
                    display:flex;flex-direction:column;overflow:hidden;">
            <div style="padding:13px 14px;border-bottom:1px solid #1e2d42;
                        display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <span style="font-size:13px;font-weight:800;color:#f1f5f9;display:flex;align-items:center;gap:7px;">
                    <i class="fas fa-comments" style="color:#f97316;"></i> المحادثات
                </span>
                <button onclick="toggleAdminChat()" style="background:rgba(239,68,68,0.12);
                        color:#ef4444;border:1px solid rgba(239,68,68,0.25);border-radius:7px;
                        width:26px;height:26px;cursor:pointer;font-size:12px;
                        display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="aw-conv-list" style="flex:1;overflow-y:auto;">
                <div style="text-align:center;color:#475569;padding:30px;font-size:12px;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
            </div>
        </div>

        <!-- لوحة الدردشة -->
        <div style="display:flex;flex-direction:column;overflow:hidden;">
            <div id="aw-chat-header" style="padding:12px 16px;border-bottom:1px solid #1e2d42;
                 background:#111827;display:flex;align-items:center;gap:10px;flex-shrink:0;">
                <div style="width:34px;height:34px;border-radius:50%;background:rgba(249,115,22,0.12);
                            display:flex;align-items:center;justify-content:center;
                            color:#f97316;font-size:15px;flex-shrink:0;">
                    <i class="fas fa-user"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div id="aw-chat-with" style="font-size:13px;font-weight:700;color:#f1f5f9;
                         overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        اختر محادثة
                    </div>
                    <div id="aw-chat-status" style="font-size:10px;color:#22c55e;margin-top:1px;"></div>
                </div>
            </div>

            <div id="aw-messages" style="flex:1;overflow-y:auto;padding:14px 12px;
                 display:flex;flex-direction:column;gap:10px;background:#0a0f1a;">
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;
                            justify-content:center;color:#475569;gap:8px;font-size:13px;padding:30px;">
                    <i class="fas fa-hand-point-right" style="font-size:28px;opacity:0.2;"></i>
                    <span>اختر محادثة من القائمة</span>
                </div>
            </div>

            <form id="aw-form" style="display:flex;gap:8px;padding:10px 12px;
                  border-top:1px solid #1e2d42;background:#0d1424;flex-shrink:0;">
                <button type="submit" id="aw-send" disabled
                    style="background:#f97316;color:white;border:none;padding:9px 14px;
                           border-radius:8px;cursor:pointer;font-size:14px;flex-shrink:0;
                           display:flex;align-items:center;justify-content:center;
                           transition:opacity 0.2s;opacity:0.4;">
                    <i class="fas fa-paper-plane"></i>
                </button>
                <input id="aw-input" type="text" placeholder="اكتب ردك..." disabled
                    autocomplete="off" maxlength="500"
                    style="flex:1;background:#111827;border:1px solid #1e2d42;border-radius:8px;
                           padding:9px 12px;color:#f1f5f9;font-size:13px;font-family:inherit;
                           direction:rtl;outline:none;transition:border-color 0.2s;opacity:0.4;">
            </form>
        </div>

        <style>
            #aw-conv-list::-webkit-scrollbar,#aw-messages::-webkit-scrollbar{width:3px}
            #aw-conv-list::-webkit-scrollbar-thumb,#aw-messages::-webkit-scrollbar-thumb{
                background:#1e2d42;border-radius:3px}
            #aw-input:focus{border-color:#f97316!important;}
            #aw-send:not(:disabled):hover{opacity:0.85!important;}
        </style>
    `;

    document.body.appendChild(widget);

    widget.querySelector('#aw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedUserId) return;
        const input   = document.getElementById('aw-input');
        const sendBtn = document.getElementById('aw-send');
        const message = input.value.trim();
        if (!message) return;
        input.value           = '';
        sendBtn.disabled      = true;
        sendBtn.style.opacity = '0.4';
        await supabase.from('chats').insert({
            user_id:    selectedUserId,
            user_email: selectedUserEmail,
            message,
            sender:     'admin'
        });
        sendBtn.disabled      = false;
        sendBtn.style.opacity = '1';
        input.focus();
    });
}

// ==================== فتح / إغلاق ====================
window.toggleAdminChat = async () => {
    isWidgetOpen = !isWidgetOpen;
    buildAdminWidget();

    const widget = document.getElementById('admin-chat-widget');
    const btn    = document.getElementById('admin-chat-float-btn');

    if (isWidgetOpen) {
        widget.style.pointerEvents = 'all';
        requestAnimationFrame(() => {
            widget.style.opacity   = '1';
            widget.style.transform = 'translateY(0) scale(1)';
        });
        if (btn) btn.querySelector('i').className = 'fas fa-times';

        await loadConversations();
        subscribeToNewMessages();
    } else {
        widget.style.opacity       = '0';
        widget.style.transform     = 'translateY(16px) scale(0.97)';
        widget.style.pointerEvents = 'none';
        if (btn) btn.querySelector('i').className = 'fas fa-headset';
    }
};

// ==================== جلب العداد من DB ====================
// ✅ تحسب فقط الرسائل التي وصلت بعد بدء الجلسة الحالية (SESSION_START)
async function refreshUnreadFromDB() {
    const { data } = await supabase
        .from('chats')
        .select('user_id')
        .eq('sender', 'user')
        .eq('is_read', false)
        .gte('created_at', SESSION_START); // ← فقط رسائل هذه الجلسة

    const fresh = {};
    (data || []).forEach(m => {
        fresh[m.user_id] = (fresh[m.user_id] || 0) + 1;
    });

    if (selectedUserId) fresh[selectedUserId] = 0;

    unreadCounts = fresh;
    updateFloatBadge();
}

// ==================== تحميل قائمة المحادثات ====================
async function loadConversations() {
    const list = document.getElementById('aw-conv-list');
    if (!list) return;

    const { data, error } = await supabase
        .from('chats')
        .select('user_id, user_email, message, created_at, sender')
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px;font-size:12px;">❌ خطأ</div>';
        return;
    }

    const seen = new Set();
    const conversations = (data || []).filter(m => {
        if (seen.has(m.user_id)) return false;
        seen.add(m.user_id);
        return true;
    });

    if (!conversations.length) {
        list.innerHTML = '<div style="text-align:center;color:#475569;padding:30px;font-size:12px;">لا توجد محادثات</div>';
        return;
    }

    list.innerHTML = conversations.map(c => {
        // ✅ العداد من الذاكرة فقط
        const unread   = unreadCounts[c.user_id] || 0;
        const isActive = selectedUserId === c.user_id;
        return `
        <div class="aw-conv-item" data-uid="${c.user_id}"
             onclick="openConversation('${c.user_id}','${escAttr(c.user_email)}')"
             style="padding:12px 14px;border-bottom:1px solid #1e2d42;cursor:pointer;
                    transition:background 0.15s;display:flex;flex-direction:column;gap:3px;
                    background:${isActive ? 'rgba(249,115,22,0.08)' : 'transparent'};
                    border-right:${isActive ? '3px solid #f97316' : '3px solid transparent'};">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:12px;font-weight:700;color:#f1f5f9;
                             overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">
                    ${escHtml(c.user_email)}
                </span>
                ${unread > 0 ? `
                <span style="background:#f97316;color:white;border-radius:50%;
                             min-width:17px;height:17px;font-size:10px;font-weight:800;
                             display:flex;align-items:center;justify-content:center;
                             flex-shrink:0;padding:0 3px;">
                    ${unread}
                </span>` : ''}
            </div>
            <div style="font-size:11px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${c.sender === 'admin' ? '↩ أنت: ' : ''}${escHtml(c.message.substring(0, 40))}${c.message.length > 40 ? '...' : ''}
            </div>
            <div style="font-size:10px;color:#334155;">${formatTime(c.created_at)}</div>
        </div>`;
    }).join('');

    list.querySelectorAll('.aw-conv-item').forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (el.dataset.uid !== selectedUserId) el.style.background = '#1a2535';
        });
        el.addEventListener('mouseleave', () => {
            if (el.dataset.uid !== selectedUserId) el.style.background = 'transparent';
        });
    });
}

// ==================== فتح محادثة ====================
window.openConversation = async (userId, userEmail) => {
    selectedUserId    = userId;
    selectedUserEmail = userEmail;

    // ✅ صفّر الذاكرة فوراً
    unreadCounts[userId] = 0;
    updateFloatBadge();

    // حدّث القائمة من الذاكرة (العداد صفر الآن)
    await loadConversations();

    // علّم الرسائل كمقروءة في DB في الخلفية
    supabase
        .from('chats')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('sender', 'user')
        .eq('is_read', false)
        .then(() => {
            unreadCounts[userId] = 0;
            updateFloatBadge();
        });

    const chatWith = document.getElementById('aw-chat-with');
    const status   = document.getElementById('aw-chat-status');
    if (chatWith) chatWith.textContent = userEmail;
    if (status)   status.textContent  = '🟢 نشط';

    const input   = document.getElementById('aw-input');
    const sendBtn = document.getElementById('aw-send');
    if (input)   { input.disabled   = false; input.style.opacity   = '1'; input.focus(); }
    if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }

    document.querySelectorAll('.aw-conv-item').forEach(el => {
        const active = el.dataset.uid === userId;
        el.style.background  = active ? 'rgba(249,115,22,0.08)' : 'transparent';
        el.style.borderRight = active ? '3px solid #f97316'     : '3px solid transparent';
    });

    if (msgSubscription) {
        await supabase.removeChannel(msgSubscription);
        msgSubscription = null;
    }

    const { data } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    const box = document.getElementById('aw-messages');
    if (!box) return;
    box.innerHTML = '';

    if (!data || data.length === 0) {
        box.innerHTML = `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;
                        justify-content:center;color:#475569;gap:8px;font-size:13px;padding:30px;">
                <i class="fas fa-comment-slash" style="font-size:24px;opacity:0.2;"></i>
                <span>لا توجد رسائل</span>
            </div>`;
    } else {
        data.forEach(msg => appendMessage(msg));
        box.scrollTop = box.scrollHeight;
    }

    msgSubscription = supabase
        .channel('aw-msg-' + userId + '-' + Date.now())
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats'
        }, async (payload) => {
            if (payload.new.user_id !== userId) return;

            const empty = box.querySelector('div[style*="flex-direction:column"]');
            if (empty) empty.remove();
            appendMessage(payload.new);
            box.scrollTop = box.scrollHeight;

            if (payload.new.sender === 'user') {
                supabase
                    .from('chats')
                    .update({ is_read: true })
                    .eq('id', payload.new.id)
                    .then(() => {});
            }
        })
        .subscribe((status) => {
            console.log('[AdminChat] msg subscription:', status);
        });
};

// ==================== إضافة رسالة ====================
function appendMessage(msg) {
    const box = document.getElementById('aw-messages');
    if (!box) return;

    const isAdmin = msg.sender === 'admin';
    const isScreenshot = msg.message?.startsWith('[screenshot]');
    const imgUrl = isScreenshot ? msg.message.replace('[screenshot]', '') : null;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
        max-width: 75%;
        padding: 9px 13px;
        border-radius: ${isAdmin ? '14px 14px 14px 4px' : '14px 14px 4px 14px'};
        font-size: 13px;
        line-height: 1.6;
        word-break: break-word;
        display: flex;
        flex-direction: column;
        gap: 3px;
        align-self: ${isAdmin ? 'flex-start' : 'flex-end'};
        background: ${isAdmin ? '#f97316' : '#1a2535'};
        color: ${isAdmin ? 'white' : '#f1f5f9'};
        border: ${isAdmin ? 'none' : '1px solid #1e2d42'};
    `;
    bubble.innerHTML = `
        ${!isAdmin ? `<span style="font-size:10px;font-weight:700;opacity:0.6;margin-bottom:1px;">
            👤 ${escHtml(msg.user_email || 'عميل')}
        </span>` : ''}
        ${isScreenshot
            ? `<img src="${imgUrl}" style="max-width:220px;border-radius:8px;cursor:pointer;"
                    onclick="window.open('${imgUrl}','_blank')">`
            : `<span>${escHtml(msg.message)}</span>`
        }
        <span style="font-size:10px;opacity:0.55;align-self:flex-end;">${formatTime(msg.created_at)}</span>
    `;
    box.appendChild(bubble);
}

// ==================== مراقبة رسائل جديدة من أي مستخدم ====================
function subscribeToNewMessages() {
    if (newMsgSubscription) {
        supabase.removeChannel(newMsgSubscription);
        newMsgSubscription = null;
    }

    newMsgSubscription = supabase
        .channel('aw-all-new-' + Date.now())
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats'
        }, (payload) => {
            if (payload.new.sender !== 'user') return;
            if (seenMsgIds.has(payload.new.id)) return;
            seenMsgIds.add(payload.new.id);

            if (payload.new.user_id === selectedUserId) return;

            unreadCounts[payload.new.user_id] = (unreadCounts[payload.new.user_id] || 0) + 1;
            updateFloatBadge();
            loadConversations();
        })
        .subscribe((status) => {
            console.log('[AdminChat] all-new subscription:', status);
        });
}

// ==================== Badge الزر العائم ====================
function updateFloatBadge() {
    const badge = document.getElementById('admin-chat-badge');
    if (!badge) return;
    const total = Object.values(unreadCounts).reduce((s, n) => s + n, 0);
    if (total > 0) {
        badge.textContent   = total;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// ==================== مساعدات ====================
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

// ==================== تهيئة عند تحميل الصفحة ====================
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('admin-chat-float-btn');
    if (btn) {
        btn.removeAttribute('onclick');
        btn.addEventListener('click', () => toggleAdminChat());
    }

    if (badgeSubscription) {
        supabase.removeChannel(badgeSubscription);
        badgeSubscription = null;
    }

    // ✅ عند تحميل الصفحة: العداد = صفر (لا شيء قديم يُحسب)
    unreadCounts = {};
    updateFloatBadge();

    badgeSubscription = supabase
        .channel('aw-badge-' + Date.now())
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats'
        }, (payload) => {
            if (payload.new.sender !== 'user') return;
            if (seenMsgIds.has(payload.new.id)) return;
            seenMsgIds.add(payload.new.id);

            if (payload.new.user_id === selectedUserId) return;

            unreadCounts[payload.new.user_id] = (unreadCounts[payload.new.user_id] || 0) + 1;
            updateFloatBadge();
        })
        .subscribe((status) => {
            console.log('[AdminChat] badge subscription:', status);
        });
});


// ==================== فاصل التاريخ ====================
function formatDateLabel(dateStr) {
    const d     = new Date(dateStr);
    const today = new Date();
    const yest  = new Date(); yest.setDate(today.getDate() - 1);

    const sameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth()    === b.getMonth()    &&
        a.getDate()     === b.getDate();

    if (sameDay(d, today)) return 'اليوم';
    if (sameDay(d, yest))  return 'أمس';

    return d.toLocaleDateString('ar', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}