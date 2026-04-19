import { supabase } from './supabase-config.js';

let currentUser      = null;
let subscription     = null;
let badgeSubscription = null;
let isOpen           = false;
let unreadCount      = 0;

// ==================== بناء نافذة الدردشة ====================
function buildChatWidget() {
    if (document.getElementById('chat-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'chat-widget';
    widget.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 24px;
        width: 360px;
        max-height: 520px;
        background: #111827;
        border: 1px solid #1e2d42;
        border-radius: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 99998;
        opacity: 0;
        transform: translateY(16px) scale(0.97);
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none;
        font-family: 'Tajawal','Segoe UI',sans-serif;
    `;

    widget.innerHTML = `
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;
                    background:#0d1424;border-bottom:1px solid #1e2d42;flex-shrink:0;">
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(249,115,22,0.15);
                        display:flex;align-items:center;justify-content:center;
                        color:#f97316;font-size:16px;flex-shrink:0;">
                <i class="fas fa-headset"></i>
            </div>
            <div style="flex:1;">
                <div style="font-weight:800;font-size:14px;color:#f1f5f9;">
                    الدعم الفني
                    <span style="display:inline-block;width:7px;height:7px;background:#22c55e;
                                 border-radius:50%;margin-right:5px;vertical-align:middle;
                                 animation:chatPulse 2s infinite;"></span>
                </div>
                <div style="font-size:11px;color:#475569;">تواصل مع فريق الدعم مباشرةً</div>
            </div>
            <button onclick="toggleChatWidget()" style="background:rgba(239,68,68,0.12);
                    color:#ef4444;border:1px solid rgba(239,68,68,0.25);border-radius:8px;
                    width:30px;height:30px;cursor:pointer;font-size:13px;
                    display:flex;align-items:center;justify-content:center;">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <!-- Messages -->
        <div id="cw-messages" style="flex:1;overflow-y:auto;padding:14px 12px;
             display:flex;flex-direction:column;gap:10px;min-height:320px;max-height:320px;">
            <div id="cw-loading" style="text-align:center;color:#475569;padding:30px;font-size:13px;">
                <i class="fas fa-spinner fa-spin"></i> جاري التحميل...
            </div>
        </div>

        <!-- Input -->

<form id="cw-form" style="display:flex;gap:8px;padding:10px 12px;
      border-top:1px solid #1e2d42;background:#0d1424;flex-shrink:0;">
    <button type="submit" id="cw-send" style="background:#f97316;color:white;border:none;
            padding:9px 14px;border-radius:8px;cursor:pointer;font-size:14px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i class="fas fa-paper-plane"></i>
    </button>
    <button type="button" id="cw-screenshot" title="إرسال لقطة شاشة"
            style="background:#1e293b;color:#94a3b8;border:1px solid #334155;
                   padding:9px 12px;border-radius:8px;cursor:pointer;font-size:14px;
                   display:flex;align-items:center;justify-content:center;flex-shrink:0;
                   transition:all 0.2s;">
        <i class="fas fa-camera"></i>
    </button>
    <input id="cw-input" type="text" placeholder="اكتب رسالتك..." autocomplete="off" maxlength="500"
        style="flex:1;background:#111827;border:1px solid #1e2d42;border-radius:8px;
               padding:9px 12px;color:#f1f5f9;font-size:13px;font-family:inherit;
               direction:rtl;outline:none;transition:border-color 0.2s;">
</form>

        <style>
            @keyframes chatPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
            #cw-messages::-webkit-scrollbar { width:3px }
            #cw-messages::-webkit-scrollbar-thumb { background:#1e2d42; border-radius:3px }
            #cw-input:focus { border-color:#f97316; }
            #cw-send:hover { opacity:0.85; }
            #cw-send:disabled { opacity:0.4; cursor:not-allowed; }
        </style>
    `;

    document.body.appendChild(widget);

    widget.querySelector('#cw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const input   = document.getElementById('cw-input');
        const sendBtn = document.getElementById('cw-send');
        const message = input.value.trim();
        if (!message) return;
        input.value      = '';
        sendBtn.disabled = true;
        await supabase.from('chats').insert({
            user_id:    currentUser.id,
            user_email: currentUser.email,
            message,
            sender:     'user'
        });
        sendBtn.disabled = false;
        input.focus();
    });

    setTimeout(() => document.getElementById('cw-input')?.focus(), 300);
}

// ==================== فتح / إغلاق ====================
window.toggleChatWidget = async () => {
    isOpen = !isOpen;
    buildChatWidget();

    const widget = document.getElementById('chat-widget');
    const btn    = document.getElementById('chat-float-btn');

    if (isOpen) {
        widget.style.pointerEvents = 'all';
        requestAnimationFrame(() => {
            widget.style.opacity   = '1';
            widget.style.transform = 'translateY(0) scale(1)';
        });

        if (btn) btn.querySelector('i').className = 'fas fa-times';

        unreadCount = 0;
        updateBadge();

        if (!currentUser) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                const loading = document.getElementById('cw-loading');
                if (loading) loading.innerHTML = '<span style="color:#ef4444;">يجب تسجيل الدخول أولاً</span>';
                return;
            }
            currentUser = user;
        }

        await loadWidgetMessages();

        // ✅ أعد بناء الاشتراك في كل مرة تُفتح النافذة بـ channel جديد
        if (subscription) {
            await supabase.removeChannel(subscription);
            subscription = null;
        }
        subscribeWidget();

    } else {
        widget.style.opacity       = '0';
        widget.style.transform     = 'translateY(16px) scale(0.97)';
        widget.style.pointerEvents = 'none';
        if (btn) btn.querySelector('i').className = 'fas fa-headset';
    }
};

// ==================== تحميل الرسائل ====================
async function loadWidgetMessages() {
    const box = document.getElementById('cw-messages');
    if (!box) return;

    const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: true });

    if (error) {
        box.innerHTML = '<div style="text-align:center;color:#ef4444;padding:20px;font-size:13px;">❌ خطأ في التحميل</div>';
        return;
    }

    box.innerHTML = '';

    if (!data || data.length === 0) {
        box.innerHTML = `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;
                        justify-content:center;color:#475569;gap:8px;font-size:13px;padding:30px;">
                <i class="fas fa-comments" style="font-size:28px;opacity:0.25;"></i>
                <span>لا توجد رسائل، ابدأ المحادثة!</span>
            </div>`;
        return;
    }

    data.forEach(msg => appendWidgetMessage(msg));
    box.scrollTop = box.scrollHeight;
}

// ==================== Real-time — بدون filter ====================
function subscribeWidget() {
    if (!currentUser) return;

    // ✅ channel فريد في كل مرة + بدون filter
    subscription = supabase
        .channel('cw-' + currentUser.id + '-' + Date.now())
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats'
            // ✅ لا filter هنا — يسبب تأخير
        }, (payload) => {
            // ✅ تصفية يدوية
            if (payload.new.user_id !== currentUser.id) return;

            const box = document.getElementById('cw-messages');
            if (!box) return;

            const empty = box.querySelector('div[style*="flex-direction:column"]');
            if (empty) empty.remove();

            appendWidgetMessage(payload.new);
            box.scrollTop = box.scrollHeight;

            // إشعار إذا كانت النافذة مغلقة ورسالة من الأدمن
            if (!isOpen && payload.new.sender === 'admin') {
                unreadCount++;
                updateBadge();
                playNotifSound();
            }
        })
        .subscribe((status) => {
            console.log('[Chat] subscription:', status);
        });
}

// ==================== إضافة رسالة ====================
function appendWidgetMessage(msg) {
    const box = document.getElementById('cw-messages');
    if (!box) return;

    const isUser = msg.sender === 'user';
    const isScreenshot = msg.message?.startsWith('[screenshot]');
    const imgUrl = isScreenshot ? msg.message.replace('[screenshot]', '') : null;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
        max-width: 78%;
        padding: 9px 13px;
        border-radius: ${isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};
        font-size: 13px;
        line-height: 1.6;
        word-break: break-word;
        display: flex;
        flex-direction: column;
        gap: 3px;
        align-self: ${isUser ? 'flex-start' : 'flex-end'};
        background: ${isUser ? '#f97316' : '#1a2535'};
        color: ${isUser ? 'white' : '#f1f5f9'};
        border: ${isUser ? 'none' : '1px solid #1e2d42'};
    `;
    bubble.innerHTML = `
        ${!isUser ? '<span style="font-size:10px;font-weight:700;opacity:0.6;margin-bottom:2px;">🎧 الدعم الفني</span>' : ''}
        ${isScreenshot
            ? `<img src="${imgUrl}" style="max-width:200px;border-radius:8px;cursor:pointer;"
                    onclick="window.open('${imgUrl}','_blank')">`
            : `<span>${escHtml(msg.message)}</span>`
        }
        <span style="font-size:10px;opacity:0.55;align-self:flex-end;">${formatTime(msg.created_at)}</span>
    `;
    box.appendChild(bubble);
}

// ==================== Badge العداد ====================
function updateBadge() {
    const badge = document.getElementById('chat-float-badge');
    if (!badge) return;
    if (unreadCount > 0) {
        badge.textContent   = unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
        badge.textContent   = '';
    }
}

// ==================== صوت إشعار خفيف ====================
function playNotifSound() {
    try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}
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

// ==================== تهيئة عند تحميل الصفحة ====================
document.addEventListener('DOMContentLoaded', () => {
    // تحديث الزر العائم تلقائياً
    const floatBtn = document.getElementById('chat-float-btn');
    if (floatBtn) {
        floatBtn.removeAttribute('onclick');
        floatBtn.addEventListener('click', () => toggleChatWidget());
    }
});

// ==================== مراقبة Badge حتى لو النافذة مغلقة ====================
(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    currentUser = user;

    // ✅ إلغاء الاشتراك القديم إن وجد
    if (badgeSubscription) {
        await supabase.removeChannel(badgeSubscription);
        badgeSubscription = null;
    }

    // ✅ بدون filter — تصفية يدوية
    badgeSubscription = supabase
        .channel('cw-badge-' + user.id + '-' + Date.now())
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats'
            // ✅ لا filter
        }, (payload) => {
            // ✅ تصفية يدوية
            if (payload.new.user_id !== user.id) return;
            if (payload.new.sender  !== 'admin') return;

            if (!isOpen) {
                unreadCount++;
                updateBadge();
                playNotifSound();
            }
        })
        .subscribe((status) => {
            console.log('[Chat] badge subscription:', status);
        });
})();


