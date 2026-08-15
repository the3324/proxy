importScripts(
	new URL("controller/controller.sw.js", self.registration.scope).href
);

addEventListener("message", (event) => {
	if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

addEventListener("fetch", (e) => {
	if ($scramjetController.shouldRoute(e)) {
		e.respondWith($scramjetController.route(e));
	}
});
