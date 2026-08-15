import { css, type Component } from "dreamland/core";
import { controller, getTransport } from "..";
import { clearBookmarks, clearHistory, libraryState } from "../library";
import {
	AVAILABLE_TRANSPORTS,
	type AvailableTransports,
	type BrowserTheme,
	demoSettingsDefaults,
	demoSettingsStore,
	normalizeHomeUrl,
	normalizeMaxRequests,
	normalizeAppName,
	normalizeAccentColor,
	normalizeTheme,
	normalizeShortcuts,
	normalizeTransport,
	normalizeWispUrl,
} from "../store";

const SettingsView: Component<
	{},
	{
		wispUrlInput: string;
		transportInput: AvailableTransports;
		homeUrlInput: string;
		maxRequestsInput: string;
		appNameInput: string;
		accentColorInput: string;
		compactModeInput: boolean;
		themeInput: BrowserTheme;
		shortcutsInput: string;
		streamingModeInput: boolean;
		developerModeInput: boolean;
		restoreSessionInput: boolean;
		autoUpdateInput: boolean;
		textScaleInput: string;
		wispFallbacksInput: string;
		compatibilityModeInput: "balanced" | "safari" | "low-memory";
		status: string;
		error: string;
	},
	{}
> = function () {
	this.wispUrlInput ??= demoSettingsStore.wispUrl;
	this.transportInput ??= demoSettingsStore.transport;
	this.homeUrlInput ??= demoSettingsStore.homeUrl;
	this.maxRequestsInput ??= String(demoSettingsStore.maxRequests);
	this.appNameInput ??= demoSettingsStore.appName;
	this.accentColorInput ??= demoSettingsStore.accentColor;
	this.compactModeInput ??= demoSettingsStore.compactMode;
	this.themeInput ??= demoSettingsStore.theme ?? demoSettingsDefaults.theme;
	this.shortcutsInput ??=
		demoSettingsStore.shortcuts ?? demoSettingsDefaults.shortcuts;
	this.streamingModeInput ??= demoSettingsStore.streamingMode;
	this.developerModeInput ??= demoSettingsStore.developerMode;
	this.restoreSessionInput ??= demoSettingsStore.restoreSession;
	this.autoUpdateInput ??= demoSettingsStore.autoUpdate;
	this.textScaleInput ??= String(demoSettingsStore.textScale);
	this.wispFallbacksInput ??= demoSettingsStore.wispFallbacks;
	this.compatibilityModeInput ??= demoSettingsStore.compatibilityMode;
	this.status ??= "";
	this.error ??= "";

	const syncInputsFromStore = () => {
		this.wispUrlInput = demoSettingsStore.wispUrl;
		this.transportInput = demoSettingsStore.transport;
		this.homeUrlInput = demoSettingsStore.homeUrl;
		this.maxRequestsInput = String(demoSettingsStore.maxRequests);
		this.appNameInput = demoSettingsStore.appName;
		this.accentColorInput = demoSettingsStore.accentColor;
		this.compactModeInput = demoSettingsStore.compactMode;
		this.themeInput = demoSettingsStore.theme ?? demoSettingsDefaults.theme;
		this.shortcutsInput =
			demoSettingsStore.shortcuts ?? demoSettingsDefaults.shortcuts;
		this.streamingModeInput = demoSettingsStore.streamingMode;
		this.developerModeInput = demoSettingsStore.developerMode;
		this.restoreSessionInput = demoSettingsStore.restoreSession;
		this.autoUpdateInput = demoSettingsStore.autoUpdate;
		this.textScaleInput = String(demoSettingsStore.textScale);
		this.wispFallbacksInput = demoSettingsStore.wispFallbacks;
		this.compatibilityModeInput = demoSettingsStore.compatibilityMode;
	};

	const applySettings = async () => {
		this.error = "";
		this.status = "Applying settings...";

		try {
			const nextWispUrl = normalizeWispUrl(this.wispUrlInput);
			const nextTransport = normalizeTransport(this.transportInput);
			const nextHomeUrl = normalizeHomeUrl(this.homeUrlInput);
			const nextMaxRequests = normalizeMaxRequests(this.maxRequestsInput);
			const nextAppName = normalizeAppName(this.appNameInput);
			const nextAccentColor = normalizeAccentColor(this.accentColorInput);
			const nextTheme = normalizeTheme(this.themeInput);
			const nextShortcuts = normalizeShortcuts(this.shortcutsInput);
			const wispChanged = nextWispUrl !== demoSettingsStore.wispUrl;
			const transportChanged = nextTransport !== demoSettingsStore.transport;

			demoSettingsStore.wispUrl = nextWispUrl;
			demoSettingsStore.transport = nextTransport;
			demoSettingsStore.homeUrl = nextHomeUrl;
			demoSettingsStore.maxRequests = nextMaxRequests;
			demoSettingsStore.appName = nextAppName;
			demoSettingsStore.accentColor = nextAccentColor;
			demoSettingsStore.compactMode = this.compactModeInput;
			demoSettingsStore.theme = nextTheme;
			demoSettingsStore.shortcuts = nextShortcuts;
			demoSettingsStore.streamingMode = this.streamingModeInput;
			demoSettingsStore.developerMode = this.developerModeInput;
			demoSettingsStore.restoreSession = this.restoreSessionInput;
			demoSettingsStore.autoUpdate = this.autoUpdateInput;
			demoSettingsStore.textScale = Math.min(150, Math.max(80, Number(this.textScaleInput) || 100));
			demoSettingsStore.wispFallbacks = this.wispFallbacksInput.trim();
			demoSettingsStore.compatibilityMode = this.compatibilityModeInput;
			if (this.compatibilityModeInput === "safari") demoSettingsStore.transport = "epoxy";
			if (this.compatibilityModeInput === "low-memory") {
				demoSettingsStore.streamingMode = true;
				demoSettingsStore.maxRequests = Math.min(demoSettingsStore.maxRequests, 50);
			}
			document.title = nextAppName;
			document.documentElement.style.setProperty("--accent", nextAccentColor);
			document.documentElement.style.fontSize = `${demoSettingsStore.textScale}%`;

			this.wispUrlInput = nextWispUrl;
			this.transportInput = nextTransport;
			this.homeUrlInput = nextHomeUrl;
			this.maxRequestsInput = String(nextMaxRequests);
			this.appNameInput = nextAppName;
			this.accentColorInput = nextAccentColor;
			this.themeInput = nextTheme;
			this.shortcutsInput = nextShortcuts;

			const presetChangedTransport = demoSettingsStore.transport !== nextTransport;
			this.transportInput = demoSettingsStore.transport;
			this.maxRequestsInput = String(demoSettingsStore.maxRequests);
			this.streamingModeInput = demoSettingsStore.streamingMode;
			if (wispChanged || transportChanged || presetChangedTransport) {
				controller.setTransport(getTransport());
			}
			this.status =
				wispChanged || transportChanged || presetChangedTransport
					? "Settings saved. Transport updated for new requests."
					: "Settings saved.";
		} catch (error) {
			this.status = "";
			this.error =
				error instanceof Error ? error.message : "Failed to apply settings.";
		}
	};

	const resetDefaults = async () => {
		this.error = "";
		this.status = "Resetting settings...";
		this.wispUrlInput = demoSettingsDefaults.wispUrl;
		this.transportInput = demoSettingsDefaults.transport;
		this.homeUrlInput = demoSettingsDefaults.homeUrl;
		this.maxRequestsInput = String(demoSettingsDefaults.maxRequests);
		this.appNameInput = demoSettingsDefaults.appName;
		this.accentColorInput = demoSettingsDefaults.accentColor;
		this.compactModeInput = demoSettingsDefaults.compactMode;
		this.themeInput = demoSettingsDefaults.theme;
		this.shortcutsInput = demoSettingsDefaults.shortcuts;
		this.streamingModeInput = false;
		this.developerModeInput = true;
		this.restoreSessionInput = true;
		this.autoUpdateInput = true;
		this.textScaleInput = "100";
		this.wispFallbacksInput = "";
		this.compatibilityModeInput = "balanced";
		await applySettings();
	};

	const clearLocalData = async () => {
		if (!window.confirm("Clear Scramjet settings, caches, and local browsing data on this device?")) {
			return;
		}
		this.status = "Clearing local data...";
		localStorage.clear();
		sessionStorage.clear();
		await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
		this.status = "Local data cleared. Reloading...";
		window.setTimeout(() => location.reload(), 500);
	};

	const exportBackup = () => {
		const backup = {
			version: 1,
			exportedAt: new Date().toISOString(),
			settings: {
				wispUrl: demoSettingsStore.wispUrl,
				transport: demoSettingsStore.transport,
				homeUrl: demoSettingsStore.homeUrl,
				maxRequests: demoSettingsStore.maxRequests,
				appName: demoSettingsStore.appName,
				accentColor: demoSettingsStore.accentColor,
				compactMode: demoSettingsStore.compactMode,
				theme: demoSettingsStore.theme,
				shortcuts: demoSettingsStore.shortcuts,
				streamingMode: demoSettingsStore.streamingMode,
				developerMode: demoSettingsStore.developerMode,
				restoreSession: demoSettingsStore.restoreSession,
				autoUpdate: demoSettingsStore.autoUpdate,
				textScale: demoSettingsStore.textScale,
				wispFallbacks: demoSettingsStore.wispFallbacks,
				compatibilityMode: demoSettingsStore.compatibilityMode,
			},
			bookmarks: libraryState.bookmarks,
			history: libraryState.history,
		};
		const blob = new Blob([JSON.stringify(backup, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `scramjet-backup-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
		this.status = "Backup downloaded.";
	};

	const importBackup = async (event: Event) => {
		this.error = "";
		try {
			const input = event.target as HTMLInputElement;
			const file = input.files?.[0];
			if (!file) return;
			const backup = JSON.parse(await file.text());
			if (backup?.version !== 1 || !backup.settings) {
				throw new TypeError("That file is not a supported Scramjet backup.");
			}
			const settings = backup.settings;
			demoSettingsStore.wispUrl = normalizeWispUrl(settings.wispUrl);
			demoSettingsStore.transport = normalizeTransport(settings.transport);
			demoSettingsStore.homeUrl = normalizeHomeUrl(settings.homeUrl);
			demoSettingsStore.maxRequests = normalizeMaxRequests(settings.maxRequests);
			demoSettingsStore.appName = normalizeAppName(settings.appName);
			demoSettingsStore.accentColor = normalizeAccentColor(settings.accentColor);
			demoSettingsStore.compactMode = Boolean(settings.compactMode);
			demoSettingsStore.theme = normalizeTheme(settings.theme);
			demoSettingsStore.shortcuts = normalizeShortcuts(settings.shortcuts);
			demoSettingsStore.streamingMode = Boolean(settings.streamingMode);
			demoSettingsStore.developerMode = settings.developerMode !== false;
			demoSettingsStore.restoreSession = settings.restoreSession !== false;
			demoSettingsStore.autoUpdate = settings.autoUpdate !== false;
			demoSettingsStore.textScale = Math.min(150, Math.max(80, Number(settings.textScale) || 100));
			demoSettingsStore.wispFallbacks = typeof settings.wispFallbacks === "string" ? settings.wispFallbacks : "";
			demoSettingsStore.compatibilityMode = settings.compatibilityMode === "safari" || settings.compatibilityMode === "low-memory" ? settings.compatibilityMode : "balanced";
			if (Array.isArray(backup.bookmarks)) {
				localStorage.setItem("scramjet-bookmarks", JSON.stringify(backup.bookmarks.slice(0, 100)));
			}
			if (Array.isArray(backup.history)) {
				localStorage.setItem("scramjet-history", JSON.stringify(backup.history.slice(0, 100)));
			}
			this.status = "Backup restored. Reloading...";
			window.setTimeout(() => location.reload(), 500);
		} catch (error) {
			this.status = "";
			this.error = error instanceof Error ? error.message : "Could not restore backup.";
		}
	};

	const clearCaches = async () => {
		await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
		this.status = "Cached website data cleared.";
	};

	return (
		<div class="settings-panel">
			<div class="settings-header">
				<h2>Browser Settings</h2>
				<p>
					Update runtime settings without rebuilding the demo. Wisp changes
					apply to future requests only.
				</p>
			</div>

			<div class="settings-section-title">Appearance</div>
			<label class="field">
				<span class="label">Browser name</span>
				<input
					type="text"
					maxLength="40"
					value={use(this.appNameInput)}
					on:input={(e: InputEvent) => {
						this.appNameInput = (e.target as HTMLInputElement).value;
					}}
				/>
			</label>

			<label class="field color-field">
				<span class="label">Accent color</span>
				<div class="color-row">
					<input
						type="color"
						value={use(this.accentColorInput)}
						on:input={(e: InputEvent) => {
							this.accentColorInput = (e.target as HTMLInputElement).value;
						}}
					/>
					<code>{use(this.accentColorInput)}</code>
				</div>
			</label>

			<label class="field">
				<span class="label">Theme preset</span>
				<select
					value={use(this.themeInput)}
					on:change={(e: Event) => {
						this.themeInput = (e.target as HTMLSelectElement).value as BrowserTheme;
					}}
				>
					<option value="midnight">Midnight</option>
					<option value="graphite">Graphite</option>
					<option value="ocean">Ocean</option>
				</select>
			</label>

			<label class="toggle-field">
				<input
					type="checkbox"
					checked={use(this.compactModeInput)}
					on:change={(e: Event) => {
						this.compactModeInput = (e.target as HTMLInputElement).checked;
					}}
				/>
				<span>Compact toolbar</span>
			</label>

			<div class="settings-section-title">Connection and browsing</div>
			<label class="field"><span class="label">Compatibility preset</span><select value={use(this.compatibilityModeInput)} on:change={(e: Event) => { this.compatibilityModeInput = (e.target as HTMLSelectElement).value as typeof this.compatibilityModeInput; }}><option value="balanced">Balanced</option><option value="safari">Safari / iPad compatibility</option><option value="low-memory">Low memory / streaming</option></select><span class="hint">Presets apply recommended transport and logging choices when settings are saved.</span></label>
			<label class="toggle-field"><input type="checkbox" checked={use(this.streamingModeInput)} on:change={(e: Event) => { this.streamingModeInput = (e.target as HTMLInputElement).checked; }} /><span>Streaming mode (lower logging and visual overhead)</span></label>
			<label class="toggle-field"><input type="checkbox" checked={use(this.restoreSessionInput)} on:change={(e: Event) => { this.restoreSessionInput = (e.target as HTMLInputElement).checked; }} /><span>Restore browsing tabs after restarting</span></label>
			<label class="toggle-field"><input type="checkbox" checked={use(this.autoUpdateInput)} on:change={(e: Event) => { this.autoUpdateInput = (e.target as HTMLInputElement).checked; }} /><span>Automatically install deployed updates</span></label>
			<label class="toggle-field"><input type="checkbox" checked={use(this.developerModeInput)} on:change={(e: Event) => { this.developerModeInput = (e.target as HTMLInputElement).checked; }} /><span>Developer tools (Requests, Playground and flags)</span></label>
			<label class="field"><span class="label">Text size</span><input type="range" min="80" max="150" step="5" value={use(this.textScaleInput)} on:input={(e: InputEvent) => { this.textScaleInput = (e.target as HTMLInputElement).value; }} /><span class="hint">{use(this.textScaleInput)}%</span></label>

			<label class="field">
				<span class="label">Homepage shortcuts</span>
				<textarea
					rows="6"
					value={use(this.shortcutsInput)}
					spellcheck={false}
					on:input={(e: InputEvent) => {
						this.shortcutsInput = (e.target as HTMLTextAreaElement).value;
					}}
				></textarea>
				<span class="hint">One per line in Name|https://example.com format. Maximum 8.</span>
			</label>

			<label class="field">
				<span class="label">Wisp server</span>
				<input
					type="text"
					value={use(this.wispUrlInput)}
					spellcheck={false}
					on:input={(e: InputEvent) => {
						this.wispUrlInput = (e.target as HTMLInputElement).value;
					}}
				/>
				<span class="hint">Example: ws://localhost:4142/</span>
			</label>

			<label class="field">
				<span class="label">Transport</span>
				<select
					value={use(this.transportInput)}
					on:change={(e: Event) => {
						this.transportInput = (e.target as HTMLSelectElement)
							.value as AvailableTransports;
					}}
				>
					{AVAILABLE_TRANSPORTS.map((option) => (
						<option value={option.value}>{option.label}</option>
					))}
				</select>
				<span class="hint">
					Transport client used to dispatch outbound requests over Wisp.
				</span>
			</label>
			<label class="field"><span class="label">Fallback Wisp servers</span><textarea rows="3" value={use(this.wispFallbacksInput)} spellcheck={false} on:input={(e: InputEvent) => { this.wispFallbacksInput = (e.target as HTMLTextAreaElement).value; }}></textarea><span class="hint">One trusted wss:// endpoint per line. Diagnostics can test these if the main server fails.</span></label>

			<label class="field">
				<span class="label">Home page URL</span>
				<input
					type="text"
					value={use(this.homeUrlInput)}
					spellcheck={false}
					on:input={(e: InputEvent) => {
						this.homeUrlInput = (e.target as HTMLInputElement).value;
					}}
				/>
				<span class="hint">
					Used as the default browser URL and can be pushed into the omnibox.
				</span>
			</label>

			<label class="field">
				<span class="label">Request log limit</span>
				<input
					type="number"
					min="10"
					max="5000"
					step="10"
					value={use(this.maxRequestsInput)}
					on:input={(e: InputEvent) => {
						this.maxRequestsInput = (e.target as HTMLInputElement).value;
					}}
				/>
				<span class="hint">
					Maximum number of captured requests kept in memory.
				</span>
			</label>

			<div class="actions">
				<button type="button" class="primary" on:click={applySettings}>
					Apply Settings
				</button>
				<button type="button" on:click={resetDefaults}>
					Reset Defaults
				</button>
				<button
					type="button"
					on:click={() => {
						syncInputsFromStore();
						this.error = "";
						this.status = "Inputs reverted to saved settings.";
					}}
				>
					Revert Inputs
				</button>
				<button type="button" class="danger" on:click={clearLocalData}>
					Clear Local Data
				</button>
			</div>

			<div class="settings-section-title">Data and privacy</div>
			<p class="privacy-copy">Choose exactly what to remove, or move your setup to another device with a backup file.</p>
			<div class="actions data-actions">
				<button type="button" on:click={exportBackup}>Download Backup</button>
				<label class="file-button">
					Restore Backup
					<input type="file" accept="application/json,.json" on:change={importBackup} />
				</label>
				<button type="button" on:click={clearHistory}>Clear History</button>
				<button type="button" on:click={clearBookmarks}>Clear Bookmarks</button>
				<button type="button" on:click={clearCaches}>Clear Website Cache</button>
			</div>

			{use(this.error).map((error) =>
				error ? <div class="message error">{error}</div> : null
			)}
			{use(this.status).map((status) =>
				status ? <div class="message status">{status}</div> : null
			)}
		</div>
	);
};

SettingsView.style = css`
	:scope {
		display: block;
		flex: 1;
		min-width: 0;
		min-height: 0;
		padding: 16px;
		background: #0f0f0f;
		color: #e5e7eb;
		overflow: auto;
		font-family:
			system-ui,
			-apple-system,
			"Segoe UI",
			sans-serif;
		box-sizing: border-box;
	}

	.settings-header {
		margin-bottom: 16px;
		padding-bottom: 12px;
		border-bottom: 1px solid #222;
	}

	.settings-header h2 {
		margin: 0 0 6px;
		font-size: 1rem;
		font-weight: 600;
	}

	.settings-header p {
		margin: 0;
		color: #a8a8a8;
		line-height: 1.45;
		font-size: 0.84rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 14px;
		max-width: 720px;
	}

	.settings-section-title {
		margin: 20px 0 12px;
		color: #8fbce8;
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.color-row,
	.toggle-field {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.color-row input[type="color"] {
		width: 54px;
		height: 34px;
		padding: 2px;
	}

	.color-row code {
		color: #b8c2cc;
	}

	.toggle-field {
		margin-bottom: 16px;
		font-size: 0.86rem;
	}

	.toggle-field input[type="checkbox"] {
		width: auto;
	}

	.label {
		font-size: 0.84rem;
		font-weight: 600;
		color: #e5e7eb;
	}

	input,
	textarea,
	select {
		width: 100%;
		padding: 0.55em 0.65em;
		border: 1px solid #2a2a2a;
		border-radius: 0;
		background: #111;
		color: #e5e7eb;
		font: inherit;
		font-size: 0.88rem;
		outline: none;
		box-sizing: border-box;
	}

	input:focus,
	textarea:focus,
	select:focus {
		border-color: #4a4a4a;
	}

	select {
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		background-image:
			linear-gradient(45deg, transparent 50%, #8f8f8f 50%),
			linear-gradient(135deg, #8f8f8f 50%, transparent 50%);
		background-position:
			calc(100% - 14px) 50%,
			calc(100% - 9px) 50%;
		background-size:
			5px 5px,
			5px 5px;
		background-repeat: no-repeat;
		padding-right: 28px;
		cursor: pointer;
	}

	textarea {
		resize: vertical;
		min-height: 112px;
		line-height: 1.45;
	}

	.hint {
		color: #8f8f8f;
		font-size: 0.78rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 18px;
	}

	.privacy-copy {
		max-width: 720px;
		color: #999;
		font-size: 0.84rem;
	}

	.file-button {
		display: inline-flex;
		align-items: center;
		border: 1px solid #2a2a2a;
		background: #1a1a1a;
		color: #e5e7eb;
		padding: 0.45em 0.8em;
		cursor: pointer;
		font-size: 0.82rem;
	}

	.file-button input { display: none; }

	button {
		border: 1px solid #2a2a2a;
		border-radius: 0;
		background: #1a1a1a;
		color: #e5e7eb;
		padding: 0.45em 0.8em;
		cursor: pointer;
		font: inherit;
		font-size: 0.82rem;
		line-height: 1.2;
		min-height: 28px;
	}

	button:hover {
		background: #222;
	}

	button.primary {
		border-color: #4a4a4a;
		background: #1f1f1f;
	}

	button.primary:hover {
		background: #262626;
	}

	button.danger {
		border-color: #6b2a2a;
		color: #f3b5b5;
	}

	button.danger:hover {
		background: #351818;
	}

	.message {
		margin-top: 12px;
		padding: 0.65em 0.8em;
		border: 1px solid #2a2a2a;
		background: #111;
		font-size: 0.82rem;
		max-width: 720px;
	}

	.message.error {
		border-color: #5a2a2a;
		color: #e7b0b0;
	}

	.message.status {
		color: #b8c2cc;
	}

	@media (pointer: coarse) {
		:scope {
			padding: 20px max(18px, env(safe-area-inset-left, 0));
		}
		input,
		textarea,
		select,
		button {
			font-size: 16px;
			min-height: 44px;
		}
		.toggle-field {
			min-height: 44px;
		}
		.toggle-field input[type="checkbox"] {
			width: 24px;
			height: 24px;
			min-height: 24px;
		}
	}
`;
export default SettingsView;