// ==================== لقطة الشاشة ====================
async function takeScreenshot() {
    const btn = document.getElementById('cw-screenshot');
    if (!currentUser || !btn) return;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled  = true;

    try {
        // ✅ فتح معرض الصور بدل لقطة الشاشة
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async () => {
            const file = input.files[0];
            document.body.removeChild(input);
            if (!file) {
                btn.innerHTML = '<i class="fas fa-camera"></i>';
                btn.disabled  = false;
                return;
            }

            const fileName = `screenshots/${currentUser.id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabase.storage
                .from('chat-screenshots')
                .upload(fileName, file, { contentType: file.type });

            if (uploadError) {
                showScreenshotToast('❌ فشل رفع الصورة');
                btn.innerHTML = '<i class="fas fa-camera"></i>';
                btn.disabled  = false;
                return;
            }

            const { data: urlData } = supabase.storage
                .from('chat-screenshots')
                .getPublicUrl(fileName);

            await supabase.from('chats').insert({
                user_id:    currentUser.id,
                user_email: currentUser.email,
                message:    `[screenshot]${urlData.publicUrl}`,
                sender:     'user'
            });

            showScreenshotToast('✅ تم إرسال الصورة!');
            btn.innerHTML = '<i class="fas fa-camera"></i>';
            btn.disabled  = false;
        };

        input.oncancel = () => {
            document.body.removeChild(input);
            btn.innerHTML = '<i class="fas fa-camera"></i>';
            btn.disabled  = false;
        };

        input.click();

    } catch (err) {
        showScreenshotToast('❌ حدث خطأ');
        btn.innerHTML = '<i class="fas fa-camera"></i>';
        btn.disabled  = false;
    }
}

document.getElementById('cw-screenshot')?.addEventListener('click', takeScreenshot);

function showScreenshotToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
        position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
        background:#1e293b; color:white; border:1px solid #334155;
        padding:10px 20px; border-radius:8px; font-size:13px;
        z-index:99999; box-shadow:0 4px 20px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}