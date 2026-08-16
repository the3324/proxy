import { css, type Component } from "dreamland/core";
import FlagEditor from "./components/FlagEditor";
import BrowserView from "./pages/BrowserView";
import RequestViewer from "./pages/RequestViewer";
import PlaygroundView from "./pages/Playground";
import SettingsView from "./pages/SettingsPage";
import LibraryView from "./pages/LibraryPage";
import DiagnosticsView from "./pages/DiagnosticsPage";
import { Omnibox } from "./pages/BrowserView";
import { requestsState } from "./pages/RequestViewer";
import { demoSettingsStore } from "./store";

const ConnectionStatus: Component<{}, {}, { status: string; latency: number }> = function (cx) {
	this.status ??= "checking";
	this.latency ??= 0;

	cx.mount = () => {
		const startedAt = performance.now();
		let settled = false;
		const socket = new WebSocket(demoSettingsStore.wispUrl);
		const finish = (status: string, latency = 0) => {
			if (settled) return;
			settled = true;
			this.latency = latency;
			this.status = status;
			socket.close();
		};
		const timeout = window.setTimeout(() => finish("offline"), 6000);
		socket.addEventListener("open", () => {
			window.clearTimeout(timeout);
			finish("online", Math.round(performance.now() - startedAt));
		});
		socket.addEventListener("error", () => {
			window.clearTimeout(timeout);
			finish("offline");
		});
	};

	return (
		<span
			class={use(this.status).map((status) => `connection-status ${status}`)}
			title={`Wisp: ${demoSettingsStore.wispUrl}`}
		>
			<span class="status-dot"></span>
			<span class="status-label">
				{use(this.status).map((status) =>
					status === "online"
						? `Wisp ${this.latency} ms`
						: status === "offline"
							? "Wisp unavailable"
							: "Checking Wisp"
				)}
			</span>
		</span>
	);
};

const App: Component<
	{},
	{},
	{
		activeTab: "browser" | "library" | "requests" | "playground" | "diagnostics" | "settings";
		showSafariWarning: boolean;
		showSetup: boolean;
	}
