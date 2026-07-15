/* =========================================================
   TET Success
   Service Worker
   Production Version
========================================================= */

const CACHE_NAME = "tet-success-v2";

const FILES_TO_CACHE = [

    "./",

    "./index.html",

    "./style.css",

    "./config.js",

    "./supabase.js",

    "./tet_app_settings.js",

    "./common.js",

    "./manifest.json"

];

/* =========================================================
   Install
========================================================= */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FILES_TO_CACHE))

    );

    self.skipWaiting();

});

/* =========================================================
   Activate
========================================================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys =>

            Promise.all(

                keys.map(key => {

                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }

                })

            )

        )

    );

    self.clients.claim();

});

/* =========================================================
   Fetch
========================================================= */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    if (
        url.hostname.includes("supabase.co") ||
        url.hostname.includes("supabase.in") ||
        url.hostname.includes("cdn.jsdelivr.net")
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (event.request.mode === "navigate" || url.pathname.endsWith(".html")) {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(

        caches.match(event.request)

            .then(response => {

                return response || fetch(event.request)

                    .then(networkResponse => {

                        const cloned = networkResponse.clone();

                        caches.open(CACHE_NAME)

                            .then(cache => {

                                cache.put(event.request, cloned);

                            });

                        return networkResponse;

                    })

                    .catch(() => response);

            })

    );

});
