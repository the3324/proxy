import { createState } from "dreamland/core";
import { demoSettingsStore } from "./store";

export type BrowserTab = { id: string; url: string; title: string };
const KEY = "scramjet-tabs-v1";
const CLOSED_KEY = "scramjet-closed-tabs-v1";

function read(key: string): BrowserTab[] {
	try {
		const value = JSON.parse(localStorage.getItem(key) || "[]");
		return Array.isArray(value) ? value.slice(0, 12) : [];
	} catch { return []; }
}

const saved = demoSettingsStore.restoreSession ? read(KEY) : [];
const initial = saved.length ? saved : [{ id: crypto.randomUUID(), url: demoSettingsStore.homeUrl, title: "Home" }];
export const tabsState = createState({ tabs: initial, activeId: initial[0].id, closed: read(CLOSED_KEY) });

function save() {
	localStorage.setItem(KEY, JSON.stringify(tabsState.tabs));
	localStorage.setItem(CLOSED_KEY, JSON.stringify(tabsState.closed));
}

function title(url: string) {
	try { return new URL(url).hostname.replace(/^www\./, "") || "New tab"; } catch { return "New tab"; }
}

export function activeTab() { return tabsState.tabs.find((tab) => tab.id === tabsState.activeId) ?? tabsState.tabs[0]; }
export function updateActiveTab(url: string) {
	const current = activeTab();
	if (!current) return;
	tabsState.tabs = tabsState.tabs.map((tab) => tab.id === current.id ? { ...tab, url, title: title(url) } : tab);
	save();
}
export function addTab(url = demoSettingsStore.homeUrl) {
	const tab = { id: crypto.randomUUID(), url, title: title(url) };
	tabsState.tabs = [...tabsState.tabs, tab].slice(-8);
	tabsState.activeId = tab.id;
	save();
	return tab;
}
export function selectTab(id: string) { tabsState.activeId = id; save(); return activeTab(); }
export function closeTab(id: string) {
	const tab = tabsState.tabs.find((item) => item.id === id);
	if (!tab) return activeTab();
	const wasActive = tabsState.activeId === id;
	tabsState.closed = [tab, ...tabsState.closed].slice(0, 10);
	let next = tabsState.tabs.filter((item) => item.id !== id);
	if (!next.length) next = [{ id: crypto.randomUUID(), url: demoSettingsStore.homeUrl, title: "Home" }];
	tabsState.tabs = next;
	if (wasActive) tabsState.activeId = next[Math.max(0, next.length - 1)].id;
	save();
	return wasActive ? activeTab() : undefined;
}
export function reopenClosed() {
	const tab = tabsState.closed[0];
	if (!tab) return;
	tabsState.closed = tabsState.closed.slice(1);
	tabsState.tabs = [...tabsState.tabs, tab].slice(-8);
	tabsState.activeId = tab.id;
	save();
	return tab;
}