> = function (cx) {
	this.activeTab ??= "browser";
	document.title = demoSettingsStore.appName;
	document.documentElement.style.setProperty(
		"--accent",
		demoSettingsStore.accentColor
	);
	document.documentElement.style.fontSize = `${demoSettingsStore.textScale}%`;
	const isSafari =
		/^((?!chrome|android).)*safari/i.test(navigator.userAgent) &&
		navigator.vendor.includes("Apple");
	this.showSafariWarning ??=
		isSafari && localStorage.getItem("dismissed-safari-warning") !== "1";
	this.showSetup ??= localStorage.getItem("scramjet-setup-complete-v1") !== "1";
	const finishSetup = (preset: "balanced" | "ipad" | "streaming") => {
		if (preset === "ipad") { demoSettingsStore.transport = "epoxy"; demoSettingsStore.compatibilityMode = "safari"; }
		if (preset === "streaming") { demoSettingsStore.streamingMode = true; demoSettingsStore.compatibilityMode = "low-memory"; demoSettingsStore.maxRequests = 50; }
		localStorage.setItem("scramjet-setup-complete-v1", "1");
		this.showSetup = false;
		location.reload();
	};
	return (
		<div
			class={use(demoSettingsStore.theme, demoSettingsStore.safeMode).map(([theme, safe]) =>
				`theme-${theme || "midnight"} ${safe ? "safe-mode" : ""}`
			)}
		>
			{use(this.showSetup).map((visible) => visible ? <div class="setup-overlay"><div class="setup-card"><h1>Set up Scramjet</h1><p>Choose a starting profile. You can change everything later in Settings.</p><div class="setup-options"><button type="button" on:click={() => finishSetup("ipad")}><strong>iPad / Safari</strong><span>Epoxy and Apple compatibility defaults</span></button><button type="button" on:click={() => finishSetup("streaming")}><strong>Cloud gaming</strong><span>Lower logging and memory usage</span></button><button type="button" on:click={() => finishSetup("balanced")}><strong>Balanced</strong><span>Standard desktop settings</span></button></div></div></div> : null)}
			{use(this.showSafariWarning).map((visible) =>
				visible ? (
					<div class="safari-warning">
					<span>
						Safari may not display proxied images correctly. On iPad, switching
						to Epoxy in Settings may improve compatibility.
					</span>
					<button
						type="button"
						class="warning-close"
						aria-label="Dismiss Safari notice"
						on:click={() => {
							this.showSafariWarning = false;
							localStorage.setItem("dismissed-safari-warning", "1");
						}}
					>
						Dismiss
					</button>
					</div>
				) : null
			)}
			<div
				class={use(demoSettingsStore.compactMode).map((compact) =>
					compact ? "top-bar compact" : "top-bar"
				)}
			>
				<div class="tab-bar">
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "diagnostics" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "diagnostics";
						}}
					>
						Diagnostics
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "library" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "library";
						}}
					>
						Library
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "browser" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "browser";
						}}
					>
						Browser
					</button>
					{use(demoSettingsStore.developerMode).map((enabled) => enabled ? <button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "requests" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "requests";
						}}
					>
						Requests{" "}
						{use(requestsState.requests).map((requests) =>
							requests.length ? `(${requests.length})` : ""
						)}
					</button> : null)}
					{use(demoSettingsStore.developerMode).map((enabled) => enabled ? <button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "playground" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "playground";
						}}
					>
						Playground
					</button> : null)}
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "settings" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "settings";
						}}
					>
						Settings
					</button>
					{use(this.activeTab)
						.map((tab) => tab === "browser")
						.andThen(<Omnibox />)}
				</div>
				<div class="top-actions">
					<ConnectionStatus />
					{use(demoSettingsStore.developerMode).map((enabled) => enabled ? <FlagEditor inline={true} /> : null)}
				</div>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel diagnostics-panel ${tab === "diagnostics" ? "active" : ""}`
				)}
			>
				<DiagnosticsView />
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) => `tab-panel library-panel ${tab === "library" ? "active" : ""}`
				)}
			>
				<LibraryView />
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel browser-panel ${tab === "browser" ? "active" : ""}`
				)}
			>
				<BrowserView
					active={use(this.activeTab).map((tab) => tab === "browser")}
				/>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel requests-panel ${tab === "requests" ? "active" : ""}`
				)}
			>
				<RequestViewer
					active={use(this.activeTab).map((tab) => tab === "requests")}
				/>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel playground-panel ${tab === "playground" ? "active" : ""}`
				)}
			>
				<PlaygroundView
					active={use(this.activeTab).map((tab) => tab === "playground")}
				/>
			</div>
			<div
				class={use(this.activeTab).map(
					(tab) =>
						`tab-panel settings-tab ${tab === "settings" ? "active" : ""}`
				)}
			>
				<SettingsView />
			</div>
		</div>
	);
};

