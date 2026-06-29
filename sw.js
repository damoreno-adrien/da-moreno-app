const CACHE_NAME = 'da-moreno-v1';

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Force l'activation immédiate
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim()); // Prend le contrôle des pages ouvertes
});

// Le navigateur exige cet événement "fetch" pour autoriser l'installation
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            // Comportement de secours hors-ligne basique
            return new Response('Connexion internet requise.');
        })
    );
});