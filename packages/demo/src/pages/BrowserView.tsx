import {
	css,
	type Component,
	createState,
} from "dreamland/core";
const { Plugin: ScramjetPlugin, ScramjetHeaders } = window.$scramjet;
import type { Plugin } from "@mercuryworkshop/scramjet";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { cachePlugin, controller } from "..";
import {
	demoSettingsDefaults,
	demoSettingsStore,
	parseShortcuts,
} from "../store";
import homepage from "./homepage.html?raw";

export const browserState = createState({
	url: demoSettingsStore.homeUrl,
	frame: null! as Frame,
});

let keyboardShortcutsInstalled = false;

function escapeHtml(value: string) {
	const entities: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	};
	return value.replace(/[&<>"']/g, (character) => entities[character]!);
}

export const Omnibox: Component = function (cx) {
	const supportsFullscreen =
		typeof document.documentElement.requestFullscreen === "function";
	const navigate = () => {
		const value = browserState.url.trim();
		const isHttpUrl = /^https?:\/\//i.test(value);
		const looksLikeHost = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(value) || value.includes(".");
		browserState.url = isHttpUrl
			? value
			: looksLikeHost
				? `https://${value}`
				: `https://www.google.com/search?q=${encodeURIComponent(value)}`;
		browserState.frame?.go(browserState.url);
	};

	cx.mount = () => {
		if (keyboardShortcutsInstalled) return;
		keyboardShortcutsInstalled = true;
		window.addEventListener("keydown", (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
				event.preventDefault();
				(document.getElementById("search") as HTMLInputElement | null)?.select();
			} else if (event.altKey && event.key === "ArrowLeft") {
				event.preventDefault();
				browserState.frame?.back();
			} else if (event.altKey && event.key === "ArrowRight") {
				event.preventDefault();
				browserState.frame?.forward();
			}
		});
	};
	return (
		<form
			class="url-form"
			on:submit={(e: SubmitEvent) => {
				e.preventDefault();
				navigate();
			}}
		>
			<div class="browser-omnibox-shell">
				<div class="omnibox-nav">
					<button type="button" class="nav-btn" title="Back" aria-label="Back" on:click={() => browserState.frame?.back()}>
						<span class="material-symbols-outlined">arrow_back</span>
					</button>
					<button type="button" class="nav-btn" title="Forward" aria-label="Forward" on:click={() => browserState.frame?.forward()}>
						<span class="material-symbols-outlined">arrow_forward</span>
					</button>
					<button type="button" class="nav-btn" title="Reload" aria-label="Reload" on:click={() => browserState.frame?.reload()}>
						<span class="material-symbols-outlined">refresh</span>
					</button>
					<button
						type="button"
						class="nav-btn"
						title="Home"
						aria-label="Home"
						on:click={() => {
							browserState.url = demoSettingsStore.homeUrl;
							browserState.frame?.go(demoSettingsStore.homeUrl);
						}}
					>
						<span class="material-symbols-outlined">home</span>
					</button>
					<button
						type="button"
						class="nav-btn"
						title="Open current address directly"
						aria-label="Open current address directly"
						on:click={() => window.open(browserState.url, "_blank", "noopener,noreferrer")}
					>
						<span class="material-symbols-outlined">open_in_new</span>
					</button>
					<button
						type="button"
						class="nav-btn"
						title="Copy current address"
						aria-label="Copy current address"
						on:click={() => navigator.clipboard.writeText(browserState.url)}
					>
						<span class="material-symbols-outlined">content_copy</span>
					</button>
					{supportsFullscreen ? <button
						type="button"
						class="nav-btn"
						title="Toggle fullscreen"
						aria-label="Toggle fullscreen"
						on:click={() =>
							document.fullscreenElement
								? document.exitFullscreen()
								: document.documentElement.requestFullscreen()
						}
					>
						<span class="material-symbols-outlined">fullscreen</span>
					</button> : null}
				</div>
				<input
					id="search"
					class="url-input"
					type="text"
					value={use(browserState.url)}
					spellcheck="false"
					placeholder="Enter URL or search..."
				/>
			</div>
		</form>
	);
};
Omnibox.style = css`
	:scope {
		display: flex;
		align-items: center;
		/*padding: 0.25em 0.45em;*/
		background: #0f0f0f;
		border-bottom: 1px solid #2a2a2a;
		min-width: 0;
		width: 100%;
	}
	.browser-omnibox-shell {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.35em;
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 0;
		flex: 1;
	}
	.omnibox-nav {
		display: flex;
		align-items: center;
		gap: 0.15em;
		padding-right: 0.25em;
		border-right: 1px solid #2a2a2a;
	}
	.nav-btn {
		border: 0;
		background: transparent;
		color: #8f8f8f;
		width: 1.5em;
		height: 1.5em;
		padding: 0;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.nav-btn:hover {
		background: #1f1f1f;
		color: #d0d0d0;
	}
	.browser-omnibox-shell .material-symbols-outlined {
		font-size: 15px !important;
		line-height: 1 !important;
		font-variation-settings:
			"OPSZ" 20,
			"wght" 300,
			"FILL" 0,
			"GRAD" 0;
	}
	.url-input {
		box-sizing: border-box;
		width: 100%;
		padding: 0.22em 0.18em;
		font-size: 0.9em;
		border: 1px solid transparent;
		border-radius: 3px;
		background: transparent;
		color: #e5e7eb;
		outline: none;
	}
	.url-input::placeholder {
		color: #6f7680;
	}
	@media (max-width: 1180px) {
		:scope {
			flex: 1 0 100%;
			order: 2;
			padding: 0.35em 0.45em;
		}
		.url-input {
			font-size: 16px;
		}
	}
	@media (pointer: coarse) {
		.nav-btn {
			width: 44px;
			height: 44px;
		}
		.browser-omnibox-shell {
			gap: 0.2em;
		}
		.omnibox-nav {
			overflow-x: auto;
			max-width: 58vw;
		}
		.url-input {
			min-height: 44px;
			font-size: 16px;
		}
	}
`;

