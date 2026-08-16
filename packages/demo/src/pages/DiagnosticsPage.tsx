import { css, type Component } from "dreamland/core";
import { demoSettingsStore } from "../store";
import { requestsState } from "./RequestViewer";

const DiagnosticsView: Component<{}, {}, { status: string; latency: number }> = function () {
	this.status ??= "Not tested";
	this.latency ??= 0;

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
				<div class="card"><span>Captured data</span><strong>{transferred}</strong></div>
			</div>
			<div class="connection-test">
				<div>
					<h3>Wisp test</h3>
					<p>{use(this.status)} {use(this.latency).map((latency) => latency ? `(${latency} ms)` : "")}</p>
				</div>
				<button type="button" on:click={testConnection}>Test connection</button>
			</div>
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
	@media (pointer: coarse) { :scope { padding: 18px; } button { min-height: 44px; font-size: 16px; } }
`;

export default DiagnosticsView;