App.style = css`
	@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0");

	:scope {
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		margin: 0;
		overflow: hidden;
		position: absolute;
		top: 0;
		left: 0;

		padding-left: env(safe-area-inset-left, 0);
		padding-right: env(safe-area-inset-right, 0);
		padding-bottom: env(safe-area-inset-bottom, 0);
		background: var(--app-background, #05070c);
		box-sizing: border-box;
	}
	.material-symbols-outlined {
		font-family: "Material Symbols Outlined";
		font-weight: normal;
		font-style: normal;
		font-size: 11px;
		line-height: 1;
		letter-spacing: normal;
		text-transform: none;
		display: inline-block;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-smoothing: antialiased;
	}
	.top-bar {
		display: flex;
		align-items: stretch;
		min-width: 0;
		gap: 0;
		margin-bottom: 0;
		border-bottom: 1px solid #4a4a4a;
		background: var(--toolbar-background, #0f0f0f);
	}
	.tab-bar {
		display: flex;
		flex: 1;
		align-items: stretch;
		gap: 0;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.tab-button {
		flex: 0 0 auto;
		border: 1px solid transparent;
		border-bottom: 0;
		background: transparent;
		color: #a8a8a8;
		padding: 0.24em 0.62em;
		border-radius: 0;
		cursor: pointer;
		font-size: 0.84em;
		line-height: 1.2;
		min-height: 28px;
		margin: 0;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
	}
	.tab-button:hover {
		background: #181818;
		color: #d0d0d0;
	}
	.tab-button.active {
		background: #1f1f1f;
		color: #fff;
		border-color: #4a4a4a;
		margin-bottom: -1px;
		box-shadow: inset 0 -2px var(--accent, #60a5fa);
	}
	.top-actions {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		margin-left: auto;
		padding: 0 0.35em;
		min-height: 28px;
		gap: 0.55em;
	}
	.connection-status {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		color: #a8a8a8;
		font-size: 0.72em;
		white-space: nowrap;
	}
	.status-dot {
		width: 0.55em;
		height: 0.55em;
		border-radius: 999px;
		background: #eab308;
		box-shadow: 0 0 7px currentColor;
	}
	.connection-status.online .status-dot {
		background: var(--accent, #22c55e);
	}
	.connection-status.offline .status-dot {
		background: #ef4444;
	}
	.safari-warning {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75em;
		background: #3b2f0a;
		border-bottom: 1px solid #8a6d16;
		color: #fde68a;
		font-size: 0.78em;
		line-height: 1.35;
		padding: 0.48em 0.8em;
		text-align: center;
	}
	.warning-close {
		border: 1px solid #a18427;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		padding: 0.35em 0.65em;
		font: inherit;
		cursor: pointer;
	}
	.top-bar.compact .tab-button {
		padding: 0.12em 0.45em;
		min-height: 23px;
		font-size: 0.76em;
	}
	.top-bar.compact .top-actions {
		min-height: 23px;
	}
	@media (max-width: 900px) {
		.status-label {
			display: none;
		}
		.top-actions {
			padding-left: 0.15em;
			gap: 0.25em;
		}
	}
	@media (max-width: 1180px) {
		.tab-bar {
			flex-wrap: wrap;
			overflow-x: visible;
		}
	}
	@media (max-width: 640px) {
		.top-bar {
			flex-wrap: wrap;
		}
		.tab-bar {
			flex-basis: 100%;
			order: 1;
		}
		.top-actions {
			width: 100%;
			justify-content: flex-end;
			order: 0;
		}
	}
	@media (pointer: coarse) {
		.tab-button {
			min-height: 44px;
			padding: 0.65em 0.9em;
			font-size: 0.9em;
		}
		.top-bar.compact .tab-button {
			min-height: 38px;
			padding: 0.45em 0.7em;
		}
		.warning-close {
			min-height: 38px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after {
			scroll-behavior: auto !important;
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
	.safe-mode *, .safe-mode *::before, .safe-mode *::after { animation: none !important; transition: none !important; backdrop-filter: none !important; }
	.setup-overlay { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 20px; background: rgba(3, 5, 9, 0.94); }
	.setup-card { width: min(620px, 100%); padding: 24px; border: 1px solid #343b49; background: #11151d; color: #eef2f7; box-sizing: border-box; }
	.setup-card h1 { margin: 0 0 8px; font-size: 1.35rem; }
	.setup-card p { color: #9ca7b6; }
	.setup-options { display: grid; gap: 10px; margin-top: 20px; }
	.setup-options button { display: flex; flex-direction: column; align-items: flex-start; min-height: 64px; padding: 11px 13px; border: 1px solid #343b49; background: #191e28; color: #fff; cursor: pointer; text-align: left; }
	.setup-options button:hover { border-color: var(--accent, #60a5fa); }
	.setup-options span { color: #9ca7b6; margin-top: 4px; }
	:scope.theme-midnight {
		--app-background: #05070c;
		--toolbar-background: #0f1118;
	}
	:scope.theme-graphite {
		--app-background: #111111;
		--toolbar-background: #1b1b1b;
	}
	:scope.theme-ocean {
		--app-background: #03121c;
		--toolbar-background: #072536;
	}
	.tab-panel {
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		display: none;
	}
	.tab-panel.active {
		display: flex;
	}
	.requests-panel {
		flex-direction: column;
	}
	.playground-panel {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}
	.settings-tab {
		width: 100%;
		min-width: 0;
		min-height: 0;
	}
`;
export default App;
