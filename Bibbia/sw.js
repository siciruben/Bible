
/*
 * BIBBIA - Service Worker
 * Modalità offline essenziale
 * Aggiornamento automatico al successivo avvio
 */

'use strict';

const CACHE_NAME = 'bibbia-shell-v1';
const RUNTIME_CACHE = 'bibbia-runtime-v1';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* INSTALLAZIONE */

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(FILES_TO_CACHE);
    })()
  );

  // Non attiviamo forzatamente la nuova versione.
  // Aspetta che le finestre della vecchia versione vengano chiuse.
});

/* ATTIVAZIONE */

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith('bibbia-shell-') &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      // Non cancellare godeep-data-v1:
      // contiene i testi biblici scaricati dall'utente.

      await self.clients.claim();
    })()
  );
});

/* GESTIONE DELLE RICHIESTE */

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Non intercettare richieste verso altri siti.
  if (url.origin !== self.location.origin) return;

  /* PAGINA PRINCIPALE */

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Cerca sempre online la versione più recente.
          const response = await fetch(request);

          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);

            await cache.put(
              './index.html',
              response.clone()
            );
          }

          return response;

        } catch (error) {
          // Senza Internet usa l'ultima versione salvata.
          const cache = await caches.open(CACHE_NAME);

          return (
            await cache.match('./index.html')
          ) || Response.error();
        }
      })()
    );

    return;
  }

  /* RISORSE LOCALI */

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);

        if (
          response &&
          response.ok &&
          response.type === 'basic'
        ) {
          const cache = await caches.open(RUNTIME_CACHE);

          await cache.put(
            request,
            response.clone()
          );
        }

        return response;

      } catch (error) {
        // Prima controlla la cache delle risorse visitate.
        const runtime = await caches.open(RUNTIME_CACHE);

        const cached = await runtime.match(request);

        if (cached) return cached;

        // Poi controlla i testi biblici scaricati.
        const bibleData = await caches.open('godeep-data-v1');

        const downloaded = await bibleData.match(request);

        if (downloaded) return downloaded;

        // Infine prova la cache principale.
        const shell = await caches.open(CACHE_NAME);

        return (
          await shell.match(request)
        ) || Response.error();
      }
    })()
  );
});
