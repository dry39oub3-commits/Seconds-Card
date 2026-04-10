import { db } from '../../js/firebase-config.js'; // التأكد من مسار الإعدادات
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. دالة جلب وعرض الطلبات بتحديث مباشر (Real-time)
export function listenToOrders() {
    const ordersList = document.getElementById('admin-orders-list');
    if (!ordersList) return;

    // استعلام لترتيب الطلبات من الأحدث للأقدم
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));

    // استخدام onSnapshot للتحديث التلقائي اللحظي
    onSnapshot(q, (snapshot) => {
        let html = '';
        
        if (snapshot.empty) {
            ordersList.innerHTML = '<tr><td colspan="7" style="text-align:center;">📭 لا توجد طلبات حالياً</td></tr>';
            return;
        }

        snapshot.forEach((orderDoc) => {
            const order = orderDoc.data();
            const orderId = orderDoc.id;
            
            // تنسيق التاريخ
            const date = order.timestamp ? 
                new Date(order.timestamp.seconds * 1000).toLocaleString('ar-EG') : 
                'جاري المعالجة...';
            
            // حالة الطلب الافتراضية
            const status = order.status || 'قيد الانتظار';

            html += `
                <tr>
                    <td>#${orderId.substring(0, 7)}</td>
                    <td>${order.userEmail || 'عميل StorCards'}</td>
                    <td>${order.cardName}</td>
                    <td><strong>${order.price} MRU</strong></td>
                    <td><small>${date}</small></td>
                    <td>
                        <span class="status-badge ${getStatusClass(status)}">
                            ${status}
                        </span>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button onclick="updateOrderStatus('${orderId}', 'مكتمل')" class="btn-check" title="اعتماد كطلب ناجح">
                                <i class="fas fa-check-circle"></i>
                            </button>
                            <button onclick="deleteOrder('${orderId}')" class="btn-delete" title="حذف الطلب">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        ordersList.innerHTML = html;
    });
}

// 2. دالة لتحديد لون "حالة الطلب" (تأكد من وجود التنسيقات في ملف الـ CSS)
function getStatusClass(status) {
    if (status === 'مكتمل' || status === 'completed') return 'status-completed';
    if (status === 'ملغي' || status === 'cancelled') return 'status-cancelled';
    return 'status-pending';
}

// 3. دالة تحديث حالة الطلب
window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, { status: newStatus });
        // لا حاجة لعمل Reload لأن onSnapshot سيحدث الواجهة تلقائياً
    } catch (error) {
        console.error("Update Error:", error);
        alert("⚠️ فشل تحديث الحالة: " + error.message);
    }
};

// 4. دالة حذف الطلب
window.deleteOrder = async (orderId) => {
    if (confirm("⚠️ هل أنت متأكد من حذف هذا الطلب نهائياً من سجلات StorCards؟")) {
        try {
            await deleteDoc(doc(db, "orders", orderId));
        } catch (error) {
            alert("⚠️ خطأ في الحذف: " + error.message);
        }
    }
};

// تشغيل الدالة فور تحميل الملف
listenToOrders();