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
        container.innerHTML = `<p class="order-not-found">الطلب غير موجود.</p>`;
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
    // ✅ جلب إيصال التنفيذ (الذي يرفعه الأدمن عند القبول)
    const paymentReceipt   = firstOrder.receiptUrl || firstOrder.receipt_url || null;
    const executionReceipt = allOrders.find(o => o.execution_receipt_url)?.execution_receipt_url;

    // حفظ الأكواد
    window._orderCodesMap = {};
    allOrders.forEach((order, idx) => {
        window._orderCodesMap[idx] = (order.card_code || '').replace(/\\n/g, '\n')
            .split('\n').filter(c => c.trim() !== '');
    });

    const productCards = allOrders.map((order, orderIdx) => {
        const image = order.products?.image || '';
        const total = (order.price || 0) * (order.quantity || 1);
        const codes = (order.card_code || '').replace(/\\n/g, '\n')
                          .split('\n').filter(c => c.trim() !== '');

        const itemStatusClass = order.status === 'مكتمل' ? 'status-completed'
                              : order.status === 'ملغي'   ? 'status-cancelled'
                              : order.status === 'مسترد'  ? 'status-refunded'
                              : 'status-pending';

        const codesSection = isCompleted && codes.length > 0 ? `
            <div class="codes-section">
                <div class="codes-header">
                    <div class="codes-label">
                        <i class="fas fa-key"></i>
                        ${codes.length > 1 ? codes.length + ' أكواد' : 'الكود'}
                    </div>
                    <div class="codes-actions">
                        <button onclick="showInstructions('${(order.product_name||'').replace(/'/g,"\\'")}')"
                            class="btn-instructions">
                            <i class="fas fa-list-ol"></i> تعليمات الاسترداد
                        </button>
                        <button id="eye-all-${orderIdx}"
                            onclick="toggleAllCodes(${orderIdx}, ${codes.length})"
                            class="btn-eye">
                            <i class="fas fa-eye"></i> عرض
                        </button>
                        ${codes.length >= 1 ? `
                        <button onclick="copyOrderCodes(${orderIdx})"
                            class="copy-all-btn">
                            <i class="fas fa-copy"></i> نسخ الكل
                        </button>` : ''}
                    </div>
                </div>

                ${codes.map((code, i) => `
                <div class="code-box">
                    ${codes.length > 1 ? `<span class="code-num">${i+1}</span>` : ''}
                    <span id="code-${orderIdx}-${i}"
                          data-code="${code.replace(/"/g,'&quot;')}"
                          data-hidden="true"
                          class="code-text code-hidden">
                        ●●●●●●●●●●●●●●●●
                    </span>
                    <button onclick="copySingleCode('${code.replace(/'/g,"\\'")}',this)"
                        class="copy-btn-sm">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>`).join('')}
            </div>` : '';

        return `
        <div class="detail-card product-card">
            <div class="product-row-inner">
                ${image
                    ? `<img src="${image}" class="product-img" alt="">`
                    : `<div class="product-img-placeholder"><i class="fas fa-box"></i></div>`}
                <div class="product-info">
                    <div class="product-name">${order.product_name || '—'}</div>
                    ${order.label ? `<div class="product-label">
                        <i class="fas fa-tag"></i> ${order.label}
                    </div>` : ''}
                    <div class="product-qty">× ${order.quantity || 1}</div>
                </div>
                <div class="product-price-col">
                    <div class="product-price">${total} ${currency}</div>
                    <span class="status-badge ${itemStatusClass}">${order.status}</span>
                </div>
            </div>
            
            ${codesSection}
            ${order.player_id ? `
            <div style="margin-top:12px; margin-bottom:0; font-size:13px; grid-column:1/-1;
                background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.3);
                border-radius:8px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between;">
                <span>🎮 Player ID</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <strong id="player-id-value" style="font-family:monospace; color:#22c55e; font-size:15px;">
                        ${order.player_id}
                    </strong>
                    
                </div>
            </div>` : ''}
        </div>`;
        
    }).join('');

    
    container.innerHTML = `
    <button onclick="window.location.href='orders.html'" class="back-btn">
        <i class="fas fa-arrow-right"></i> العودة للطلبات
    </button>

    <div class="order-layout">

        <div class="order-products-col">
            ${productCards}

            ${paymentReceipt?.startsWith('http') ? `
<div class="refund-receipt-block">
    <div class="refund-title" style="color:#f97316;">
        <i class="fas fa-receipt"></i> إيصال الدفع
    </div>
    <img src="${paymentReceipt}"
         class="refund-img"
         onclick="window.open('${paymentReceipt}','_blank')"
         style="cursor:zoom-in;"
         title="انقر للتكبير">
