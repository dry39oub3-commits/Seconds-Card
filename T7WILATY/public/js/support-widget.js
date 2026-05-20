// ===== زر الدعم الفني العائم =====
import { supabase } from './supabase-config.js';

// ─── رسم الأيقونة: صورة أو Font Awesome ───
function renderChannelIcon(ch) {
    const isImgUrl = ch.icon && (
        ch.icon.startsWith('http') ||
        ch.icon.startsWith('/') ||
        ch.icon.startsWith('data:')
    );

    if (isImgUrl) {
        return `<img src="${ch.icon}" alt="${ch.label}"
                    style="width:22px;height:22px;object-fit:cover;
                           border-radius:50%;flex-shrink:0;">`;
    } else if (ch.icon) {
        return `<i class="${ch.icon}" style="font-size:18px;flex-shrink:0;"></i>`;
    }
    // fallback: أول حرف من الاسم
    return `<span style="font-size:15px;font-weight:700;flex-shrink:0;">
                ${ch.label?.charAt(0) || '?'}
            </span>`;
}

async function initSupportWidget() {
    const { data: channels } = await supabase
        .from('support_channels')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (!channels || channels.length === 0) return;

    // إزالة أي widget قديم
    document.getElementById('support-widget')?.remove();

    const widget = document.createElement('div');
    widget.id = 'support-widget';
    widget.innerHTML = `
        <style>
            #support-widget {
                position: fixed;
                bottom: 24px;
                left: 24px;
                z-index: 99999;
                font-family: 'Cairo', sans-serif;
                direction: rtl;
            }
            #support-toggle-btn {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, #f97316, #ea580c);
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 20px rgba(249,115,22,0.5);
                transition: transform 0.3s, box-shadow 0.3s;
                position: relative;
            }
            #support-toggle-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 25px rgba(249,115,22,0.6);
            }
            #support-toggle-btn i {
                color: white;
                font-size: 22px;
                transition: transform 0.3s;
            }
            #support-toggle-btn.open i {
                transform: rotate(45deg);
            }
            #support-channels-list {
                position: absolute;
                bottom: 70px;
                left: 0;
                display: flex;
                flex-direction: column;
                gap: 10px;
                opacity: 0;
                pointer-events: none;
                transform: translateY(10px);
                transition: all 0.3s ease;
            }
            #support-channels-list.open {
                opacity: 1;
                pointer-events: all;
                transform: translateY(0);
            }
            .support-channel-btn {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                border-radius: 30px;
                text-decoration: none;
                color: white;
                font-size: 13px;
                font-weight: 700;
                box-shadow: 0 3px 12px rgba(0,0,0,0.3);
                white-space: nowrap;
                transition: transform 0.2s, box-shadow 0.2s;
                direction: rtl;
            }
            .support-channel-btn:hover {
                transform: translateX(-4px);
                box-shadow: 0 5px 18px rgba(0,0,0,0.4);
            }
        </style>

        <div id="support-channels-list">
            ${channels.map(ch => {
                let href = '#';
                if (ch.type === 'whatsapp')      href = `https://wa.me/${ch.value}`;
                else if (ch.type === 'facebook')  href = ch.value;
                else if (ch.type === 'email')     href = `mailto:${ch.value}`;
                else if (ch.type === 'tawk')      href = ch.value;
                else if (ch.type === 'custom')    href = ch.value.startsWith('http') ? ch.value : `https://t.me/${ch.value.replace('@','')}`;

                return `
                <a href="${href}" target="_blank" class="support-channel-btn"
                   style="background:${ch.color};">
                    ${renderChannelIcon(ch)}
                    ${ch.label}
                </a>`;
            }).join('')}
        </div>

        <button id="support-toggle-btn">
            <i class="fas fa-headset"></i>
        </button>
    `;

    document.body.appendChild(widget);

    const btn  = document.getElementById('support-toggle-btn');
    const list = document.getElementById('support-channels-list');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('open');
        list.classList.toggle('open');
    });

    // إغلاق عند الضغط خارج الـ widget
    document.addEventListener('click', (e) => {
        if (!widget.contains(e.target)) {
            btn.classList.remove('open');
            list.classList.remove('open');
        }
    });
}

initSupportWidget();