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
        // انتظر حتى يكون الـ Service Worker جاهزاً
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

    // طلب إذن الإشعارات
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn('❌ المستخدم رفض الإشعارات');
        return;
    }

    try {
        // ✅ احذف الـ subscription القديمة دائماً وأنشئ جديدة
        // هذا يضمن أن الـ token دائماً صالح
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
            await existing.unsubscribe();
            console.log('🔄 تم إلغاء الاشتراك القديم');
        }

        // أنشئ subscription جديدة
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly:      true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        const subData = subscription.toJSON();

        // ✅ احذف أي subscription قديمة لنفس المستخدم في قاعدة البيانات
        await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId);

        // ✅ احفظ الـ subscription الجديدة
        const { error } = await supabase
            .from('push_subscriptions')
            .insert({
                user_id:    userId,
                endpoint:   subData.endpoint,
                p256dh:     subData.keys?.p256dh,
                auth:       subData.keys?.auth,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('❌ فشل حفظ الاشتراك في قاعدة البيانات:', error.message);
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
                await subscription.unsubscribe();
            }
        }

        if (userId) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId);
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