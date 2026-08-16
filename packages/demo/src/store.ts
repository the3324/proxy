import { createStore } from "dreamland/core";

export type AvailableTransports = "libcurl" | "epoxy";
export type BrowserTheme = "midnight" | "graphite" | "ocean";

export const AVAILABLE_TRANSPORTS: ReadonlyArray<{
	value: AvailableTransports;
	label: string;
}> = [
	{ value: "libcurl", label: "Libcurl" },
	{ value: "epoxy", label: "Epoxy" },
];
const DEFAULT_WISP_URL =
	import.meta.env.VITE_WISP_URL ||
	(location.protocol === "https:"
		? "wss://anura.pro/"
		: `ws://${location.host}/wisp/`);
const DEFAULT_TRANSPORT: AvailableTransports = "libcurl";
const IS_APPLE_WEBKIT = /AppleWebKit/i.test(navigator.userAgent) &&
	(/iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const DEFAULT_HOME_URL = "https://google.com";
const DEFAULT_MAX_REQUESTS = 200;
const DEFAULT_APP_NAME = "Scramjet Browser";
const DEFAULT_ACCENT_COLOR = "#60a5fa";
const DEFAULT_COMPACT_MODE = false;
const DEFAULT_THEME: BrowserTheme = "midnight";
const DEFAULT_SHORTCUTS = [
	"now.gg|https://now.gg/",
	"GeForce NOW|https://play.geforcenow.com/",
	"YouTube|https://www.youtube.com/",
	"Reddit|https://www.reddit.com/",
].join("\n");

export const demoSettingsStore = createStore(
	{
		transport: (IS_APPLE_WEBKIT ? "epoxy" : DEFAULT_TRANSPORT) as AvailableTransports,
		wispUrl: DEFAULT_WISP_URL,
		homeUrl: DEFAULT_HOME_URL,
		maxRequests: DEFAULT_MAX_REQUESTS,
		appName: DEFAULT_APP_NAME,
		accentColor: DEFAULT_ACCENT_COLOR,
		compactMode: DEFAULT_COMPACT_MODE,
		theme: DEFAULT_THEME as BrowserTheme,
		shortcuts: DEFAULT_SHORTCUTS,
		streamingMode: false,
		developerMode: true,
		restoreSession: true,
		autoUpdate: true,
		textScale: 100,
		wispFallbacks: "",
		compatibilityMode: "balanced" as "balanced" | "safari" | "low-memory",
		safeMode: false,
		siteProfiles: "now.gg|streaming\nplay.geforcenow.com|streaming\nxbox.com|streaming",
	},
	{
		ident: "scramjet-demo-settings",
		backing: "localstorage",
		autosave: "auto",
	}
);

// One-time migration for existing iPad installs that previously persisted the
// Libcurl default before the Apple compatibility preset existed.
if (IS_APPLE_WEBKIT && localStorage.getItem("scramjet-ipad-transport-v1") !== "1") {
	demoSettingsStore.transport = "epoxy";
	demoSettingsStore.compatibilityMode = "safari";
	localStorage.setItem("scramjet-ipad-transport-v1", "1");
}

export function normalizeWispUrl(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new TypeError("Wisp URL is required.");
	}

	let normalized = trimmed;
	if (!normalized.startsWith("ws://") && !normalized.startsWith("wss://")) {
		normalized = `ws://${normalized}`;
	}

	const parsed = new URL(normalized);
	if (!parsed.pathname || parsed.pathname === "") {
		parsed.pathname = "/";
	}
	if (!parsed.pathname.endsWith("/")) {
		parsed.pathname = `${parsed.pathname}/`;
	}

	return parsed.toString();
}

export function normalizeHomeUrl(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new TypeError("Home page URL is required.");
	}

	const normalized = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
		? trimmed
		: `https://${trimmed}`;

	return new URL(normalized).toString();
}

export function normalizeTransport(value: string): AvailableTransports {
	if (AVAILABLE_TRANSPORTS.some((t) => t.value === value)) {
		return value as AvailableTransports;
	}
	throw new TypeError(`Unknown transport: ${value}`);
}

export function normalizeMaxRequests(value: string | number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new TypeError("Request log limit must be a number.");
	}

	const rounded = Math.round(parsed);
	if (rounded < 10 || rounded > 5000) {
		throw new RangeError("Request log limit must be between 10 and 5000.");
	}

	return rounded;
}

export function normalizeAppName(value: string) {
	const trimmed = value.trim();
	if (!trimmed) throw new TypeError("Browser name is required.");
	if (trimmed.length > 40) throw new RangeError("Browser name must be 40 characters or fewer.");
	return trimmed;
}

export function normalizeAccentColor(value: string) {
	const trimmed = value.trim();
	if (!/^#[0-9a-f]{6}$/i.test(trimmed)) {
		throw new TypeError("Accent color must be a six-digit hex color.");
	}
	return trimmed.toLowerCase();
}

export function normalizeTheme(value: string): BrowserTheme {
	if (value === "midnight" || value === "graphite" || value === "ocean") {
		return value;
	}
	throw new TypeError("Unknown theme preset.");
}

export function parseShortcuts(value: string) {
	const lines = value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length > 8) throw new RangeError("You can add up to 8 shortcuts.");
	return lines.map((line, index) => {
		const separator = line.indexOf("|");
		if (separator < 1) {
			throw new TypeError(`Shortcut ${index + 1} must use Name|URL format.`);
		}
		const name = line.slice(0, separator).trim();
		const rawUrl = line.slice(separator + 1).trim();
		if (!name || name.length > 30) {
			throw new TypeError(`Shortcut ${index + 1} needs a name up to 30 characters.`);
		}
		const url = new URL(rawUrl);
		if (url.protocol !== "https:" && url.protocol !== "http:") {
			throw new TypeError(`Shortcut ${index + 1} must use an HTTP or HTTPS URL.`);
		}
		return { name, url: url.toString() };
	});
}

export function normalizeShortcuts(value: string) {
	return parseShortcuts(value)
		.map(({ name, url }) => `${name}|${url}`)
		.join("\n");
}

export const demoSettingsDefaults = {
	wispUrl: normalizeWispUrl(DEFAULT_WISP_URL),
	transport: IS_APPLE_WEBKIT ? "epoxy" as const : DEFAULT_TRANSPORT,
	homeUrl: normalizeHomeUrl(DEFAULT_HOME_URL),
	maxRequests: DEFAULT_MAX_REQUESTS,
	appName: DEFAULT_APP_NAME,
	accentColor: DEFAULT_ACCENT_COLOR,
	compactMode: DEFAULT_COMPACT_MODE,
	theme: DEFAULT_THEME,
	shortcuts: DEFAULT_SHORTCUTS,
	streamingMode: false,
	developerMode: true,
	restoreSession: true,
	autoUpdate: true,
	textScale: 100,
	wispFallbacks: "",
	compatibilityMode: "balanced" as const,
	safeMode: false,
	siteProfiles: "now.gg|streaming\nplay.geforcenow.com|streaming\nxbox.com|streaming",
};

export function profileForUrl(url: string): "balanced" | "safari" | "streaming" | "safe" | null {
	let hostname: string;
	try { hostname = new URL(url).hostname.toLowerCase(); } catch { return null; }
	for (const line of demoSettingsStore.siteProfiles.split("\n")) {
		const [domain, profile] = line.split("|").map((part) => part.trim().toLowerCase());
		if (!domain || !profile || !(hostname === domain || hostname.endsWith(`.${domain}`))) continue;
		if (profile === "balanced" || profile === "safari" || profile === "streaming" || profile === "safe") return profile;
	}
	return null;
}
