import LoadInterstitial from "./components/LoadInterstitial";
import App from "./App";
import LibcurlClient from "@mercuryworkshop/libcurl-transport";
import EpoxyClient from "@mercuryworkshop/epoxy-transport";
import { defaultConfigDev } from "@mercuryworkshop/scramjet";
const { Controller, HttpCachePlugin } = $scramjetController;
import { demoSettingsStore } from "./store";

let app = document.getElementById("app")!;

let controller: InstanceType<typeof Controller>;
const cachePlugin = new HttpCachePlugin();

function appPath(path: string) {
	const cleanPath = path.replace(/^\/+/, "");
	return new URL(cleanPath, document.baseURI).pathname;
}

export function getTransport(): LibcurlClient | EpoxyClient {
	const wispUrl = demoSettingsStore.wispUrl;
	switch (demoSettingsStore.transport) {
		case "epoxy":
			return new EpoxyClient({ wisp: wispUrl });
		case "libcurl":
		default:
			return new LibcurlClient({ wisp: wispUrl });
	}
}

async function waitForControllerOrReady(timeoutMs = 10000): Promise<void> {
	if (navigator.serviceWorker.controller) return;

	await new Promise<void>((resolve) => {
		let settled = false;
		const finish = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			navigator.serviceWorker.removeEventListener("controllerchange", onChange);
			resolve();
		};
		const onChange = () => {
			finish();
		};
		const timeout = window.setTimeout(finish, timeoutMs);
		navigator.serviceWorker.addEventListener("controllerchange", onChange);
		navigator.serviceWorker.ready.then(finish, finish);
	});
}

function showFatalError(title: string, error: unknown) {
	const detail = error instanceof Error ? error.message : String(error);
	const screen = document.createElement("main");
	screen.className = "fatal-error";
	screen.style.cssText = "min-height:100vh;box-sizing:border-box;display:grid;place-items:center;padding:24px;background:#090b10;color:#e5e7eb;font-family:system-ui,-apple-system,sans-serif";
	const card = document.createElement("section");
	card.style.cssText = "width:min(560px,100%);border:1px solid #30343d;background:#11141b;padding:24px";
	const heading = document.createElement("h1");
	heading.textContent = title;
	heading.style.cssText = "font-size:1.25rem;margin:0 0 10px";
	const copy = document.createElement("p");
	copy.textContent = detail;
	copy.style.cssText = "color:#aeb6c4;line-height:1.5;overflow-wrap:anywhere";
	const help = document.createElement("p");
	help.textContent = "Try reloading first. If it continues, clear this site's data in Safari settings or redeploy the latest GitHub Actions build.";
	help.style.cssText = "color:#8d96a5;line-height:1.5";
	const retry = document.createElement("button");
	retry.textContent = "Reload Scramjet";
	retry.style.cssText = "min-height:44px;padding:9px 14px;border:1px solid #60a5fa;background:#172033;color:white;cursor:pointer;font:inherit";
	retry.addEventListener("click", () => location.reload());
	card.append(heading, copy, help, retry);
	screen.append(card);
	app.replaceWith(screen);
}

async function init() {
	const interstitial: any = (
		<LoadInterstitial status={"Loading"}></LoadInterstitial>
	);
	document.body.append(interstitial);
	interstitial.showModal();

	// Initialize Eruda early for debugging
	if (typeof eruda !== 'undefined') {
		eruda.init();
	}

	try {
		const registration = await navigator.serviceWorker.register("./sw.js");

		// Non-blocking progress updates on state transitions.
		const updateStatus = (sw: ServiceWorker | null) => {
			if (!sw) return;
			const set = (msg: string) => (interstitial.$.state.status = msg);
			const apply = () => {
				switch (sw.state) {
					case "installing":
						set("Installing service worker...");
						break;
					case "installed":
						set("Service worker installed, waiting to activate...");
						break;
					case "activating":
						set("Activating service worker...");
						break;
					case "activated":
						set("Service worker activated");
						break;
					case "redundant":
						set("Service worker became redundant");
						break;
				}
			};
			apply();
			sw.addEventListener("statechange", apply);
		};

		updateStatus(registration.installing ?? registration.waiting ?? null);

		// Wait for control or readiness with a timeout; don't hang the UI on updates.
		interstitial.$.state.status =
			"Waiting for service worker to take control...";
		await waitForControllerOrReady(10000);
		interstitial.$.state.status =
			"Service worker ready, waiting for controller init";
		const readySw = navigator.serviceWorker.controller ?? registration.active;
		if (!readySw) {
			throw new Error("No service worker available for controller");
		}
		controller = new Controller({
			serviceworker: readySw,
			transport: getTransport(),
			config: {
				prefix: appPath("~/sj/"),
				scramjetPath: appPath("scramjet/scramjet.js"),
				injectPath: appPath("controller/controller.inject.js"),
				wasmPath: appPath("scramjet/scramjet.wasm"),
				virtualWasmPath: "scramjet.wasm.js",
			},
			scramjetConfig: defaultConfigDev,
		});
		await controller.wait();
		console.log(controller);
		interstitial.$.state.status = "Controller initialized";
		interstitial.close();
		return true;
	} catch (e) {
		console.error("Error during service worker registration:", e);
		// Always close the modal on error to prevent hanging UI.
		try {
			interstitial.close();
		} catch {}
		showFatalError("Scramjet could not start", e);
		return false;
	}
}

async function mount() {
	try {
		const root = <App />;
		app.replaceWith(root);
	} catch (e) {
		showFatalError("The interface could not load", e);
		console.error(err);
		throw e;
	}
}

init().then((ready) => {
	if (ready) mount();
});
export { controller, cachePlugin };
