/**
 * chat-float.js
 * ضعه في: public/js/chat-float.js
 * ثم أضف في كل صفحة HTML للعميل قبل </body>:
 * <script type="module" src="/js/chat-float.js"></script>
 */

import { supabase } from './supabase-config.js';

// ===== إنشاء الزر =====
const btn = document.createElement('div');
btn.id = 'chat-float-btn';
btn.title = 'تواصل مع الدعم الفني';
btn.innerHTML = `
    <i class="fas fa-headset"></i>
    <span class="chat-float-badge" id="chat-float-badge"></span>
`;
document.body.appendChild(btn);

// ===== CSS =====
const style = document.createElement('style');
style.textContent = `
#chat-float-btn {
    position: fixed;
    bottom: 28px;
    left: 28px;
    width: 56px;
    height: 56px;
    background: #f97316;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 24px rgba(249,115,22,0.45);
    transition: transform 0.2s, box-shadow 0.2s;
}
#chat-float-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 32px rgba(249,115,22,0.65);
}
#chat-float-btn:active { transform: scale(0.96); }
#chat-float-btn i {
    color: white;
    font-size: 22px;
    pointer-events: none;
}
.chat-float-badge {
    position: absolute;
    top: -3px;
    right: -3px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    min-width: 20px;
    height: 20px;
    font-size: 11px;
    font-weight: 700;
    display: none;
    align-items: center;
    justify-content: center;
    border: 2px solid #0a0f1a;
    padding: 0 3px;
    animation: pulse-badge 2s infinite;
}
@keyframes pulse-badge {
    0%, 100% { transform: scale(1); }
    50%       { transform: scale(1.25); }
}
.chat-float-tooltip {
    position: fixed;
    bottom: 94px;
    left: 28px;
    background: #111827;
    color: #f1f5f9;
    border: 1px solid #1e2d42;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 13px;
    font-family: 'Tajawal', sans-serif;
    white-space: nowrap;
    z-index: 9998;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    animation: fadeInTip 0.3s ease, fadeOutTip 0.4s ease 3.5s forwards;
    pointer-events: none;
}
.chat-float-tooltip::after {
    content: '';
    position: absolute;
    bottom: -7px;
    left: 20px;
    border: 6px solid transparent;
    border-top-color: #1e2d42;
    border-bottom: none;
}
@keyframes fadeInTip {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeOutTip {
    from { opacity: 1; }
    to   { opacity: 0; }
}
`;
document.head.appendChild(style);

// ===== عند الضغط =====
btn.addEventListener('click', () => {
    window.location.href = 'chat.html';
});

// ===== التلميح عند أول زيارة =====
if (!localStorage.getItem('chat_tooltip_shown')) {
    const tooltip = document.createElement('div');
    tooltip.className = 'chat-float-tooltip';
    tooltip.textContent = '💬 هل تحتاج مساعدة؟';
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 4200);
    localStorage.setItem('chat_tooltip_shown', '1');
}

// ===== إشعارات الرسائل =====
// ===== إشعارات الرسائل =====
const { data: { user } } = await supabase.auth.getUser();
if (user) {

    const badge = document.getElementById('chat-float-badge');

    async function checkUnread() {
        const { data } = await supabase
            .from('chats')
            .select('id')
            .eq('user_id', user.id)
            .eq('sender', 'admin')
            .eq('is_read', false);

        const count = data?.length || 0;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    await checkUnread();

    supabase.channel('float-' + user.id)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chats',
            filter: `user_id=eq.${user.id}`
        }, (payload) => {
            if (payload.new.sender === 'admin') {
                const current = parseInt(badge.textContent) || 0;
                badge.textContent = current + 1;
                badge.style.display = 'flex';
                try {
                    const ctx  = new AudioContext();
                    const osc  = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.frequency.value = 880;
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.3);
                } catch(e) {}
            }
        })
        .subscribe();
}