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
import { addBookmark, addHistory } from "../library";
import { activeTab, addTab, closeTab, reopenClosed, selectTab, tabsState, updateActiveTab } from "../tabs";

export const browserState = createState({
	url: demoSettingsStore.homeUrl,
	frame: null! as Frame,
});

const isAppleWebKit = /AppleWebKit/i.test(navigator.userAgent) &&
	(/iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

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

function encodeUtf8Base64(value: string) {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
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
		updateActiveTab(browserState.url);
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
						title="Bookmark current page"
						aria-label="Bookmark current page"
						on:click={() => addBookmark(browserState.url)}
					>
						<span class="material-symbols-outlined">star</span>
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
						title="Find in page"
						aria-label="Find in page"
						on:click={() => {
							const query = window.prompt("Find in this page");
							if (query) (browserState.frame?.element.contentWindow as any)?.find?.(query);
						}}
					>
						<span class="material-symbols-outlined">search</span>
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
					on:input={(event: InputEvent) => {
						browserState.url = (event.target as HTMLInputElement).value;
					}}
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
	let touchStartX = 0;
	cx.mount = async () => {
		await controller.wait();
		browserState.frame = controller.createFrame(this.frameel);
		// Scramjet's response cache can retain rewritten/binary responses that
		// WebKit later refuses to decode. Keep it disabled on iPadOS/iOS.
		if (!isAppleWebKit) cachePlugin.install(browserState.frame);
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
		// btoa only accepts Latin-1; encode first so custom names can safely use emoji
		// and non-English characters without breaking browser startup.
		this.frameel.src = `data:text/html;base64,${encodeUtf8Base64(realHomepage)}`;
		initPlugin(browserState.frame);

		let goto = new URL(location.href).searchParams.get("goto");
		if (goto) {
			browserState.frame?.go(goto);
			history.replaceState(null, "", location.href.split("?")[0]);
		} else if (activeTab()?.url && activeTab().url !== demoSettingsStore.homeUrl) {
			browserState.url = activeTab().url;
			browserState.frame?.go(activeTab().url);
		}
	};
	const initPlugin = (frame: Frame) => {
		const plugin = new ScramjetPlugin("url-watcher");
		plugin.tap(frame.hooks.frameInit.post, (context, props) => {
			if (!context.isTopLevel) return;
			browserState.url = context.client.url.href;
			addHistory(context.client.url.href);
			updateActiveTab(context.client.url.href);
			plugin.tap(context.client.hooks.lifecycle.navigate, (context, props) => {
				browserState.url = props.url;
				addHistory(props.url);
				updateActiveTab(props.url);
			});
		});
	};

	return (
		<div
			class={use(this.active).map(
				(active) => `tab-panel browser-view ${active ? "active" : ""}`
			)}
			on:touchstart={(event: TouchEvent) => { touchStartX = event.changedTouches[0]?.screenX ?? 0; }}
			on:touchend={(event: TouchEvent) => {
				const distance = (event.changedTouches[0]?.screenX ?? touchStartX) - touchStartX;
				if (Math.abs(distance) < 90) return;
				if (distance > 0 && touchStartX < 32) browserState.frame?.back();
				if (distance < 0 && touchStartX > window.innerWidth - 32) browserState.frame?.forward();
			}}
		>
			<div class="browser-tabs" role="tablist" aria-label="Browser tabs">
				{use(tabsState.tabs, tabsState.activeId).map(([tabs, activeId]) => tabs.map((tab) => (
					<div class={`browser-tab ${tab.id === activeId ? "active" : ""}`}>
						<button type="button" role="tab" title={tab.url} on:click={() => {
							const selected = selectTab(tab.id);
							if (selected) { browserState.url = selected.url; browserState.frame?.go(selected.url); }
						}}>{tab.title}</button>
						<button type="button" class="close-tab" aria-label={`Close ${tab.title}`} on:click={() => {
							const next = closeTab(tab.id);
							if (next) { browserState.url = next.url; browserState.frame?.go(next.url); }
						}}>×</button>
					</div>
				)))}
				<button type="button" class="tab-tool" title="New tab" on:click={() => {
					const tab = addTab(); browserState.url = tab.url; browserState.frame?.go(tab.url);
				}}>＋</button>
				<button type="button" class="tab-tool" title="Reopen closed tab" on:click={() => {
					const tab = reopenClosed(); if (tab) { browserState.url = tab.url; browserState.frame?.go(tab.url); }
				}}>↶</button>
			</div>
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
	.browser-tabs { display: flex; flex: 0 0 auto; overflow-x: auto; min-height: 34px; background: #0b0d12; border-bottom: 1px solid #292d36; }
	.browser-tab { display: flex; flex: 0 0 min(180px, 35vw); min-width: 0; border-right: 1px solid #292d36; }
	.browser-tab.active { background: #1a1e27; box-shadow: inset 0 -2px var(--accent, #60a5fa); }
	.browser-tab > button:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
	.browser-tabs button { border: 0; background: transparent; color: #c5cad3; padding: 6px 9px; cursor: pointer; }
	.close-tab { flex: 0 0 32px; }
	.tab-tool { flex: 0 0 38px; font-size: 1rem; }
	@media (pointer: coarse) { .browser-tabs { min-height: 44px; } .browser-tabs button { min-height: 44px; font-size: 16px; } }
`;

export default BrowserView;