</div>` : ''}

${isCancelled && rejectReason ? `
<div class="reject-block">
    <div class="reject-inner">
        <i class="fas fa-times-circle reject-icon"></i>
        <div>
            <div class="reject-title">سبب الرفض</div>
            <div class="reject-text">${rejectReason}</div>
        </div>
    </div>
</div>` : ''}

${isCompleted && executionReceipt?.startsWith('http') ? `
<div class="refund-receipt-block">
    <div class="refund-title" style="color:#22c55e;">
        <i class="fas fa-receipt"></i> إيصال التنفيذ
    </div>
    <img src="${executionReceipt}"
         class="refund-img"
         onclick="window.open('${executionReceipt}','_blank')"
         style="cursor:zoom-in;"
         title="انقر للتكبير">
</div>` : ''}

${isRefunded && refundReceiptUrl?.startsWith('http') ? `
<div class="refund-receipt-block">
    <div class="refund-title">
        <i class="fas fa-receipt"></i> إيصال الاسترداد
    </div>
    <img src="${refundReceiptUrl}" class="refund-img">
</div>` : ''}
        </div>

        <div class="order-summary-col">
            <div class="detail-card summary-card">

                <div class="summary-header">
                    <div class="summary-title">ملخص الطلب</div>
                    <span class="status-badge ${statusClass}">${groupStatus}</span>
                </div>

                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-hashtag summary-icon orange"></i>رقم الطلب</span>
                    <span class="summary-order-num">${orderNum}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-calendar summary-icon"></i>التاريخ</span>
                    <span class="summary-value summary-date">${date}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-credit-card summary-icon"></i>الدفع</span>
                    <span class="summary-value">${pm}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-box summary-icon"></i>المنتجات</span>
                    <span class="summary-value">${allOrders.length}</span>
                </div>
                <div class="detail-summary-row">
                    <span class="summary-label"><i class="fas fa-cubes summary-icon"></i>إجمالي الكمية</span>
                    <span class="summary-value">${totalQty}</span>
                </div>

                <div class="total-amount-box">
                    <div class="total-label">المبلغ الإجمالي</div>
                    <div class="total-value">
                        ${totalPrice} <span class="total-currency">${currency}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
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
            span.textContent = code;
            span.classList.remove('code-hidden');
            span.classList.add('code-visible');
            span.dataset.hidden = 'false';
        } else {
            span.textContent = '●●●●●●●●●●●●●●●●';
            span.classList.remove('code-visible');
            span.classList.add('code-hidden');
            span.dataset.hidden = 'true';
        }
    }

    if (btn) {
        btn.innerHTML = isHidden
            ? '<i class="fas fa-eye-slash"></i> إخفاء'
            : '<i class="fas fa-eye"></i> عرض';
        btn.classList.toggle('btn-eye--active', isHidden);
    }
};

window.copySingleCode = (code, btn) => {
    navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.classList.add('copy-btn-sm--success');
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i>';
            btn.classList.remove('copy-btn-sm--success');
        }, 2000);
    });
};

window.copyOrderCodes = (orderIdx) => {
    const codes = window._orderCodesMap?.[orderIdx] || [];
    if (!codes.length) return;
    navigator.clipboard.writeText(codes.join('\n')).then(() => showToast('✅ تم نسخ الأكواد!'));
};

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'order-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// ── modal تعليمات الاسترداد ──
window.showInstructions = async (productName) => {
    document.getElementById('inst-modal')?.remove();

    const { data } = await supabase
        .from('product_descriptions')
        .select('instructions, description')
        .eq('product_name', productName)
        .single();

    const instructions = data?.instructions || '';
    const steps = instructions.split('\n').map(s => s.trim()).filter(s => s);

    const modal = document.createElement('div');
    modal.id = 'inst-modal';
    modal.className = 'inst-modal-overlay';

    modal.innerHTML = `
        <div class="inst-modal-box">
            <div class="inst-modal-header">
                <div class="inst-modal-title">
                    <i class="fas fa-list-ol"></i>
                    تعليمات الاسترداد
                </div>
                <button onclick="document.getElementById('inst-modal').remove()"
                    class="inst-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="inst-product-name">
                <i class="fas fa-box"></i> ${productName}
            </div>

            ${steps.length > 0 ? `
            <div class="inst-steps">
                ${steps.map((step, i) => `
                <div class="inst-step-item">
                    <div class="inst-step-num">${i + 1}</div>
                    <div class="inst-step-text">
                        ${step.replace(/(https?:\/\/[^\s)]+)/g,
                            '<a href="$1" target="_blank" rel="noopener" class="inst-link">صفحة الاسترداد</a>')}
                    </div>
                </div>`).join('')}
            </div>` : `
            <div class="inst-empty">
                <i class="fas fa-info-circle"></i>
                لا توجد تعليمات متاحة لهذا المنتج
            </div>`}

            <button onclick="document.getElementById('inst-modal').remove()"
                class="inst-close-footer-btn">
                إغلاق
            </button>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};