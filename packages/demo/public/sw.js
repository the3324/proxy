importScripts(
	new URL("controller/controller.sw.js", self.registration.scope).href
);

const APP_CACHE = "scramjet-app-shell-v1";

addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

addEventListener("fetch", (e) => {
	if ($scramjetController.shouldRoute(e)) {
		e.respondWith($scramjetController.route(e));
	} else if (e.request.method === "GET" && new URL(e.request.url).origin === self.location.origin) {
		e.respondWith(
			fetch(e.request).then((response) => {
				if (response.ok) caches.open(APP_CACHE).then((cache) => cache.put(e.request, response.clone()));
				return response;
			}).catch(() => caches.match(e.request).then((cached) => cached || Response.error()))
		);
	}
});
