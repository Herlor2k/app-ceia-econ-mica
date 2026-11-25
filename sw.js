/* Service worker: funciona offline. Ao mudar receitas/fotos, aumente VERSAO. */
const VERSAO = 'ceia-v10';
const ICONES_UI = ['arvore', 'bolo', 'brilho', 'carrinho', 'cesta', 'chama', 'check', 'coquetel', 'coracao', 'coracao-vazio',
  'cozinheira', 'coxa', 'cronometro', 'fechar', 'floco', 'lampada', 'lupa', 'mao', 'prato', 'presente', 'queijo',
  'sacolas', 'salada', 'tachinha', 'tacas'].map(n => `img/ui-web/${n}.webp`);
const SHELL = [
  './', 'index.html', 'css/app.css', 'js/app.js', 'js/sons.js', 'js/produtos.js', 'js/codigos.js', 'js/demo.js', 'data/receitas.js', 'manifest.webmanifest',
  'fonts/bricolage-800.woff2', 'fonts/nunito-sans.woff2',
  'img/logo.webp', 'img/icons/favicon-64.png', 'img/icons/icon-192.png', 'img/icons/icon-512.png', 'img/icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(SHELL.concat(ICONES_UI));
    // baixa todas as fotos para usar sem internet
    try {
      self.window = self;
      importScripts('data/receitas.js');
      const fotos = (self.RECEITAS || []).map(r => r.img).filter(Boolean);
      await Promise.all(fotos.map(u => cache.add(u).catch(() => {})));
    } catch (err) { /* segue sem prÃ©-cache de fotos */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (/^\/(obrigado|extras\/)/.test(new URL(req.url).pathname)) return;   // páginas de obrigado: sempre a versão publicada, fora do cache
  e.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const achado = await cache.match(req, { ignoreSearch: true });
    if (achado) return achado;
    try {
      const resp = await fetch(req);
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    } catch (err) {
      if (req.mode === 'navigate') return cache.match('index.html');
      throw err;
    }
  })());
});
