import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get('id');
    if (!orderId) { window.location.href = 'orders.html'; return; }
    await loadOrderDetails(orderId);
});

async function loadOrderDetails(orderId) {
    const container = document.getElementById('order-details-content');

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { window.location.href = 'login.html'; return; }

    const { data: firstOrder, error: firstError } = await supabase
        .from('orders')
        .select('*, products(image, name, prices)')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

    if (firstError || !firstOrder) {
        container.innerHTML = `<p style="text-align:center;color:#ef4444;">الطلب غير موجود.</p>`;
        return;
    }

    let allOrders = [firstOrder];
    if (firstOrder.order_number) {
        const { data: siblings } = await supabase
            .from('orders')
            .select('*, products(image, name, prices)')
            .eq('order_number', firstOrder.order_number)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });
        if (siblings?.length > 0) allOrders = siblings;
    }

    const orderNum   = firstOrder.order_number || '#' + firstOrder.id.substring(0, 8);
    const date       = new Date(firstOrder.created_at).toLocaleString('fr-FR');
    const currency   = firstOrder.currency || 'MRU';
    const totalPrice = allOrders.reduce((s, o) => s + (o.price || 0) * (o.quantity || 1), 0);
    const totalQty   = allOrders.reduce((s, o) => s + (o.quantity || 1), 0);
    const pm         = firstOrder.paymentMethod || firstOrder.payment_method || '—';

    const priority = { 'قيد الانتظار': 5, 'قيد المراجعة': 4, 'مكتمل': 3, 'مسترد': 2, 'ملغي': 1 };
    const groupStatus = allOrders.reduce((best, o) =>
        (priority[o.status] ?? 0) > (priority[best] ?? 0) ? o.status : best
    , allOrders[0].status);

    const isCompleted = groupStatus === 'مكتمل';
    const isCancelled = groupStatus === 'ملغي';
    const isRefunded  = groupStatus === 'مسترد';

    const statusClass = isCompleted ? 'status-completed'
                      : isCancelled ? 'status-cancelled'
                      : isRefunded  ? 'status-refunded'
                      : 'status-pending';

    const rejectReason     = allOrders.find(o => o.reject_reason)?.reject_reason;
    const refundReceiptUrl = allOrders.find(o => o.refund_receipt_url)?.refund_receipt_url;

    // حفظ الأكواد
    window._orderCodesMap = {};
    allOrders.forEach((order, idx) => {
        window._orderCodesMap[idx] = (order.card_code || '').replace(/\\n/g, '\n')
            .split('\n').filter(c => c.trim() !== '');
    });

    const productCards = allOrders.map((order, orderIdx) => {
        const image  = order.products?.image || '';
        const total  = (order.price || 0) * (order.quantity || 1);
        const codes  = (order.card_code || '').replace(/\\n/g, '\n')
                           .split('\n').filter(c => c.trim() !== '');

        const itemStatusClass = order.status === 'مكتمل' ? 'status-completed'
                              : order.status === 'ملغي'   ? 'status-cancelled'
                              : order.status === 'مسترد'  ? 'status-refunded'
                              : 'status-pending';

        const codesSection = isCompleted && codes.length > 0 ? `
            <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">

                <!-- شريط الأزرار -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
                    <div style="font-size:12px;font-weight:700;color:#f97316;display:flex;align-items:center;gap:6px;">
                        <i class="fas fa-key"></i>
                        ${codes.length > 1 ? codes.length + ' أكواد' : 'الكود'}
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <!-- زر تعليمات الاسترداد -->
                        <button onclick="showInstructions('${(order.product_name||'').replace(/'/g,"\\'")}')"
                            style="background:rgba(59,130,246,0.12);color:#60a5fa;
                                   border:1px solid rgba(59,130,246,0.25);
                                   padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;
                                   font-weight:700;display:flex;align-items:center;gap:5px;">
                            <i class="fas fa-list-ol"></i> تعليمات الاسترداد
                        </button>
                        <!-- زر عرض/إخفاء الكل -->
                        <button id="eye-all-${orderIdx}"
                            onclick="toggleAllCodes(${orderIdx}, ${codes.length})"
                            style="background:#1e293b;color:#64748b;border:1px solid #334155;
                                   padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;
                                   font-weight:700;display:flex;align-items:center;gap:5px;
                                   transition:all 0.2s;">
                            <i class="fas fa-eye"></i> عرض
                        </button>
                        <!-- نسخ الكل -->
                        ${codes.length >= 1 ? `
                        <button onclick="copyOrderCodes(${orderIdx})"
                            style="background:rgba(249,115,22,0.12);color:#f97316;
                                   border:1px solid rgba(249,115,22,0.25);
                                   padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;
                                   font-weight:700;display:flex;align-items:center;gap:5px;">
                            <i class="fas fa-copy"></i> نسخ الكل
                        </button>` : ''}
                    </div>
                </div>

                <!-- الأكواد -->
                ${codes.map((code, i) => `
                <div style="background:#0f172a;border-radius:8px;padding:10px 12px;
                            display:flex;align-items:center;gap:8px;margin-bottom:6px;
                            border:1px solid rgba(249,115,22,0.12);">
                    ${codes.length > 1 ? `<span style="color:#475569;font-size:11px;min-width:16px;">${i+1}</span>` : ''}
                    <span id="code-${orderIdx}-${i}"
                          data-code="${code.replace(/"/g,'&quot;')}"
                          data-hidden="true"
                          style="font-family:monospace;font-size:14px;color:#f97316;
                                 font-weight:bold;flex:1;text-align:center;letter-spacing:1px;
                                 user-select:none;">
                        ●●●●●●●●●●●●●●●●
                    </span>
                    <!-- زر نسخ كود واحد -->
                    <button onclick="copySingleCode('${code.replace(/'/g,"\\'")}',this)"
                        style="background:#1e293b;color:#64748b;border:none;
                               padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12px;
                               flex-shrink:0;">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>`).join('')}
            </div>` : '';

        return `
        <div style="background:var(--card-bg,#1e293b);border-radius:14px;padding:16px;
                    margin-bottom:12px;border:1px solid rgba(255,255,255,0.06);">
            <div style="display:flex;align-items:center;gap:12px;">
                ${image
                    ? `<img src="${image}" style="width:56px;height:56px;object-fit:contain;background:white;border-radius:9px;padding:4px;flex-shrink:0;">`
                    : `<div style="width:56px;height:56px;background:#0f172a;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                           <i class="fas fa-box" style="color:#475569;"></i>
                       </div>`}
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:15px;margin-bottom:3px;
                                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${order.product_name || '—'}
                    </div>
                    ${order.label ? `<div style="font-size:12px;color:#f97316;margin-bottom:2px;">
                        <i class="fas fa-tag" style="font-size:10px;"></i> ${order.label}
                    </div>` : ''}
                    <div style="font-size:12px;color:#64748b;">× ${order.quantity || 1}</div>
                </div>
                <div style="text-align:left;flex-shrink:0;">
                    <div style="font-size:16px;font-weight:800;color:#e2e8f0;margin-bottom:4px;">
                        ${total} ${currency}
                    </div>
                    <span class="status-badge ${itemStatusClass}" style="font-size:10px;">
                        ${order.status}
                    </span>
                </div>
            </div>
            ${codesSection}
        </div>`;
    }).join('');

    container.innerHTML = `
    <style>
        .detail-summary-row {
            display:flex; justify-content:space-between; align-items:center;
            padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);
            font-size:13px;
        }
        .detail-summary-row:last-child { border-bottom:none; }
        .summary-label { color:#64748b; font-weight:600; }
        .summary-value { color:#e2e8f0; font-weight:700; text-align:left; }
    </style>

    <!-- زر الرجوع -->
    <button onclick="window.location.href='orders.html'"
        style="display:inline-flex;align-items:center;gap:8px;background:transparent;
               border:1px solid #334155;color:#94a3b8;padding:8px 16px;
               border-radius:8px;cursor:pointer;font-size:13px;margin-bottom:20px;">
        <i class="fas fa-arrow-right"></i> العودة للطلبات
    </button>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;align-items:start;">

        <!-- ── يمين: بطاقات المنتجات ── -->
        <div>
            ${productCards}

            ${isCancelled && rejectReason ? `
            <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);
                        border-radius:14px;padding:16px;margin-bottom:12px;">
                <div style="display:flex;gap:10px;align-items:flex-start;">
                    <i class="fas fa-times-circle" style="color:#ef4444;margin-top:2px;"></i>
                    <div>
                        <div style="font-weight:700;color:#ef4444;margin-bottom:4px;">سبب الرفض</div>
                        <div style="font-size:13px;color:#fca5a5;">${rejectReason}</div>
                    </div>
                </div>
            </div>` : ''}

            ${isRefunded && refundReceiptUrl?.startsWith('http') ? `
            <div style="background:var(--card-bg,#1e293b);border:1px solid rgba(245,158,11,0.2);
                        border-radius:14px;padding:16px;margin-bottom:12px;">
                <div style="font-weight:700;color:#f59e0b;margin-bottom:12px;">
                    <i class="fas fa-receipt"></i> إيصال الاسترداد
                </div>
                <img src="${refundReceiptUrl}" style="width:100%;border-radius:10px;">
            </div>` : ''}


        </div>

        <!-- ── يسار: ملخص الطلب ── -->
        <div style="position:sticky;top:20px;">
            <div style="background:var(--card-bg,#1e293b);border-radius:14px;padding:20px;
                        border:1px solid rgba(255,255,255,0.06);">

                <div style="display:flex;justify-content:space-between;align-items:center;
                            margin-bottom:16px;padding-bottom:14px;
                            border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="font-weight:800;font-size:15px;color:#e2e8f0;">ملخص الطلب</div>
                    <span class="status-badge ${statusClass}" style="font-size:11px;">
                        ${groupStatus}
                    </span>
                </div>

                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-hashtag" style="color:#f97316;margin-left:6px;"></i>رقم الطلب</span>
                    <span style="font-family:monospace;color:#f97316;font-weight:800;">${orderNum}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-calendar" style="color:#64748b;margin-left:6px;"></i>التاريخ</span>
                    <span class="summary-value" style="font-size:12px;">${date}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-credit-card" style="color:#64748b;margin-left:6px;"></i>الدفع</span>
                    <span class="summary-value">${pm}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-box" style="color:#64748b;margin-left:6px;"></i>المنتجات</span>
                    <span class="summary-value">${allOrders.length}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-cubes" style="color:#64748b;margin-left:6px;"></i>إجمالي الكمية</span>
                    <span class="summary-value">${totalQty}</span>
                </div>

                <div style="margin-top:14px;padding:14px;background:#0f172a;border-radius:10px;
                            border:1px solid rgba(34,197,94,0.2);text-align:center;">
                    <div style="font-size:11px;color:#64748b;margin-bottom:4px;">المبلغ الإجمالي</div>
                    <div style="font-size:22px;font-weight:900;color:#22c55e;">
                        ${totalPrice} <span style="font-size:13px;">${currency}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <style>
        @media (max-width: 768px) {
            #order-details-content > div:last-of-type {
                grid-template-columns: 1fr !important;
            }
            #order-details-content > div:last-of-type > div:last-child {
                position: static !important;
                order: -1;
            }
        }
    </style>
    `;
}

// ── عرض/إخفاء كل أكواد بطاقة واحدة دفعة واحدة ──
window.toggleAllCodes = (orderIdx, count) => {
    const btn = document.getElementById(`eye-all-${orderIdx}`);
    const firstSpan = document.getElementById(`code-${orderIdx}-0`);
    if (!firstSpan) return;

    const isHidden = firstSpan.dataset.hidden === 'true';

    for (let i = 0; i < count; i++) {
        const span = document.getElementById(`code-${orderIdx}-${i}`);
        if (!span) continue;
        const code = span.dataset.code;
        if (isHidden) {
            span.textContent    = code;
            span.style.userSelect = 'text';
            span.dataset.hidden = 'false';
        } else {
            span.textContent    = '●●●●●●●●●●●●●●●●';
            span.style.userSelect = 'none';
            span.dataset.hidden = 'true';
        }
    }

    if (btn) {
        btn.innerHTML = isHidden
            ? '<i class="fas fa-eye-slash"></i> إخفاء'
            : '<i class="fas fa-eye"></i> عرض';
        btn.style.color       = isHidden ? '#22c55e' : '#64748b';
        btn.style.borderColor = isHidden ? '#22c55e' : '#334155';
    }
};

window.copySingleCode = (code, btn) => {
    navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.style.color = '#22c55e';
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; btn.style.color = '#64748b'; }, 2000);
    });
};

window.copyOrderCodes = (orderIdx) => {
    const codes = window._orderCodesMap?.[orderIdx] || [];
    if (!codes.length) return;
    navigator.clipboard.writeText(codes.join('\n')).then(() => showToast('✅ تم نسخ الأكواد!'));
};

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
        background:#22c55e;color:white;padding:12px 24px;border-radius:10px;
        font-size:14px;font-weight:700;z-index:99999;font-family:'Cairo',sans-serif;pointer-events:none;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// ── modal تعليمات الاسترداد ──
window.showInstructions = async (productName) => {
    document.getElementById('inst-modal')?.remove();

    // جلب التعليمات
    const { data } = await supabase
        .from('product_descriptions')
        .select('instructions, description')
        .eq('product_name', productName)
        .single();

    const instructions = data?.instructions || '';
    const steps = instructions.split('\n').map(s => s.trim()).filter(s => s);

    const modal = document.createElement('div');
    modal.id = 'inst-modal';
    modal.style.cssText = `
        position:fixed; inset:0;
        background:rgba(0,0,0,0.7); backdrop-filter:blur(4px);
        z-index:99999; display:flex; align-items:center; justify-content:center;
        padding:20px; animation:instFadeIn 0.2s ease;
    `;

    modal.innerHTML = `
        <style>
            @keyframes instFadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes instSlideUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
        </style>
        <div style="
            background:#111827; border:1px solid #1e293b; border-radius:18px;
            padding:26px; width:100%; max-width:480px; color:#e2e8f0;
            font-family:'Tajawal','Segoe UI',sans-serif;
            animation:instSlideUp 0.25s ease;
            max-height:85vh; overflow-y:auto;
        ">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <div style="font-size:16px;font-weight:800;color:#f1f5f9;display:flex;align-items:center;gap:8px;">
                    <i class="fas fa-list-ol" style="color:#60a5fa;"></i>
                    تعليمات الاسترداد
                </div>
                <button onclick="document.getElementById('inst-modal').remove()"
                    style="background:rgba(239,68,68,0.12);color:#ef4444;
                           border:1px solid rgba(239,68,68,0.25);border-radius:8px;
                           width:30px;height:30px;cursor:pointer;font-size:13px;
                           display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- اسم المنتج -->
            <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);
                        border-radius:10px;padding:10px 14px;margin-bottom:18px;
                        font-size:13px;font-weight:700;color:#60a5fa;">
                <i class="fas fa-box" style="margin-left:6px;"></i>${productName}
            </div>

            <!-- الخطوات -->
            ${steps.length > 0 ? `
            <div style="display:flex;flex-direction:column;gap:10px;">
                ${steps.map((step, i) => `
                <div style="display:flex;gap:12px;align-items:flex-start;
                            padding:12px 14px;background:#0f172a;border-radius:10px;
                            border:1px solid #1e293b;">
                    <div style="width:26px;height:26px;min-width:26px;
                                background:rgba(96,165,250,0.15);color:#60a5fa;
                                border-radius:50%;display:flex;align-items:center;
                                justify-content:center;font-size:12px;font-weight:800;">
                        ${i + 1}
                    </div>
                    <div style="font-size:13px;color:#cbd5e1;line-height:1.7;padding-top:3px;">
                        ${step.replace(/(https?:\/\/[^\s)]+)/g,
                            '<a href="$1" target="_blank" rel="noopener" style="color:#f97316;text-decoration:underline;">رابط الاسترداد</a>')}
                    </div>
                </div>`).join('')}
            </div>` : `
            <div style="text-align:center;padding:30px;color:#475569;">
                <i class="fas fa-info-circle" style="font-size:30px;margin-bottom:10px;display:block;"></i>
                لا توجد تعليمات متاحة لهذا المنتج
            </div>`}

            <!-- زر الإغلاق -->
            <button onclick="document.getElementById('inst-modal').remove()"
                style="width:100%;margin-top:18px;padding:12px;
                       background:#1e293b;color:#94a3b8;border:1px solid #334155;
                       border-radius:10px;cursor:pointer;font-size:14px;font-weight:700;
                       font-family:'Tajawal','Segoe UI',sans-serif;transition:background 0.2s;"
                onmouseover="this.style.background='#334155'"
                onmouseout="this.style.background='#1e293b'">
                إغلاق
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};