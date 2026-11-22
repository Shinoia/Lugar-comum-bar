// Service worker mínimo, exigido pelo Chrome/Android para liberar a opção
// "Instalar app". Ele não guarda nada em cache de propósito: o site sempre
// deve puxar a versão mais nova do servidor (o próprio index.html já tem
// sua lógica de checar versão nova). Isso só existe para o navegador
// considerar o site "instalável".

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// Precisa existir um handler de 'fetch' para o Chrome liberar a instalação,
// mesmo que ele só repasse a requisição direto pra rede (sem cache).
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
