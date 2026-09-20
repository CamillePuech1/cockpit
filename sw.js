// Cockpit — service worker
// À CHAQUE NOUVELLE VERSION : change VERSION ici ET APP_VERSION dans index.html (même numéro).
const VERSION = '1.1';
const CACHE = 'cockpit-' + VERSION;
const LEGACY_CACHE = 'cockpit-v1'; // cache de la toute première version (sans bandeau de mise à jour)
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload' = toujours télécharger la version fraîche depuis GitHub Pages
    await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    // La première version ne sait pas afficher le bandeau : on bascule directement.
    if (await caches.has(LEGACY_CACHE)) await self.skipWaiting();
    // Sinon, la nouvelle version attend que tu touches « Mettre à jour ».
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  let fromLegacy = false;
  e.waitUntil((async () => {
    const keys = await caches.keys();
    fromLegacy = keys.includes(LEGACY_CACHE);
    // Seuls les fichiers de l'app sont effacés ; tes données (localStorage, photos) ne sont jamais touchées.
    await Promise.all(keys.filter(k => k.startsWith('cockpit') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })().then(async () => {
    // Après activation : recharge une seule fois l'app déjà ouverte pour afficher la nouvelle interface.
    if (!fromLegacy) return;
    const wins = await self.clients.matchAll({ type: 'window' });
    wins.forEach(w => { try { w.navigate(w.url).catch(() => {}); } catch (err) {} });
  }));
});

// Fichiers de l'app servis depuis le cache de la version installée (fonctionne hors connexion).
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true }) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    if (cached) return cached;
    try { return await fetch(req); }
    catch (err) { return (await cache.match('./index.html')) || Response.error(); }
  })());
});
