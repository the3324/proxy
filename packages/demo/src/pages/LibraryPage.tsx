import { css, type Component } from "dreamland/core";
import {
	clearBookmarks,
	clearHistory,
	libraryState,
	removeBookmark,
	removeHistory,
	type LibraryEntry,
} from "../library";
import { browserState } from "./BrowserView";

const LibraryList: Component<{
	entries: LibraryEntry[];
	empty: string;
	onRemove: (url: string) => void;
}> = function () {
	return (
		<div class="library-list">
			{use(this.entries).map((entries) =>
				entries.length ? (
					entries.map((entry) => (
						<div class="library-row">
							<button
								class="library-open"
								type="button"
								on:click={() => {
									browserState.url = entry.url;
									browserState.frame?.go(entry.url);
								}}
							>
								<strong>{entry.label}</strong>
								<span>{entry.url}</span>
							</button>
							<button
								class="library-remove"
								type="button"
								aria-label={`Remove ${entry.label}`}
								on:click={() => this.onRemove(entry.url)}
							>
								Remove
							</button>
						</div>
					))
				) : (
					<div class="empty-state">{use(this.empty)}</div>
				)
			)}
		</div>
	);
};

const LibraryView: Component = function () {
	return (
		<div class="library-page">
			<header>
				<div>
					<h2>Library</h2>
					<p>Bookmarks and recent pages are stored only on this device.</p>
				</div>
			</header>
			<section>
				<div class="section-heading">
					<h3>Bookmarks</h3>
					<button type="button" on:click={clearBookmarks}>Clear bookmarks</button>
				</div>
				<LibraryList
					entries={use(libraryState.bookmarks)}
					empty="Bookmark a page with the star button in the address bar."
					onRemove={removeBookmark}
				/>
			</section>
			<section>
				<div class="section-heading">
					<h3>Recent history</h3>
					<button type="button" on:click={clearHistory}>Clear history</button>
				</div>
				<LibraryList
					entries={use(libraryState.history)}
					empty="Pages you visit will appear here."
					onRemove={removeHistory}
				/>
			</section>
		</div>
	);
};

LibraryView.style = css`
	:scope { flex: 1; overflow: auto; background: #0f0f0f; color: #e5e7eb; padding: 22px; font-family: system-ui, sans-serif; }
	header { border-bottom: 1px solid #292929; margin-bottom: 22px; padding-bottom: 14px; }
	h2, h3, p { margin-top: 0; }
	header p { color: #999; margin-bottom: 0; }
	section { max-width: 900px; margin-bottom: 28px; }
	.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.section-heading h3 { margin-bottom: 10px; }
	button { border: 1px solid #343434; background: #191919; color: #ddd; cursor: pointer; min-height: 34px; padding: 7px 10px; }
	.library-list { display: grid; gap: 8px; }
	.library-row { display: flex; border: 1px solid #292929; background: #141414; min-width: 0; }
	.library-open { flex: 1; display: flex; min-width: 0; flex-direction: column; align-items: flex-start; border: 0; background: transparent; text-align: left; }
	.library-open span { color: #888; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.library-remove { flex: 0 0 auto; border-width: 0 0 0 1px; }
	.empty-state { border: 1px dashed #343434; color: #888; padding: 18px; }
	@media (pointer: coarse) { button { min-height: 44px; font-size: 16px; } :scope { padding: 18px; } }
`;

export default LibraryView;
