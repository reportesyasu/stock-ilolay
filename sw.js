/* Stock Ilolay: guarda la página en el teléfono para que abra aunque no haya internet.
   Con internet siempre se pide la versión nueva (y se guarda); sin internet, o si tarda demasiado, se usa la guardada.
   Solo toca la página de la app: los pedidos a la base (Supabase) pasan directo. */
const CACHE = 'stock-ilolay-pagina-v1';
const PAGINA = new URL('./', self.registration.scope).href;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(PAGINA, { cache: 'reload' }))).catch(() => { }));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;
  const base = new URL(PAGINA).pathname;
  const esPagina = r.mode === 'navigate' || url.pathname === base || url.pathname === base + 'index.html';
  if (!esPagina) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const red = fetch(r).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') cache.put(PAGINA, resp.clone()).catch(() => { });
      return resp;
    });
    // Si la red no contesta en 6 s y hay una copia guardada, se abre la copia (la red sigue y actualiza la copia para la próxima)
    const guardada = await cache.match(PAGINA);
    if (!guardada) return red;
    return Promise.race([
      red.catch(() => guardada),
      new Promise(res => setTimeout(() => res(guardada), 6000))
    ]);
  })());
});
