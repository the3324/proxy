importScripts(
	new URL("controller/controller.sw.js", self.registration.scope).href
);

addEventListener("fetch", (e) => {
	if ($scramjetController.shouldRoute(e)) {
		e.respondWith($scramjetController.route(e));
	}
});