const BrowserView: Component<
	{
		active: boolean;
	},
	{},
	{
		frameel: HTMLIFrameElement;
	}
> = function (cx) {
	cx.mount = async () => {
		await controller.wait();
		browserState.frame = controller.createFrame(this.frameel);
		cachePlugin.install(browserState.frame);
		const openfix = new ScramjetPlugin("openfix");
		openfix.tap(
			browserState.frame.hooks.fetch.intercept,
			(context, props) => {
				if (context.request.destination === "document") {
					props.response = {
						body: "",
						status: 302,
						statusText: "Found",
							headers: ScramjetHeaders.fromRawHeaders([
							[
								"Location",
								new URL(
									`?goto=${encodeURIComponent(context.parsed.url.href)}`,
									document.baseURI
								).href,
							],
						]),
					};
				}
			},
			(other: Plugin) => (other.name === cachePlugin.name ? 1 : -1)
		);
		const versionInfo = window.$scramjet.versionInfo ?? {};
		let realHomepage = homepage;
		realHomepage = realHomepage.replaceAll(
			"{{SCRAMJET_VERSION}}",
			String(versionInfo.version ?? "unknown")
		);
		realHomepage = realHomepage.replaceAll(
			"{{SCRAMJET_BUILD}}",
			String(versionInfo.build ?? "unknown")
		);
		realHomepage = realHomepage.replaceAll(
			"{{SCRAMJET_DATE_PRETTY}}",
			new Date(versionInfo.date).toLocaleString(undefined, {
				dateStyle: "short",
				timeStyle: "short",
			})
		);
		realHomepage = realHomepage.replaceAll(
			"{{APP_NAME}}",
			escapeHtml(demoSettingsStore.appName)
		);
		const shortcutMarkup = parseShortcuts(
			demoSettingsStore.shortcuts || demoSettingsDefaults.shortcuts
		)
			.map(
				({ name, url }) =>
					`<a class="quick-link" href="${escapeHtml(url)}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(new URL(url).hostname)}</span></a>`
			)
			.join("");
		realHomepage = realHomepage.replaceAll("{{SHORTCUTS}}", shortcutMarkup);
		this.frameel.src = `data:text/html;base64,${btoa(realHomepage)}`;
		initPlugin(browserState.frame);

		let goto = new URL(location.href).searchParams.get("goto");
		if (goto) {
			browserState.frame?.go(goto);
			history.replaceState(null, "", location.href.split("?")[0]);
		}
	};
	const initPlugin = (frame: Frame) => {
		const plugin = new ScramjetPlugin("url-watcher");
		plugin.tap(frame.hooks.frameInit.post, (context, props) => {
			if (!context.isTopLevel) return;
			browserState.url = context.client.url.href;
			plugin.tap(context.client.hooks.lifecycle.navigate, (context, props) => {
				browserState.url = props.url;
			});
		});
	};

	return (
		<div
			class={use(this.active).map(
				(active) => `tab-panel browser-view ${active ? "active" : ""}`
			)}
		>
			<iframe this={use(this.frameel)}></iframe>
		</div>
	);
};

BrowserView.style = css`
	:scope {
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		display: none;
		flex-direction: column;
	}
	:scope.active {
		display: flex;
	}

	iframe {
		background: white;
		flex: 1;
		border: none;
	}
`;

export default BrowserView;
