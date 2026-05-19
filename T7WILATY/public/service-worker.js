self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};

    const options = {
        body:               data.body    || '',
        icon:               data.icon    || '/assets/Icon.png',
        badge:              '/assets/Icon.png',
        tag:                'storecard-notif',
        vibrate:            [200, 100, 200],
        requireInteraction: true,
        silent:             false,
        data:               { url: data.url || '/orders.html' },
        actions: [
            { action: 'view',  title: '📋 عرض الطلب' },
            { action: 'close', title: '✕ إغلاق' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'StoreCard', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'close') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const url = event.notification.data?.url || '/orders.html';
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});