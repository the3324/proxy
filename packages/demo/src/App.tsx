import { css, type Component } from "dreamland/core";
import FlagEditor from "./components/FlagEditor";
import BrowserView from "./pages/BrowserView";
import RequestViewer from "./pages/RequestViewer";
import PlaygroundView from "./pages/Playground";
import SettingsView from "./pages/SettingsPage";
import { Omnibox } from "./pages/BrowserView";
import { requestsState } from "./pages/RequestViewer";
import { demoSettingsStore } from "./store";

const ConnectionStatus: Component<{}, {}, { status: string }> = function (cx) {
	this.status ??= "checking";

	cx.mount = () => {
		let settled = false;
		const socket = new WebSocket(demoSettingsStore.wispUrl);
		const finish = (status: string) => {
			if (settled) return;
			settled = true;
			this.status = status;
			socket.close();
		};
		const timeout = window.setTimeout(() => finish("offline"), 6000);
		socket.addEventListener("open", () => {
			window.clearTimeout(timeout);
			finish("online");
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
						? "Wisp connected"
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
		activeTab: "browser" | "requests" | "playground" | "settings";
	}
> = function (cx) {
	this.activeTab ??= "browser";
	document.title = demoSettingsStore.appName;
	document.documentElement.style.setProperty(
		"--accent",
		demoSettingsStore.accentColor
	);
	const isSafari =
		/^((?!chrome|android).)*safari/i.test(navigator.userAgent) &&
		navigator.vendor.includes("Apple");
	return (
		<div
			class={use(demoSettingsStore.compactMode).map((compact) =>
				compact ? "compact" : ""
			)}
		>
			{isSafari ? (
				<div class="safari-warning">
					Safari may not display proxied images correctly. For the best
					experience, use Chrome, Edge, or another Chromium browser.
				</div>
			) : null}
			<div class="top-bar">
				<div class="tab-bar">
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
					<button
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
					</button>
					<button
						class={use(this.activeTab).map(
							(tab) => `tab-button ${tab === "playground" ? "active" : ""}`
						)}
						on:click={() => {
							this.activeTab = "playground";
						}}
					>
						Playground
					</button>
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
					<FlagEditor inline={true} />
				</div>
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
		display: flex;
		flex-direction: column;
		margin: 0;
		overflow: hidden;
		position: absolute;
		top: 0;
		left: 0;

		padding: 0;
		background: black;
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
		background: #0f0f0f;
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
		background: #3b2f0a;
		border-bottom: 1px solid #8a6d16;
		color: #fde68a;
		font-size: 0.78em;
		line-height: 1.35;
		padding: 0.48em 0.8em;
		text-align: center;
	}
	:scope.compact .tab-button {
		padding: 0.12em 0.45em;
		min-height: 23px;
		font-size: 0.76em;
	}
	:scope.compact .top-actions {
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
