const CACHE_NAME = 'menu-generator-v7';

// 内存中的自定义图标（通过 postMessage 从主线程获取）
let customIcon192 = null;
let customIcon512 = null;

// 预缓存的静态文件
const ASSETS = [
  '/menu-generator/',
  '/menu-generator/index.html',
  '/menu-generator/manifest.json',
  '/menu-generator/data/categories.json',
  '/menu-generator/data/ingredient-units.json',
  '/menu-generator/data/calorie-table.json',
  '/menu-generator/data/nutrition-table.json',
  '/menu-generator/data/category-defaults.json',
  '/menu-generator/data/system-ingredients.json',
  '/menu-generator/data/recipes.json'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 接收主线程传来的图标数据
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'set-icons') {
    if (event.data.icon192) {
      const binary192 = atob(event.data.icon192.split(',')[1]);
      const bytes192 = new Uint8Array(binary192.length);
      for (let i = 0; i < binary192.length; i++) bytes192[i] = binary192.charCodeAt(i);
      customIcon192 = bytes192.buffer;
    }
    if (event.data.icon512) {
      const binary512 = atob(event.data.icon512.split(',')[1]);
      const bytes512 = new Uint8Array(binary512.length);
      for (let i = 0; i < binary512.length; i++) bytes512[i] = binary512.charCodeAt(i);
      customIcon512 = bytes512.buffer;
    }
  }
  if (event.data && event.data.type === 'clear-icons') {
    customIcon192 = null;
    customIcon512 = null;
  }
});

// Fetch: 拦截图标请求，返回自定义图标
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const path = url.pathname;

  // 图标拦截：如果有自定义图标，直接返回（适配子目录部署）
  if (path.endsWith('/icon-192.png') && customIcon192) {
    event.respondWith(
      new Response(customIcon192, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }
      })
    );
    return;
  }
  if (path.endsWith('/icon-512.png') && customIcon512) {
    event.respondWith(
      new Response(customIcon512, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' }
      })
    );
    return;
  }

  // manifest: 永远走网络
  if (path.endsWith('/manifest.json')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 图标文件：网络优先，不缓存
  if (path.includes('/icon-')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 其他文件：网络优先，失败回退缓存
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
