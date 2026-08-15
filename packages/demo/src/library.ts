import { createState } from "dreamland/core";

export type LibraryEntry = {
	url: string;
	label: string;
	visitedAt: number;
};

const BOOKMARKS_KEY = "scramjet-bookmarks";
const HISTORY_KEY = "scramjet-history";

function readEntries(key: string): LibraryEntry[] {
	try {
		const parsed = JSON.parse(localStorage.getItem(key) || "[]");
		return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
	} catch {
		return [];
	}
}

function labelForUrl(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, "") || url;
	} catch {
		return url;
	}
}

export const libraryState = createState({
	bookmarks: readEntries(BOOKMARKS_KEY),
	history: readEntries(HISTORY_KEY),
});

function save() {
	localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(libraryState.bookmarks));
	localStorage.setItem(HISTORY_KEY, JSON.stringify(libraryState.history));
}

export function addBookmark(url: string) {
	if (!/^https?:\/\//i.test(url)) return false;
	if (libraryState.bookmarks.some((entry) => entry.url === url)) return false;
	libraryState.bookmarks = [
		{ url, label: labelForUrl(url), visitedAt: Date.now() },
		...libraryState.bookmarks,
	].slice(0, 100);
	save();
	return true;
}

export function removeBookmark(url: string) {
	libraryState.bookmarks = libraryState.bookmarks.filter(
		(entry) => entry.url !== url
	);
	save();
}

export function addHistory(url: string) {
	if (!/^https?:\/\//i.test(url)) return;
	const entry = { url, label: labelForUrl(url), visitedAt: Date.now() };
	libraryState.history = [
		entry,
		...libraryState.history.filter((item) => item.url !== url),
	].slice(0, 100);
	save();
}

export function removeHistory(url: string) {
	libraryState.history = libraryState.history.filter((entry) => entry.url !== url);
	save();
}

export function clearBookmarks() {
	libraryState.bookmarks = [];
	save();
}

export function clearHistory() {
	libraryState.history = [];
	save();
}
