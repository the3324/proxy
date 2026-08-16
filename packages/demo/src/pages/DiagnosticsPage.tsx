import { css, type Component } from "dreamland/core";
import { demoSettingsStore } from "../store";
import { requestsState } from "./RequestViewer";
import { controller, getTransport } from "..";

type ImageTestResult = { name: string; passed: boolean };

const DiagnosticsView: Component<{}, {}, { status: string; latency: number; imageResults: ImageTestResult[]; benchmark: string; updateStatus: string }> = function () {
	this.status ??= "Not tested";
	this.latency ??= 0;
	this.imageResults ??= [];
	this.benchmark ??= "Not run";
	this.updateStatus ??= "Not checked";

	const testConnection = () => {
		this.status = "Testing...";
		this.latency = 0;
		const startedAt = performance.now();
		const socket = new WebSocket(demoSettingsStore.wispUrl);
		let finished = false;
		const finish = (status: string) => {
			if (finished) return;
			finished = true;
			this.latency = Math.round(performance.now() - startedAt);
			this.status = status;
			socket.close();
		};
		const timeout = window.setTimeout(() => finish("Timed out"), 8000);
		socket.addEventListener("open", () => {
			window.clearTimeout(timeout);
			finish("Connected");
		});
		socket.addEventListener("error", () => {
			window.clearTimeout(timeout);
			finish("Connection failed");
		});
	};

	const probeWisp = (url: string) => new Promise<number | null>((resolve) => {
		const start = performance.now();
		let socket: WebSocket;
		try { socket = new WebSocket(url); } catch { resolve(null); return; }
		let done = false;
		const finish = (value: number | null) => {
			if (done) return;
			done = true;
			clearTimeout(timeout);
			socket.close();
			resolve(value);
		};
		const timeout = window.setTimeout(() => finish(null), 6000);
		socket.addEventListener("open", () => finish(Math.round(performance.now() - start)));
		socket.addEventListener("error", () => finish(null));
	});

	const benchmarkWisps = async () => {
		this.benchmark = "Testing endpoints...";
		const candidates = [demoSettingsStore.wispUrl, ...demoSettingsStore.wispFallbacks.split("\n").map((url) => url.trim()).filter(Boolean)]
			.filter((url, index, all) => all.indexOf(url) === index);
		const results = await Promise.all(candidates.map(async (url) => ({ url, latency: await probeWisp(url) })));
		const working = results.filter((result): result is { url: string; latency: number } => result.latency !== null).sort((a, b) => a.latency - b.latency);
		if (!working.length) { this.benchmark = "No configured endpoint connected."; return; }
		demoSettingsStore.wispUrl = working[0].url;
		controller.setTransport(getTransport());
		this.benchmark = `Selected ${working[0].url} (${working[0].latency} ms).`;
	};

	const testImage = (name: string, source: string) => new Promise<ImageTestResult>((resolve) => {
		const image = new Image();
		const timeout = window.setTimeout(() => resolve({ name, passed: false }), 4000);
		image.onload = () => { clearTimeout(timeout); resolve({ name, passed: image.naturalWidth > 0 }); };
		image.onerror = () => { clearTimeout(timeout); resolve({ name, passed: false }); };
		image.src = source;
	});

	const runImageTests = async () => {
		this.imageResults = [];
		this.status = "Testing image decoders...";
		this.imageResults = await Promise.all([
			testImage("PNG", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
			testImage("GIF", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="),
			testImage("WebP", "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"),
			testImage("SVG", "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='blue'/%3E%3C/svg%3E"),
			testImage("Local app icon", new URL("./icon.png", document.baseURI).href),
		]);
		this.status = this.imageResults.every((result) => result.passed) ? "Native image decoding passed." : "One or more native image tests failed.";
	};

	const exportDiagnostics = () => {
		const report = {
			generatedAt: new Date().toISOString(),
			build: window.$scramjet?.versionInfo ?? {},
			platform: { userAgent: navigator.userAgent, language: navigator.language, touchPoints: navigator.maxTouchPoints, secureContext: window.isSecureContext },
			settings: { transport: demoSettingsStore.transport, compatibilityMode: demoSettingsStore.compatibilityMode, streamingMode: demoSettingsStore.streamingMode, safeMode: demoSettingsStore.safeMode },
			connection: { status: this.status, latencyMs: this.latency, imageResults: this.imageResults },
			requestSummary: { total: requestsState.requests.length, failed: requestsState.requests.filter((request) => (request.status ?? 0) >= 400).length },
			note: "Browsing history, page URLs, cookies, and request contents are intentionally excluded.",
		};
		const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
		const link = document.createElement("a"); link.href = url; link.download = `scramjet-diagnostics-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
	};

	const checkForUpdate = async () => {
		this.updateStatus = "Checking...";
		try {
			const registration = await navigator.serviceWorker.getRegistration();
			await registration?.update();
			this.updateStatus = registration?.waiting ? "Update downloaded; reload to activate." : "This device has the latest deployed build.";
		} catch { this.updateStatus = "Update check failed. Check the network connection."; }
	};

	const repairAppleImages = async () => {
		this.status = "Clearing cached proxy responses...";
		await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
		this.status = "Cache cleared. Reloading with Epoxy...";
		demoSettingsStore.transport = "epoxy";
		demoSettingsStore.compatibilityMode = "safari";
		window.setTimeout(() => location.reload(), 400);
	};

	const failedRequests = use(requestsState.requests).map(
		(requests) => requests.filter((request) => (request.status ?? 0) >= 400).length
	);
	const transferred = use(requestsState.requests).map((requests) => {
		const bytes = requests.reduce((sum, request) => sum + (request.responseBodySize ?? request.responseBodySizePre ?? 0), 0);
		return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
	});
	const imageFailures = use(requestsState.requests).map((requests) =>
		requests.filter((request) =>
			(request.destination === "image" || request.contentType?.toLowerCase().startsWith("image/")) &&
			(request.status ?? 0) >= 400
		).length
	);

	return (
		<div class="diagnostics-page">
			<header>
				<h2>Connection Diagnostics</h2>
				<p>Use this page when websites, images, or streaming fail to load.</p>
			</header>
			<div class="diagnostic-grid">
				<div class="card"><span>Transport</span><strong>{use(demoSettingsStore.transport)}</strong></div>
				<div class="card"><span>Wisp endpoint</span><strong>{use(demoSettingsStore.wispUrl)}</strong></div>
				<div class="card"><span>Secure context</span><strong>{window.isSecureContext ? "Yes" : "No"}</strong></div>
				<div class="card"><span>Service worker</span><strong>{"serviceWorker" in navigator ? "Supported" : "Unavailable"}</strong></div>
				<div class="card"><span>Captured requests</span><strong>{use(requestsState.requests).map((requests) => requests.length)}</strong></div>
				<div class="card"><span>HTTP errors</span><strong>{failedRequests}</strong></div>
				<div class="card"><span>Image request failures</span><strong>{imageFailures}</strong></div>
				<div class="card"><span>Captured data</span><strong>{transferred}</strong></div>
				<div class="card"><span>Build</span><strong>{String(window.$scramjet?.versionInfo?.build ?? "unknown").slice(0, 12)}</strong></div>
				<div class="card"><span>Network</span><strong>{navigator.onLine ? "Online" : "Offline"}</strong></div>
			</div>
			<div class="connection-test">
				<div>
					<h3>Wisp test</h3>
					<p>{use(this.status)} {use(this.latency).map((latency) => latency ? `(${latency} ms)` : "")}</p>
				</div>
				<button type="button" on:click={testConnection}>Test connection</button>
			</div>
			<div class="connection-test"><div><h3>Automatic Wisp selection</h3><p>{use(this.benchmark)}</p></div><button type="button" on:click={benchmarkWisps}>Benchmark servers</button></div>
			<div class="connection-test"><div><h3>iPad image self-test</h3><p>Tests native PNG, GIF, WebP, SVG, and local-image decoding separately from proxy requests.</p><div class="result-row">{use(this.imageResults).map((results) => results.map((result) => <span class={result.passed ? "pass" : "fail"}>{result.name}: {result.passed ? "Pass" : "Fail"}</span>))}</div></div><button type="button" on:click={runImageTests}>Run image tests</button></div>
			<div class="connection-test"><div><h3>Privacy-safe report</h3><p>Exports device and aggregate diagnostics without history, page URLs, cookies, or request bodies.</p></div><button type="button" on:click={exportDiagnostics}>Download report</button></div>
			<div class="connection-test"><div><h3>Deployment version</h3><p>{use(this.updateStatus)}</p></div><button type="button" on:click={checkForUpdate}>Check for update</button></div>
			<div class="connection-test">
				<div><h3>iPad image repair</h3><p>Clears cached rewritten responses and switches the transport to Epoxy.</p></div>
				<button type="button" on:click={repairAppleImages}>Repair and reload</button>
			</div>
			<div class="help-grid">
				<div><h3>Images missing</h3><p>Try Epoxy in Settings. On Apple devices, Safari/WebKit may still fail on some image formats.</p></div>
				<div><h3>Wisp unavailable</h3><p>Confirm the endpoint begins with wss:// and that your network permits WebSockets.</p></div>
				<div><h3>Site partly loads</h3><p>Open Requests first, reload the page, and inspect entries with status 400 or higher.</p></div>
				<div><h3>Streaming is slow</h3><p>Use a trusted Wisp server close to your location. Public endpoints may be overloaded.</p></div>
			</div>
		</div>
	);
};

DiagnosticsView.style = css`
	:scope { flex: 1; overflow: auto; background: #0f0f0f; color: #e5e7eb; padding: 22px; font-family: system-ui, sans-serif; }
	header { border-bottom: 1px solid #292929; margin-bottom: 20px; padding-bottom: 14px; }
	h2, h3, p { margin-top: 0; }
	header p, .help-grid p, .connection-test p { color: #999; }
	.diagnostic-grid, .help-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; max-width: 1000px; }
	.card, .help-grid > div, .connection-test { border: 1px solid #2b2b2b; background: #151515; padding: 16px; min-width: 0; }
	.card span, .card strong { display: block; }
	.card span { color: #888; font-size: 0.78rem; margin-bottom: 7px; }
	.card strong { overflow: hidden; text-overflow: ellipsis; }
	.connection-test { display: flex; align-items: center; justify-content: space-between; gap: 14px; max-width: 968px; margin: 18px 0; }
	.connection-test h3, .connection-test p { margin-bottom: 4px; }
	button { min-height: 38px; border: 1px solid var(--accent, #60a5fa); background: #1b1b1b; color: #fff; padding: 8px 13px; cursor: pointer; }
	.result-row { display: flex; flex-wrap: wrap; gap: 6px; }
	.result-row span { padding: 3px 7px; border: 1px solid #333; font-size: 0.75rem; }
	.result-row .pass { color: #86efac; border-color: #23633a; }
	.result-row .fail { color: #fca5a5; border-color: #7f1d1d; }
	@media (pointer: coarse) { :scope { padding: 18px; } button { min-height: 44px; font-size: 16px; } }
`;

export default DiagnosticsView;
