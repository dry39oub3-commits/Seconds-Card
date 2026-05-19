// public/js/push-notifications.js
import { supabase } from './supabase-config.js';

const VAPID_PUBLIC_KEY = 'BBNACvNXSqWX6ojAjXyJ0KK_hjMo4JVQZYAU8zbuf6VyeiOKwcLxJKvipB6eddVJpKAqArbi2Vn7YJKGoEh4opQ';

// ==================== تسجيل Service Worker ====================
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications غير مدعوم في هذا المتصفح');
        return null;
    }

    try {
        const reg = await navigator.serviceWorker.register('/service-worker.js');
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker مسجّل وجاهز');
        return reg;
    } catch (err) {
        console.error('❌ فشل تسجيل Service Worker:', err);
        return null;
    }
}

// ==================== طلب الإذن والاشتراك ====================
export async function subscribeToPush(userId) {
    if (!userId) {
        console.warn('❌ لا يوجد userId');
        return;
    }

    const reg = await registerServiceWorker();
    if (!reg) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn('❌ المستخدم رفض الإشعارات');
        return;
    }

    try {
        // ✅ احذف الـ subscription القديمة لهذا الجهاز فقط
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', existing.endpoint);

            await existing.unsubscribe();
            console.log('🔄 تم إلغاء الاشتراك القديم لهذا الجهاز');
        }

        // ✅ أنشئ subscription جديدة لهذا الجهاز
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly:      true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        const subData = subscription.toJSON();

        // ✅ احفظ بـ endpoint كـ unique key — يدعم أجهزة متعددة لنفس المستخدم
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id:    userId,
                endpoint:   subData.endpoint,
                p256dh:     subData.keys?.p256dh,
                auth:       subData.keys?.auth,
                updated_at: new Date().toISOString()
            }, { onConflict: 'endpoint' });

        if (error) {
            console.error('❌ فشل حفظ الاشتراك:', error.message);
            return;
        }

        console.log('✅ تم الاشتراك في Push Notifications بنجاح');
        return subscription;

    } catch (err) {
        console.error('❌ فشل الاشتراك:', err);
    }
}

// ==================== إلغاء الاشتراك ====================
export async function unsubscribeFromPush(userId) {
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) {
                // احذف هذا الجهاز فقط من قاعدة البيانات
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', subscription.endpoint);

                await subscription.unsubscribe();
            }
        }

        console.log('✅ تم إلغاء الاشتراك بنجاح');
    } catch (err) {
        console.error('❌ فشل إلغاء الاشتراك:', err);
    }
}

// ==================== Helper ====================
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}