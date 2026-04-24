const PWA = {
    swRegistration: null,
    pushSubscription: null,
    isSubscribed: false,

    async init() {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
        }

        try {
            // Register service worker
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', this.swRegistration.scope);

            // Check push permission
            await this.checkPushPermission();

            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'PUSH_RECEIVED') {
                    console.log('Push received while app was focused');
                }
            });

        } catch (error) {
            console.error('PWA init failed:', error);
        }
    },

    // Check and request push notification permission
    async checkPushPermission() {
        if (!('PushManager' in window)) {
            console.log('Push notifications not supported');
            return;
        }

        const permission = Notification.permission;
        
        if (permission === 'granted') {
            this.isSubscribed = true;
            await this.subscribeToPush();
        } else if (permission === 'default') {
            // Will request when user clicks a button
            console.log('Push permission not decided yet');
        } else {
            console.log('Push notifications denied');
        }
    },

    // Request notification permission (call from a user action)
    async requestPermission() {
        if (!('Notification' in window)) {
            UI.showToast('Notifications not supported on this device', 'warning');
            return false;
        }

        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            this.isSubscribed = true;
            await this.subscribeToPush();
            UI.showToast('Notifications enabled!', 'success');
            return true;
        } else {
            UI.showToast('Please enable notifications in browser settings', 'error');
            return false;
        }
    },

    // Subscribe to push notifications
    async subscribeToPush() {
        if (!this.swRegistration) return;

        try {
            // Check existing subscription
            let subscription = await this.swRegistration.pushManager.getSubscription();
            
            if (!subscription) {
                // Get VAPID public key from server
                const vapidKey = await this.getVapidPublicKey();
                if (!vapidKey) return;

                const applicationServerKey = this.urlBase64ToUint8Array(vapidKey);

                subscription = await this.swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                });
            }

            this.pushSubscription = subscription;
            
            // Send subscription to server
            await this.saveSubscription(subscription);
            
            console.log('Push subscription:', subscription.endpoint);
        } catch (error) {
            console.error('Push subscription failed:', error);
        }
    },

    // Unsubscribe from push
    async unsubscribeFromPush() {
        if (!this.pushSubscription) return;

        try {
            await this.pushSubscription.unsubscribe();
            await this.deleteSubscription();
            this.pushSubscription = null;
            this.isSubscribed = false;
            console.log('Unsubscribed from push');
        } catch (error) {
            console.error('Unsubscribe failed:', error);
        }
    },

    // Get VAPID public key from server
    async getVapidPublicKey() {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/vapid-public-key`);
            const data = await response.json();
            return data.publicKey;
        } catch (error) {
            console.error('Failed to get VAPID key:', error);
            return null;
        }
    },

    // Save subscription to server
    async saveSubscription(subscription) {
        const token = Auth.getToken();
        if (!token) return;

        try {
            await fetch(`${API_BASE_URL}/notifications/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.toJSON().keys.p256dh,
                        auth: subscription.toJSON().keys.auth
                    }
                })
            });
        } catch (error) {
            console.error('Save subscription failed:', error);
        }
    },

    // Delete subscription from server
    async deleteSubscription() {
        const token = Auth.getToken();
        if (!token || !this.pushSubscription) return;

        try {
            await fetch(`${API_BASE_URL}/notifications/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    endpoint: this.pushSubscription.endpoint
                })
            });
        } catch (error) {
            console.error('Delete subscription failed:', error);
        }
    },

    // Convert VAPID key
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // Show local notification (when app is open)
    showLocalNotification(title, options = {}) {
        if (!this.swRegistration) return;

        this.swRegistration.showNotification(title, {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            ...options
        });
    },

    // Check if app is installed
    isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true;
    },

    // Prompt install (call from a button)
    async promptInstall() {
        if (!window.deferredPrompt) {
            UI.showToast('App is already installed or install not available', 'info');
            return;
        }

        window.deferredPrompt.prompt();
        
        const { outcome } = await window.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User installed PWA');
        }
        
        window.deferredPrompt = null;
    }
};

// Listen for beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    console.log('Install prompt saved');
});

// Initialize PWA when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    PWA.init();
});

window.PWA = PWA;