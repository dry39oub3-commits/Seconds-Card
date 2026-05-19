// public/js/push-notifications.js
import { supabase } from './supabase-config.js';

const VAPID_PUBLIC_KEY = 'BBNACvNXSqWX6ojAjXyJ0KK_hjMo4JVQZYAU8zbuf6VyeiOKwcLxJKvipB6eddVJpKAqArbi2Vn7YJKGoEh4opQ'; // ستولّده لاحقاً

// ==================== تسجيل Service Worker ====================
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications غير مدعوم');
        return null;
    }

    try {
        const reg = await navigator.serviceWorker.register('/service-worker.js');
        console.log('✅ Service Worker مسجّل');
        return reg;
    } catch (err) {
        console.error('❌ فشل تسجيل Service Worker:', err);
        return null;
    }
}

// ==================== طلب الإذن والاشتراك ====================
export async function subscribeToPush(userId) {
    const reg = await registerServiceWorker();
    if (!reg) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn('❌ المستخدم رفض الإشعارات');
        return;
    }

    try {
        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly:      true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        // ✅ حفظ الاشتراك في Supabase
        const subData = subscription.toJSON();
        await supabase.from('push_subscriptions').upsert({
            user_id:  userId,
            endpoint: subData.endpoint,
            p256dh:   subData.keys?.p256dh,
            auth:     subData.keys?.auth,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        console.log('✅ تم الاشتراك في Push Notifications');
        return subscription;
    } catch (err) {
        console.error('❌ فشل الاشتراك:', err);
    }
}

// ==================== إلغاء الاشتراك ====================
export async function unsubscribeFromPush(userId) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;

    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
        await subscription.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('user_id', userId);
        console.log('✅ تم إلغاء الاشتراك');
    }
}

// ==================== Helper ====================
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}