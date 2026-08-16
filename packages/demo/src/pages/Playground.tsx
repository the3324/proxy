import { css, type Component } from "dreamland/core";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import type { ScramjetFetchRequest } from "@mercuryworkshop/scramjet";
import { cachePlugin, controller } from "..";
import Monaco from "../components/Monaco";

const { ScramjetFetchHandler, ScramjetHeaders, BareResponse, rewriteUrl } =
	window.$scramjet;

const DEFAULT_ORIGIN = "https://fakeorigin.com";
const DEFAULT_PREVIEW_URL = `${DEFAULT_ORIGIN}/`;

type PlaygroundFile = {
	path: string;
	content: string;
};

type PlaygroundProject = {
	id: string;
	name: string;
	files: Record<string, string>;
};

const PLAYGROUND_STORAGE_KEY = "scramjet-demo-playground-projects-v1";
const PLAYGROUND_SNAPSHOTS_KEY = "scramjet-demo-playground-snapshots-v1";
const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

const DEFAULT_FILES: PlaygroundFile[] = [
	{
		path: "/index.html",
		content: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Scramjet Playground</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <main>
      <h1>Scramjet Playground</h1>
      <p>Edit files on the left, then reload the preview.</p>
      <button id="btn">Click me</button>
      <pre id="out"></pre>
    </main>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`,
	},
	{
		path: "/style.css",
		content: `:root {
  color-scheme: light dark;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
}
body {
  margin: 0;
  padding: 24px;
  background: #0b1220;
  color: #e5e7eb;
}
main {
  max-width: 720px;
}
button {
  background: #1d4ed8;
  border: 0;
  color: white;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
}
`,
	},
	{
		path: "/main.js",
		content: `const out = document.getElementById("out");
const button = document.getElementById("btn");
if (button && out) {
  button.addEventListener("click", () => {
    out.textContent = "Hello from fakeorigin assets served via Scramjet request hook.";
  });
}
`,
	},
];

const DEFAULT_FILE_MAP = Object.fromEntries(
	DEFAULT_FILES.map((file) => [file.path, file.content])
);

const PROJECT_TEMPLATES: Record<string, Record<string, string>> = {
	blank: { "/index.html": "<!doctype html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>New site</title></head><body><h1>Hello</h1></body></html>\n" },
	portfolio: {
		"/index.html": "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Portfolio</title><link rel=\"stylesheet\" href=\"style.css\"></head><body><main><p class=\"eyebrow\">PORTFOLIO</p><h1>Your Name</h1><p>Designer, developer, and creator.</p><a href=\"mailto:hello@example.com\">Contact me</a></main></body></html>",
		"/style.css": "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#eef2ff;font:18px system-ui}main{max-width:680px;padding:32px}.eyebrow{color:#818cf8;letter-spacing:.2em}h1{font-size:clamp(3rem,10vw,7rem);margin:.1em 0}a{color:#a5b4fc}",
	},
	game: {
		"/index.html": "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Mini Game</title><style>body{margin:0;background:#111827;color:white;font:20px system-ui;text-align:center}canvas{max-width:100%;background:#030712}</style></head><body><h1>Tap Game</h1><p id=\"score\">Score: 0</p><canvas id=\"game\" width=\"600\" height=\"360\"></canvas><script src=\"game.js\"></script></body></html>",
		"/game.js": "const c=document.querySelector('#game'),x=c.getContext('2d'),s=document.querySelector('#score');let score=0,target={x:300,y:180};function draw(){x.clearRect(0,0,c.width,c.height);x.fillStyle='#60a5fa';x.beginPath();x.arc(target.x,target.y,28,0,Math.PI*2);x.fill()}c.addEventListener('pointerdown',e=>{const r=c.getBoundingClientRect(),px=(e.clientX-r.left)*c.width/r.width,py=(e.clientY-r.top)*c.height/r.height;if(Math.hypot(px-target.x,py-target.y)<35){score++;s.textContent='Score: '+score;target={x:40+Math.random()*520,y:40+Math.random()*280};draw()}});draw();",
	},
};

const isTextFile = (file: File) => file.type.startsWith("text/") || /\.(html?|css|js|mjs|cjs|ts|tsx|jsx|json|md|txt|xml|svg|csv)$/i.test(file.name);
const dataUrlBytes = (value: string) => {
	const comma = value.indexOf(",");
	const binary = atob(value.slice(comma + 1));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
};
const isBinaryAsset = (value: string) => /^data:[^;,]+;base64,/i.test(value);

const loadProjects = (): PlaygroundProject[] => {
	try {
		const raw = localStorage.getItem(PLAYGROUND_STORAGE_KEY);
		if (!raw) {
			return [
				{ id: "default", name: "Default", files: { ...DEFAULT_FILE_MAP } },
			];
		}
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) throw new Error("Invalid project format");
		const projects = parsed
			.map((item, index) => {
				if (!item || typeof item !== "object") return null;
				const files =
					item.files && typeof item.files === "object" ? item.files : null;
				if (!files || !Object.keys(files).length) return null;
				return {
					id: String(item.id || `project-${index}`),
					name: String(item.name || `Project ${index + 1}`),
					files: { ...files },
				} as PlaygroundProject;
			})
			.filter(Boolean) as PlaygroundProject[];
		if (!projects.length) {
			return [
				{ id: "default", name: "Default", files: { ...DEFAULT_FILE_MAP } },
			];
		}
		return projects;
	} catch {
		return [{ id: "default", name: "Default", files: { ...DEFAULT_FILE_MAP } }];
	}
};

const saveProjects = (projects: PlaygroundProject[]) => {
	try { localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(projects)); return true; }
	catch { return false; }
};

const languageFromPath = (path: string) => {
	if (path.endsWith(".html")) return "html";
	if (path.endsWith(".css")) return "css";
	if (path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
	if (path.endsWith(".ts")) return "typescript";
	if (path.endsWith(".json")) return "json";
	return "plaintext";
};

const contentTypeFromPath = (path: string) => {
	if (path.endsWith(".html")) return "text/html; charset=utf-8";
	if (path.endsWith(".css")) return "text/css; charset=utf-8";
	if (path.endsWith(".js") || path.endsWith(".mjs"))
		return "text/javascript; charset=utf-8";
	if (path.endsWith(".json")) return "application/json; charset=utf-8";
	if (path.endsWith(".svg")) return "image/svg+xml";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	if (path.endsWith(".gif")) return "image/gif";
	if (path.endsWith(".ico")) return "image/x-icon";
	return "text/plain; charset=utf-8";
};

const normalizeOrigin = (value: string) => {
	const raw = value.trim();
	const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw)
		? raw
		: `https://${raw}`;
	const parsed = new URL(withProtocol);
	return parsed.origin;
};

const normalizePreviewUrl = (value: string, origin: string) => {
	const raw = value.trim();
	if (!raw) return `${origin}/`;
	return new URL(raw, `${origin}/`).href;
};

const normalizeFilePath = (input: string) => {
	let path = input.trim();
	if (!path) return "";
	if (!path.startsWith("/")) path = `/${path}`;
	return path;
};

const displayFilePath = (path: string) => path.replace(/^\//, "");

const requestPathToFilePath = (pathname: string) => {
	let path = decodeURIComponent(pathname || "/");
	if (path === "/" || path === "") {
		path = "/index.html";
	} else if (path.endsWith("/")) {
		path = `${path}index.html`;
	}
	return path;
};

const crcTable = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let value = n;
		for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		table[n] = value >>> 0;
	}
	return table;
})();

const crc32 = (bytes: Uint8Array) => {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
};

const zipProject = (files: Record<string, string>) => {
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	const u16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
	const u32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);
	const allFiles = {
		...files,
		"/start-mac.command": "#!/bin/bash\ncd \"$(dirname \"$0\")\"\nIP=$(ipconfig getifaddr en0 2>/dev/null || echo YOUR-MAC-IP)\necho \"This Mac: http://localhost:8080\"\necho \"Other devices: http://$IP:8080\"\npython3 -m http.server 8080 --bind 0.0.0.0\n",
		"/start-windows.bat": "@echo off\ncd /d %~dp0\necho This computer: http://localhost:8080\necho Find the IPv4 address below, then open http://YOUR-IP:8080 on another device.\nipconfig | findstr /i \"IPv4\"\npy -m http.server 8080 --bind 0.0.0.0\npause\n",
		"/.github/workflows/pages.yml": "name: Deploy site\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\npermissions:\n  contents: read\n  pages: write\n  id-token: write\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment:\n      name: github-pages\n      url: ${{ steps.deployment.outputs.page_url }}\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: .\n      - id: deployment\n        uses: actions/deploy-pages@v4\n",
		"/README_LOCAL_NETWORK.txt": `RUN ON YOUR LOCAL NETWORK\n\n1. Extract this ZIP.\n2. Open Terminal or Command Prompt inside the extracted folder.\n\nMac / Linux:\n  python3 -m http.server 8080 --bind 0.0.0.0\n\nWindows:\n  py -m http.server 8080 --bind 0.0.0.0\n\nOn the host computer open:\n  http://localhost:8080\n\nOn another device using the same Wi-Fi open:\n  http://YOUR-COMPUTER-IP:8080\n\nFind a Mac Wi-Fi address:\n  ipconfig getifaddr en0\n\nFind a Windows address:\n  ipconfig\n\nStop the server with Control+C. Only share on a network you trust.\n`,
	};
	for (const [rawName, content] of Object.entries(allFiles)) {
		const safeName = rawName.replace(/^\/+/, "").split("/").filter((part) => part && part !== "." && part !== "..").join("/");
		if (!safeName) continue;
		const name = encoder.encode(safeName);
		const data = isBinaryAsset(content) ? dataUrlBytes(content) : encoder.encode(content);
		const checksum = crc32(data);
		const local = new Uint8Array(30 + name.length + data.length);
		const localView = new DataView(local.buffer);
		u32(localView, 0, 0x04034b50); u16(localView, 4, 20); u16(localView, 6, 0x0800); u16(localView, 8, 0);
		u32(localView, 14, checksum); u32(localView, 18, data.length); u32(localView, 22, data.length); u16(localView, 26, name.length);
		local.set(name, 30); local.set(data, 30 + name.length); chunks.push(local);
		const entry = new Uint8Array(46 + name.length);
		const entryView = new DataView(entry.buffer);
		u32(entryView, 0, 0x02014b50); u16(entryView, 4, 20); u16(entryView, 6, 20); u16(entryView, 8, 0x0800);
		u32(entryView, 16, checksum); u32(entryView, 20, data.length); u32(entryView, 24, data.length); u16(entryView, 28, name.length); u32(entryView, 42, offset);
		entry.set(name, 46); central.push(entry); offset += local.length;
	}
	const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
	const end = new Uint8Array(22);
	const endView = new DataView(end.buffer);
	u32(endView, 0, 0x06054b50); u16(endView, 8, central.length); u16(endView, 10, central.length); u32(endView, 12, centralSize); u32(endView, 16, offset);
	return new Blob([...chunks, ...central, end], { type: "application/zip" });
};

const PlaygroundView: Component<
	{
		active?: boolean;
	},
	{
		frame: Frame;
		pluginReady: boolean;
		origin: string;
		originInput: string;
		previewUrl: string;
		previewUrlInput: string;
		projects: PlaygroundProject[];
		selectedProjectId: string;
		selectedFile: string;
		editorSplit: number;
		isResizing: boolean;
		previewMode: "iframe" | "rewritten";
		rewrittenBody: string;
		rewrittenContentType: string;
		rewriteStatus: string;
		rewriteFile: string;
		runMenuOpen: boolean;
		networkExported: boolean;
		importStatus: string;
		validationResults: string[];
		previewDevice: "responsive" | "phone" | "ipad" | "desktop";
		consoleLogs: string[];
	},
	{}
> = function (cx) {
	this.pluginReady ??= false;
	this.origin ??= DEFAULT_ORIGIN;
	this.originInput ??= DEFAULT_ORIGIN;
	this.previewUrl ??= DEFAULT_PREVIEW_URL;
	this.previewUrlInput ??= DEFAULT_PREVIEW_URL;
	this.selectedFile ??= "/index.html";
	this.editorSplit ??= 0.58;
	this.isResizing ??= false;
	this.projects ??= loadProjects();
	this.selectedProjectId ??= this.projects[0]?.id ?? "default";
	this.previewMode ??= "iframe";
	this.rewrittenBody ??= "";
	this.rewrittenContentType ??= "";
	this.rewriteStatus ??= "Idle";
	this.rewriteFile ??= "";
	this.runMenuOpen ??= false;
	this.networkExported ??= false;
	this.importStatus ??= "";
	this.validationResults ??= [];
	this.previewDevice ??= "responsive";
	this.consoleLogs ??= [];

	cx.mount = async () => {
		await controller.wait();
		this.frame = controller.createFrame();
		window.addEventListener("message", (event) => {
			if (event.data?.source !== "scramjet-playground-console") return;
			this.consoleLogs = [...this.consoleLogs, `[${event.data.level}] ${event.data.message}`].slice(-100);
		});

		use(this.selectedFile, this.selectedProjectId).listen(() => {
			if (this.previewMode === "rewritten") {
				runRewrite(this.frame);
			}
		});
	};

	const getActiveProject = () =>
		this.projects.find((project) => project.id === this.selectedProjectId) ??
		this.projects[0];

	const getActiveFiles = () => getActiveProject()?.files ?? {};
	if (!getActiveProject()) {
		this.selectedProjectId = this.projects[0]?.id ?? "default";
	}
	if (!(this.selectedFile in getActiveFiles())) {
		this.selectedFile =
			Object.keys(getActiveFiles()).sort()[0] ?? "/index.html";
	}

	const updateProjects = (
		updater: (projects: PlaygroundProject[]) => PlaygroundProject[]
	) => {
		this.projects = updater(this.projects);
		if (!saveProjects(this.projects)) this.importStatus = "Storage is full. Remove large assets or export the project now.";
	};

	const fileToStoredValue = (file: File) => new Promise<string>((resolve, reject) => {
		if (isTextFile(file)) { file.text().then(resolve, reject); return; }
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});

	const importFiles = async (event: Event) => {
		const input = event.target as HTMLInputElement;
		const selected = Array.from(input.files ?? []);
		if (!selected.length) return;
		if (selected.length === 1 && selected[0]!.name.endsWith(".playground.json")) {
			try {
				const backup = JSON.parse(await selected[0]!.text());
				if (backup?.format !== "scramjet-playground-project" || !backup.project?.files) throw new Error("Invalid project backup");
				const restored = { id: `imported-${Date.now()}`, name: String(backup.project.name || "Imported project"), files: { ...backup.project.files } };
				updateProjects((projects) => [...projects, restored]);
				this.selectedProjectId = restored.id; this.selectedFile = Object.keys(restored.files)[0] ?? "/index.html";
				this.importStatus = "Editable Playground project imported.";
			} catch { this.importStatus = "That Playground project backup is invalid."; }
			input.value = ""; return;
		}
		const total = selected.reduce((sum, file) => sum + file.size, 0);
		if (total > MAX_IMPORT_BYTES) { this.importStatus = "Import is larger than 4 MB. Use smaller assets so the browser can save the project."; input.value = ""; return; }
		this.importStatus = `Importing ${selected.length} file${selected.length === 1 ? "" : "s"}...`;
		try {
			const imported: Record<string, string> = {};
			const relativePaths = selected.map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
			const firstFolder = relativePaths[0]?.split("/")[0];
			const stripFolder = Boolean(firstFolder && relativePaths.every((path) => path.startsWith(`${firstFolder}/`)));
			for (let index = 0; index < selected.length; index++) {
				const file = selected[index]!;
				const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
				const path = normalizeFilePath(stripFolder ? relative.slice(firstFolder!.length + 1) : relative);
				if (path) imported[path] = await fileToStoredValue(file);
			}
			updateActiveFiles((files) => ({ ...files, ...imported }));
			this.selectedFile = Object.keys(imported)[0] ?? this.selectedFile;
			this.importStatus = `Imported ${Object.keys(imported).length} file${Object.keys(imported).length === 1 ? "" : "s"}.`;
		} catch { this.importStatus = "One or more files could not be imported."; }
		input.value = "";
	};

	const applyTemplate = (event: Event) => {
		const value = (event.target as HTMLSelectElement).value;
		const template = PROJECT_TEMPLATES[value];
		if (!template) return;
		updateActiveFiles(() => ({ ...template }));
		this.selectedFile = "/index.html";
		this.importStatus = `${value[0]!.toUpperCase()}${value.slice(1)} template applied.`;
		(event.target as HTMLSelectElement).value = "";
	};

	const saveSnapshot = () => {
		const project = getActiveProject();
		if (!project) return;
		try {
			const snapshots = JSON.parse(localStorage.getItem(PLAYGROUND_SNAPSHOTS_KEY) || "[]");
			const next = [{ projectId: project.id, createdAt: Date.now(), files: project.files }, ...(Array.isArray(snapshots) ? snapshots : [])].slice(0, 10);
			localStorage.setItem(PLAYGROUND_SNAPSHOTS_KEY, JSON.stringify(next));
			this.importStatus = "Snapshot saved.";
		} catch { this.importStatus = "Snapshot could not be saved because storage is full."; }
	};

	const restoreSnapshot = () => {
		try {
			const project = getActiveProject();
			const snapshots = JSON.parse(localStorage.getItem(PLAYGROUND_SNAPSHOTS_KEY) || "[]");
			const available = Array.isArray(snapshots) ? snapshots.filter((item) => item.projectId === project?.id) : [];
			if (!available.length) { this.importStatus = "No snapshot exists for this project."; return; }
			const choice = prompt(`Choose a snapshot number:\n${available.map((item, index) => `${index + 1}. ${new Date(item.createdAt).toLocaleString()}`).join("\n")}`, "1");
			const snapshot = available[Math.max(0, Number(choice || 1) - 1)];
			if (!snapshot?.files) return;
			updateActiveFiles(() => ({ ...snapshot.files }));
			this.selectedFile = Object.keys(snapshot.files)[0] ?? "/index.html";
			this.importStatus = "Latest snapshot restored.";
		} catch { this.importStatus = "Snapshot could not be restored."; }
	};

	const searchProject = () => {
		const query = prompt("Search all project files for");
		if (!query) return;
		const match = Object.entries(getActiveFiles()).find(([, content]) => !isBinaryAsset(content) && content.toLowerCase().includes(query.toLowerCase()));
		if (match) { this.selectedFile = match[0]; this.importStatus = `Found in ${displayFilePath(match[0])}.`; }
		else this.importStatus = "No matching text was found.";
	};

	const validateProject = () => {
		const files = getActiveFiles();
		const problems: string[] = [];
		if (!files["/index.html"]) problems.push("Missing /index.html");
		for (const [path, content] of Object.entries(files)) {
			if (isBinaryAsset(content) || !/\.html?$/i.test(path)) continue;
			for (const match of content.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)) {
				const target = match[1]!;
				if (/^(?:https?:|data:|mailto:|tel:)/i.test(target)) continue;
				const resolved = new URL(target, `https://playground.local${path}`).pathname;
				if (!(resolved in files)) problems.push(`${path}: missing ${resolved}`);
			}
		}
		this.validationResults = problems.length ? problems.slice(0, 20) : ["Validation passed: entry page and local asset references look good."];
	};

	const updateActiveFiles = (
		updater: (files: Record<string, string>) => Record<string, string>
	) => {
		const active = getActiveProject();
		if (!active) return;
		updateProjects((projects) =>
			projects.map((project) =>
				project.id === active.id
					? { ...project, files: updater(project.files) }
					: project
			)
		);
	};

	const clampSplit = (value: number) => Math.min(0.72, Math.max(0.38, value));

	const startResize = (event: MouseEvent) => {
		event.preventDefault();
		if (event.button !== 0) return;
		const handle = event.currentTarget as HTMLElement | null;
		if (!handle) return;
		const container = handle.closest(".playground-view") as HTMLElement | null;
		if (!container) return;
		const styles = getComputedStyle(container);
		const paddingLeft = parseFloat(styles.paddingLeft || "0") || 0;
		const paddingRight = parseFloat(styles.paddingRight || "0") || 0;

		const toSplit = (clientX: number) => {
			const rect = container.getBoundingClientRect();
			const contentLeft = rect.left + paddingLeft;
			const contentWidth = rect.width - paddingLeft - paddingRight;
			if (contentWidth <= 0) return this.editorSplit;
			const editorPx = clientX - contentLeft;
			return clampSplit(editorPx / contentWidth);
		};
		this.isResizing = true;
		const previousUserSelect = document.body.style.userSelect;
		document.body.style.userSelect = "none";
		const startSplit = toSplit(event.clientX);
		this.editorSplit = startSplit;
		container.style.setProperty(
			"--editor-pct",
			`${(startSplit * 100).toFixed(2)}%`
		);

		const onMove = (moveEvent: MouseEvent) => {
			const split = toSplit(moveEvent.clientX);
			this.editorSplit = split;
			container.style.setProperty(
				"--editor-pct",
				`${(split * 100).toFixed(2)}%`
			);
		};

		const onUp = () => {
			this.isResizing = false;
			globalThis.removeEventListener("mousemove", onMove);
			globalThis.removeEventListener("mouseup", onUp);
			document.body.style.userSelect = previousUserSelect;
		};

		globalThis.addEventListener("mousemove", onMove);
		globalThis.addEventListener("mouseup", onUp);
	};

	const ensurePlugin = (frame: any) => {
		if (!frame || this.pluginReady) return;
		this.pluginReady = true;

		const Plugin = (globalThis as any).$scramjet?.Plugin;
		if (!Plugin) return;

		const plugin = new Plugin("demo-playground");
		plugin.tap(frame.hooks.fetch.request, (context: any, props: any) => {
			if (!context?.parsed?.url) return;
			if (
				context.request?.method !== "GET" &&
				context.request?.method !== "HEAD"
			)
				return;
			if (context.parsed.url.origin !== this.origin) return;

			const filePath = requestPathToFilePath(context.parsed.url.pathname);
			const files = getActiveFiles();
			const body = files[filePath];
			if (body == null) {
				props.earlyResponse = new Response(
					`Not Found: ${filePath}\n\nAvailable files:\n${Object.keys(files)
						.sort()
						.join("\n")}`,
					{
						status: 404,
						statusText: "Not Found",
						headers: {
							"content-type": "text/plain; charset=utf-8",
							"cache-control": "no-store",
						},
					}
				);
				return;
			}

			let servedBody = body;
			if (!isBinaryAsset(body) && /\.html?$/i.test(filePath)) {
				const consoleBridge = `<script>(()=>{const send=(level,args)=>parent.postMessage({source:'scramjet-playground-console',level,message:args.map(v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch{return String(v)}}).join(' ')},'*');for(const level of ['log','warn','error']){const original=console[level];console[level]=(...args)=>{send(level,args);original.apply(console,args)}}addEventListener('error',event=>send('error',[event.message]));addEventListener('unhandledrejection',event=>send('error',[String(event.reason)]));})();<\/script>`;
				servedBody = /<\/body>/i.test(body) ? body.replace(/<\/body>/i, `${consoleBridge}</body>`) : `${body}${consoleBridge}`;
			}
			const responseBody = isBinaryAsset(servedBody)
				? new Blob([dataUrlBytes(servedBody)], { type: servedBody.slice(5, servedBody.indexOf(";")) })
				: servedBody;
			props.earlyResponse = new Response(
				context.request.method === "HEAD" ? null : responseBody,
				{
					status: 200,
					statusText: "OK",
					headers: {
						"content-type": contentTypeFromPath(filePath),
						"cache-control": "no-store",
					},
				}
			);
		});
	};

	const goPreview = (frame: any, targetUrl?: string) => {
		if (!frame) return;
		try {
			const normalized = normalizePreviewUrl(
				targetUrl ?? this.previewUrlInput,
				this.origin
			);
			this.previewUrl = normalized;
			this.previewUrlInput = normalized;
			frame.go(normalized);
		} catch (error) {
			console.error("Invalid preview URL", error);
		}
	};

	const readBodyText = async (body: unknown): Promise<string> => {
		if (body == null) return "";
		if (typeof body === "string") return body;
		if (body instanceof ArrayBuffer) {
			return new TextDecoder().decode(new Uint8Array(body));
		}
		if (body instanceof Blob) {
			return await body.text();
		}
		if (
			typeof ReadableStream !== "undefined" &&
			body instanceof ReadableStream
		) {
			return await new Response(body).text();
		}
		return String(body);
	};

	const destinationFromPath = (path: string) => {
		if (path.endsWith(".js") || path.endsWith(".mjs")) return "script";
		if (path.endsWith(".css")) return "style";
		if (path.endsWith(".html")) return "document";
		return "document";
	};

	const runRewrite = async (frame: Frame | undefined) => {
		if (!frame) return;
		const filePath = this.selectedFile;
		const files = getActiveFiles();
		const body = files[filePath];
		if (body == null) {
			this.rewriteStatus = "File missing";
			this.rewrittenBody = "";
			this.rewrittenContentType = "";
			this.rewriteFile = filePath;
			return;
		}
		const ct = contentTypeFromPath(filePath);
		this.rewriteFile = filePath;
		this.rewriteStatus = "Rewriting...";

		try {
			const handler = new ScramjetFetchHandler({
				crossOriginIsolated: self.crossOriginIsolated,
				context: frame.context,
				transport: frame.controller.transport,
				async sendSetCookie() {},
				async fetchBlobUrl(url: string) {
					return BareResponse.fromNativeResponse(await fetch(url));
				},
				async fetchDataUrl(url: string) {
					return BareResponse.fromNativeResponse(await fetch(url));
				},
			});

			const originalFetch = handler.client.fetch.bind(handler.client);
			handler.client.fetch = async () =>
				BareResponse.fromNativeResponse(
					new Response(body, {
						status: 200,
						statusText: "OK",
						headers: {
							"content-type": ct,
							"cache-control": "no-store",
						},
					})
				);

			const targetUrl = `${this.origin}${filePath}`;
			const encoded = rewriteUrl(targetUrl, frame.context, {
				//@ts-expect-error
				origin: new URL(location.href),
				//@ts-expect-error
				base: new URL(location.href),
			});

			const request = {
				rawUrl: new URL(encoded, location.href),
				rawClientUrl: new URL(location.href),
				rawReferrer: "",
				destination: destinationFromPath(filePath),
				mode: "navigate",
				referrer: "",
				method: "GET",
				body: null,
				cache: "default",
				initialHeaders: new ScramjetHeaders(),
				clientId: frame.id,
			};

			const rewritten = await handler.handleFetch(
				request as ScramjetFetchRequest
			);
			handler.client.fetch = originalFetch;

			this.rewrittenBody = await readBodyText(rewritten.body);
			this.rewrittenContentType =
				rewritten.headers?.get?.("content-type") || ct;
			this.rewriteStatus = "Done";
		} catch (error) {
			console.error("Playground rewrite failed", error);
			this.rewriteStatus = "Failed";
		}
	};

	const downloadNetworkBundle = () => {
		const project = getActiveProject();
		if (!project) return;
		const blobUrl = URL.createObjectURL(zipProject(project.files));
		const link = document.createElement("a");
		link.href = blobUrl;
		link.download = `${project.name.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "playground-project"}.zip`;
		link.click();
		window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
		this.networkExported = true;
	};

	const downloadBlob = (blob: Blob, name: string) => {
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a"); link.href = url; link.download = name; link.click();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	const exportSingleHtml = () => {
		const files = getActiveFiles();
		const source = files["/index.html"];
		if (!source || isBinaryAsset(source)) { this.importStatus = "A text /index.html file is required for single-file export."; return; }
		const documentCopy = new DOMParser().parseFromString(source, "text/html");
		documentCopy.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((link) => {
			const path = normalizeFilePath(link.getAttribute("href")!.replace(/^\.\//, ""));
			const cssText = files[path];
			if (cssText && !isBinaryAsset(cssText)) { const style = documentCopy.createElement("style"); style.textContent = cssText; link.replaceWith(style); }
		});
		documentCopy.querySelectorAll<HTMLScriptElement>("script[src]").forEach((script) => {
			const path = normalizeFilePath(script.getAttribute("src")!.replace(/^\.\//, ""));
			const jsText = files[path];
			if (jsText && !isBinaryAsset(jsText)) { script.removeAttribute("src"); script.textContent = jsText; }
		});
		documentCopy.querySelectorAll<HTMLElement>("img[src],audio[src],video[src],source[src]").forEach((element) => {
			const raw = element.getAttribute("src");
			if (!raw) return;
			const asset = files[normalizeFilePath(raw.replace(/^\.\//, ""))];
			if (asset && isBinaryAsset(asset)) element.setAttribute("src", asset);
		});
		downloadBlob(new Blob([`<!doctype html>\n${documentCopy.documentElement.outerHTML}`], { type: "text/html" }), "index-single-file.html");
		this.importStatus = "Single-file HTML exported. CSS and JavaScript references were inlined.";
	};

	const exportEditableProject = () => {
		const project = getActiveProject();
		if (!project) return;
		downloadBlob(new Blob([JSON.stringify({ format: "scramjet-playground-project", version: 1, project }, null, 2)], { type: "application/json" }), `${project.name.replace(/[^a-z0-9_-]+/gi, "-") || "project"}.playground.json`);
	};

	const activeSignal = use(this.active ?? false, this.frame).map(
		([active, frame]) => {
			if (active && frame) {
				ensurePlugin(frame);
				if (!frame.element.src) {
					goPreview(frame, this.previewUrl);
				}
			}
			return active;
		}
	);

	return (
		<div
			class={use(this.isResizing).map((dragging) =>
				dragging ? "playground-view resizing" : "playground-view"
			)}
			style={`--editor-pct: ${(this.editorSplit * 100).toFixed(2)}%;`}
		>
			{activeSignal.map(() => null)}
			<div class="editor-column">
				<div class="section-title ide-toolbar"><span>Files</span><div class="ide-actions">
					<label class="tool-button">Import files<input type="file" multiple on:change={importFiles} /></label>
					<label class="tool-button">Import folder<input type="file" multiple webkitdirectory={true} on:change={importFiles} /></label>
					<select class="tool-select" value="" on:change={applyTemplate}><option value="">Template…</option><option value="blank">Blank site</option><option value="portfolio">Portfolio</option><option value="game">Mini game</option></select>
					<button type="button" class="tool-button" on:click={searchProject}>Search</button>
					<button type="button" class="tool-button" on:click={saveSnapshot}>Snapshot</button>
					<button type="button" class="tool-button" on:click={restoreSnapshot}>Restore</button>
					<button type="button" class="tool-button" on:click={validateProject}>Validate</button>
				</div></div>
				{use(this.importStatus).map((status) => status ? <div class="ide-status">{status}</div> : null)}
				{use(this.validationResults).map((results) => results.length ? <div class="validation-results">{results.map((result) => <div>{result}</div>)}</div> : null)}
				<div class="editor-layout">
					<div class="file-tree">
						{use(this.projects, this.selectedProjectId, this.selectedFile).map(
							([projects, selectedProjectId, selectedFile]) => {
								const activeProject =
									projects.find(
										(project) => project.id === selectedProjectId
									) ?? projects[0];
								const files = activeProject?.files ?? {};

								return (
									<div class="tree-sections">
										<div class="tree-section files-shelf">
											<div class="tree-list">
												{Object.keys(files)
													.sort()
													.map((path) => (
														<div
															class={`file-item-row ${selectedFile === path ? "active" : ""}`}
														>
															<button
																class="file-item"
																on:click={() => {
																	this.selectedFile = path;
																}}
															>
																{displayFilePath(path)}
															</button>
															<div class="file-item-actions">
																<button
																	type="button"
																	class="file-item-action rename"
																	on:click={(e: MouseEvent) => {
																		e.preventDefault();
																		e.stopPropagation();
																		const next = normalizeFilePath(
																			prompt("Rename file", path) || ""
																		);
																		if (!next || next === path || next in files)
																			return;
																		const value = files[path];
																		if (value == null) return;
																		updateActiveFiles((current) => {
																			const rest = { ...current };
																			delete rest[path];
																			return { ...rest, [next]: value };
																		});
																		if (this.selectedFile === path)
																			this.selectedFile = next;
																	}}
																	title="Rename file"
																>
																	<span class="material-symbols-outlined">
																		edit
																	</span>
																</button>
																<button
																	type="button"
																	class="file-item-action delete"
																	on:click={(e: MouseEvent) => {
																		e.preventDefault();
																		e.stopPropagation();
																		const paths = Object.keys(files).sort();
																		if (paths.length <= 1) return;
																		updateActiveFiles((current) => {
																			const rest = { ...current };
																			delete rest[path];
																			return rest;
																		});
																		if (this.selectedFile === path) {
																			const remaining = Object.keys(files)
																				.filter((x) => x !== path)
																				.sort();
																			this.selectedFile =
																				remaining[0] ?? "/index.html";
																		}
																	}}
																	title="Delete file"
																>
																	<span class="material-symbols-outlined">
																		delete
																	</span>
																</button>
															</div>
														</div>
													))}
											</div>
											<button
												class="file-item file-new"
												on:click={() => {
													const next = normalizeFilePath(
														prompt("New file path", "/new-file.txt") || ""
													);
													if (!next || next in files) return;
													updateActiveFiles((current) => ({
														...current,
														[next]: "",
													}));
													this.selectedFile = next;
												}}
											>
												+ New file
											</button>
										</div>
										<div class="tree-split-bar" />
										<div class="tree-section projects-shelf">
											<div class="tree-title-row">
												<span class="tree-title">Projects</span>
												<button
													type="button"
													class="project-header-action"
													on:click={() => {
														const name = (
															prompt("Project name", "New Project") || ""
														).trim();
														if (!name) return;
														const id = `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
														const project: PlaygroundProject = {
															id,
															name,
															files: { ...DEFAULT_FILE_MAP },
														};
														updateProjects((current) => [...current, project]);
														this.selectedProjectId = id;
														this.selectedFile = "/index.html";
													}}
													title="Create project"
												>
													<span class="material-symbols-outlined">add</span>
												</button>
											</div>
											<div class="tree-list projects-list">
												{projects.map((project) => (
													<div
														class={`project-item-row ${project.id === selectedProjectId ? "active" : ""}`}
													>
														<button
															class="project-item"
															on:click={() => {
																this.selectedProjectId = project.id;
																const paths = Object.keys(project.files).sort();
																this.selectedFile = paths.includes(
																	this.selectedFile
																)
																	? this.selectedFile
																	: (paths[0] ?? "/index.html");
															}}
														>
															{project.name}
														</button>
														<button
															type="button"
															class="project-item-action"
															on:click={(e: MouseEvent) => {
																e.preventDefault();
																e.stopPropagation();
																const next = (
																	prompt("Rename project", project.name) || ""
																).trim();
																if (!next || next === project.name) return;
																updateProjects((current) =>
																	current.map((item) =>
																		item.id === project.id
																			? { ...item, name: next }
																			: item
																	)
																);
															}}
															title="Rename project"
														>
															<span class="material-symbols-outlined">
																edit
															</span>
														</button>
														<button
															type="button"
															class="project-item-action delete"
															on:click={(e: MouseEvent) => {
																e.preventDefault();
																e.stopPropagation();
																if (projects.length <= 1) return;
																const remaining = projects.filter(
																	(item) => item.id !== project.id
																);
																const nextProject = remaining[0];
																updateProjects((current) =>
																	current.filter(
																		(item) => item.id !== project.id
																	)
																);
																if (
																	this.selectedProjectId === project.id &&
																	nextProject
																) {
																	this.selectedProjectId = nextProject.id;
																	this.selectedFile =
																		Object.keys(nextProject.files).sort()[0] ??
																		"/index.html";
																}
															}}
															title="Delete project"
														>
															<span class="material-symbols-outlined">
																delete
															</span>
														</button>
													</div>
												))}
											</div>
										</div>
									</div>
								);
							}
						)}
					</div>
					<div class="editor-pane">
						<div class="editor-header">
							{use(this.selectedFile).map((path) => displayFilePath(path))}
						</div>
						<Monaco
							value={use(
								this.selectedFile,
								this.projects,
								this.selectedProjectId
							).map(([selected, projects, selectedProjectId]) => {
								const active =
									projects.find(
										(project) => project.id === selectedProjectId
									) ?? projects[0];
								const value = active?.files[selected] ?? "";
								return isBinaryAsset(value) ? `[Binary asset: ${displayFilePath(selected)}]\nThis file is preserved for preview and export.` : value;
							})}
							language={use(this.selectedFile).map((selected) =>
								languageFromPath(selected)
							)}
							readOnly={use(this.selectedFile, this.projects, this.selectedProjectId).map(([selected, projects, projectId]) => isBinaryAsset((projects.find((project) => project.id === projectId)?.files[selected]) ?? ""))}
							fill={true}
							onSave={() => {
								goPreview(this.frame, this.previewUrl);
								if (this.previewMode === "rewritten") {
									runRewrite(this.frame);
								}
							}}
							onChange={(value) => {
								const selected = this.selectedFile;
								const files = getActiveFiles();
								if (!(selected in files) || isBinaryAsset(files[selected]!)) return;
								updateActiveFiles((current) => ({
									...current,
									[selected]: value,
								}));
							}}
						/>
					</div>
				</div>
			</div>
			<div class="split-handle" on:mousedown={startResize} />
			<div class="preview-column">
				<div class="preview-tab-strip">
					<button
						type="button"
						class={use(this.previewMode).map(
							(m) => `preview-tab ${m === "iframe" ? "active" : ""}`
						)}
						on:click={() => {
							this.previewMode = "iframe";
						}}
					>
						Preview
					</button>
					<button
						type="button"
						class={use(this.previewMode).map(
							(m) => `preview-tab ${m === "rewritten" ? "active" : ""}`
						)}
						on:click={() => {
							this.previewMode = "rewritten";
							runRewrite(this.frame);
						}}
					>
						Rewritten
					</button>
					<select class="device-select" value={use(this.previewDevice)} on:change={(event: Event) => { this.previewDevice = (event.target as HTMLSelectElement).value as typeof this.previewDevice; }}><option value="responsive">Responsive</option><option value="phone">Phone</option><option value="ipad">iPad</option><option value="desktop">Desktop</option></select>
					<button type="button" class="run-project-button" on:click={() => { this.runMenuOpen = !this.runMenuOpen; }}>Run project</button>
				</div>
				{use(this.runMenuOpen).map((open) => open ? <div class="run-panel">
					<div class="run-option"><div><strong>This device</strong><span>Runs immediately in the private Scramjet preview on this device.</span></div><button type="button" on:click={() => { this.previewMode = "iframe"; goPreview(this.frame, this.previewUrl); this.runMenuOpen = false; }}>Run here</button></div>
					<div class="run-option"><div><strong>Local network or GitHub Pages</strong><span>Exports a ZIP with Mac/Windows server launchers and an automatic GitHub Pages workflow.</span></div><button type="button" on:click={downloadNetworkBundle}>Download publish ZIP</button></div>
					<div class="run-option"><div><strong>Single HTML file</strong><span>Combines index.html with referenced local CSS and JavaScript for easy sharing.</span></div><button type="button" on:click={exportSingleHtml}>Export HTML</button></div>
					<div class="run-option"><div><strong>Editable project backup</strong><span>Saves all Playground files and project metadata for later recovery.</span></div><button type="button" on:click={exportEditableProject}>Export project</button></div>
					{use(this.networkExported).map((ready) => ready ? <div class="network-steps"><strong>Next steps</strong><ol><li>Extract the downloaded ZIP on the host computer.</li><li>Open Terminal in that folder.</li><li>Run <code>python3 -m http.server 8080 --bind 0.0.0.0</code> on Mac/Linux, or <code>py -m http.server 8080 --bind 0.0.0.0</code> on Windows.</li><li>Other devices open <code>http://YOUR-COMPUTER-IP:8080</code>.</li></ol><p>The ZIP also contains these instructions. Use only on a network you trust.</p></div> : null)}
				</div> : null)}
				<details class="project-console"><summary>Console ({use(this.consoleLogs).map((logs) => logs.length)})</summary><div class="console-toolbar"><button type="button" on:click={() => { this.consoleLogs = []; }}>Clear</button></div><pre>{use(this.consoleLogs).map((logs) => logs.length ? logs.join("\n") : "No project logs yet.")}</pre></details>
				{use(this.previewMode)
					.map((mode) => mode === "iframe")
					.andThen(
						<form
							class="preview-omnibox"
							on:submit={(e: SubmitEvent) => {
								e.preventDefault();
								goPreview(this.frame);
							}}
						>
							<div class="omnibox-shell">
								<div class="omnibox-nav" aria-hidden="true">
									<button type="button" class="nav-btn">
										<span class="material-symbols-outlined">arrow_back</span>
									</button>
									<button type="button" class="nav-btn">
										<span class="material-symbols-outlined">arrow_forward</span>
									</button>
									<button
										type="button"
										class="nav-btn"
										on:click={() => {
											goPreview(this.frame, this.previewUrl);
										}}
									>
										<span class="material-symbols-outlined">refresh</span>
									</button>
								</div>
								<input
									type="text"
									value={use(this.previewUrlInput)}
									spellcheck={false}
									on:input={(e: InputEvent) => {
										this.previewUrlInput = (e.target as HTMLInputElement).value;
									}}
									placeholder="Enter URL or search..."
								/>
							</div>
						</form>
					)}
				{use(this.previewMode)
					.map((mode) => mode === "rewritten")
					.andThen(
						<div class="rewrite-meta">
							<span class="rewrite-meta-file">
								{use(this.rewriteFile).map((p) =>
									p ? displayFilePath(p) : ""
								)}
							</span>
							<button
								type="button"
								class="rewrite-refresh"
								on:click={() => runRewrite(this.frame)}
								title="Re-run rewrite"
							>
								<span class="material-symbols-outlined">refresh</span>
							</button>
							<span class="rewrite-meta-status">
								{use(this.rewriteStatus).map((s) => s)}
							</span>
							<span class="rewrite-meta-ct">
								{use(this.rewrittenContentType).map((ct) => ct || "")}
							</span>
						</div>
					)}
				<div
					class={use(this.previewMode).map(
						(m) => `preview-body preview-body-${m}`
					)}
				>
					<div
						class={use(this.previewMode, this.previewDevice).map(
							([m, device]) => `preview-frame device-${device} ${m === "iframe" ? "active" : "hidden"}`
						)}
					>
						{use(this.frame).map((f) => f?.element)}
					</div>
					<div
						class={use(this.previewMode).map(
							(m) => `rewrite-pane ${m === "rewritten" ? "active" : "hidden"}`
						)}
					>
						<Monaco
							value={use(this.rewrittenBody)}
							language={use(this.rewriteFile, this.rewrittenContentType).map(
								([file]) => languageFromPath(file)
							)}
							readOnly={true}
							fill={true}
						/>
					</div>
				</div>
				<form
					class="origin-bar"
					on:submit={(e: SubmitEvent) => {
						e.preventDefault();
						try {
							const nextOrigin = normalizeOrigin(this.originInput);
							this.origin = nextOrigin;
							const nextUrl = `${nextOrigin}/`;
							this.previewUrl = nextUrl;
							this.previewUrlInput = nextUrl;
							goPreview(this.frame, nextUrl);
							if (this.previewMode === "rewritten") {
								runRewrite(this.frame);
							}
						} catch (error) {
							console.error("Invalid fake origin", error);
						}
					}}
				>
					<div class="origin-shell">
						<span class="origin-prefix">Fake origin</span>
						<input
							type="text"
							value={use(this.originInput)}
							spellcheck={false}
							on:input={(e: InputEvent) => {
								this.originInput = (e.target as HTMLInputElement).value;
							}}
							placeholder="https://fakeorigin.com"
						/>
					</div>
				</form>
			</div>
		</div>
	);
};

PlaygroundView.style = css`
	@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0");

	:scope {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		padding: 0;
		font-family:
			system-ui,
			-apple-system,
			"Segoe UI",
			Roboto,
			"Helvetica Neue",
			Arial,
			sans-serif;
		color: #e5e5e5;
	}
	.material-symbols-outlined {
		font-family: "Material Symbols Outlined";
		font-weight: normal;
		font-style: normal;
		font-size: 16px;
		line-height: 1;
		letter-spacing: normal;
		text-transform: none;
		display: inline-block;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-smoothing: antialiased;
	}
	.playground-view {
		display: flex;
		flex: 1;
		width: 100%;
		min-width: 0;
		min-height: 0;
		gap: 0;
		overflow: hidden;
		padding: 0;
		border-radius: 0;
		border: 1px solid #222;
		background: #0f0f0f;
		position: relative;
	}
	.playground-view.resizing {
		cursor: col-resize;
	}
	.playground-view.resizing iframe {
		pointer-events: none;
	}
	.split-handle {
		width: 9px;
		flex: 0 0 auto;
		margin: 0;
		border-radius: 0;
		background: transparent;
		cursor: col-resize;
		touch-action: none;
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(var(--editor-pct, 58%) - 4.5px);
		z-index: 3;
	}
	.split-handle::before {
		content: "";
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		transform: translateX(-50%);
		background: #2a2a2a;
		pointer-events: none;
	}
	.split-handle:hover {
		background: transparent;
	}
	.split-handle:hover::before {
		background: #4a4a4a;
	}
	.editor-column,
	.preview-column {
		background: transparent;
		border: 0;
		border-radius: 0;
		padding: 0;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		box-shadow: none;
	}
	.editor-column {
		flex: 0 0 var(--editor-pct, 58%);
		gap: 0;
	}
	.preview-column {
		flex: 1 1 0;
		gap: 0;
		border-left: 0;
	}
	.section-title {
		color: #aaa;
		font-size: 0.72em;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-weight: 600;
		padding: 0.7em 0.9em;
		border-bottom: 1px solid #222;
		background: #111;
	}
	.ide-toolbar { display: flex; align-items: center; gap: 10px; overflow-x: auto; padding: 0.45em 0.7em; }
	.ide-toolbar > span { flex: 0 0 auto; }
	.ide-actions { display: flex; align-items: center; gap: 5px; margin-left: auto; }
	.tool-button, .tool-select { flex: 0 0 auto; border: 1px solid #30343b; background: #191b20; color: #d1d5db; padding: 5px 7px; font: inherit; font-size: 0.92em; letter-spacing: 0; text-transform: none; cursor: pointer; }
	.tool-button input { display: none; }
	.ide-status { padding: 5px 9px; border-bottom: 1px solid #273143; background: #111827; color: #a5b4fc; font-size: 0.72em; }
	.validation-results { max-height: 100px; overflow: auto; padding: 6px 9px; border-bottom: 1px solid #3f3518; background: #29220e; color: #fde68a; font-size: 0.72em; line-height: 1.4; }
	.editor-layout {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr);
		flex: 1;
		min-width: 0;
		min-height: 0;
		gap: 0;
	}
	.file-tree {
		border-right: 1px solid #222;
		border-radius: 0;
		background: #111;
		padding: 0.35em 0.3em;
		overflow: hidden;
		min-height: 0;
	}
	.tree-sections {
		display: grid;
		grid-template-rows: minmax(0, 1fr) 9px minmax(0, 1fr);
		gap: 0;
		height: 100%;
		min-height: 0;
	}
	.tree-section {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border: 0;
		background: transparent;
	}
	.tree-section.files-shelf {
		padding-bottom: 0.25em;
	}
	.tree-section.projects-shelf {
		padding-top: 0.25em;
	}
	.tree-split-bar {
		position: relative;
	}
	.tree-split-bar::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		transform: translateY(-50%);
		background: #2a2a2a;
	}
	.tree-title,
	.tree-title-row {
		color: #aaa;
		font-size: 0.72em;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-weight: 600;
		padding: 0.2em 0.25em 0.4em;
		border-bottom: 0;
	}
	.tree-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.tree-list {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.15em;
		padding: 0.2em 0;
	}
	.projects-list {
		padding-right: 0.1em;
	}
	.project-header-action {
		border: 0;
		background: transparent;
		color: #8f8f8f;
		padding: 0.1em;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.project-header-action:hover {
		background: #1f1f1f;
		color: #d0d0d0;
	}
	.project-header-action .material-symbols-outlined {
		font-size: 14px;
	}
	.project-item-row {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding-right: 0.2em;
		border-radius: 4px;
		min-height: 28px;
	}
	.project-item-row:hover {
		background: #171717;
	}
	.project-item-row.active {
		background: #1f1f1f;
		position: relative;
	}
	.project-item-row.active::before {
		content: "";
		position: absolute;
		left: 0;
		top: 3px;
		bottom: 3px;
		width: 2px;
		background: #6b7280;
		border-radius: 999px;
	}
	.project-item {
		flex: 1;
		min-width: 0;
		text-align: left;
		border: 0;
		background: transparent;
		color: #d1d5db;
		padding: 0.35em 0.55em;
		font-size: 0.8em;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}
	.project-item-row:hover .project-item,
	.project-item-row.active .project-item {
		color: #fff;
	}
	.project-item-action {
		border: 0;
		background: transparent;
		color: #8f8f8f;
		padding: 0.16em;
		border-radius: 3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		cursor: pointer;
	}
	.project-item-row:hover .project-item-action,
	.project-item-row:focus-within .project-item-action {
		opacity: 1;
	}
	.project-item-action:hover {
		background: #2a2a2a;
		color: #d0d0d0;
	}
	.project-item-action.delete {
		color: #c87b7b;
	}
	.project-item-action .material-symbols-outlined {
		font-size: 14px;
	}
	.file-item {
		flex: 1;
		min-width: 0;
		text-align: left;
		background: transparent;
		color: #d1d5db;
		border: 0;
		border-radius: 4px;
		padding: 0.35em 0.55em;
		font-size: 0.8em;
		line-height: 1.2;
		font-family: inherit;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition:
			background-color 120ms ease,
			color 120ms ease;
	}
	.file-item-row {
		display: flex;
		align-items: center;
		gap: 0.3em;
		border-radius: 4px;
		padding-right: 0.2em;
		min-height: 28px;
	}
	.file-item-row:hover {
		background: #171717;
	}
	.file-item-row:hover .file-item {
		color: #ffffff;
	}
	.file-item-row.active {
		background: #1f1f1f;
		position: relative;
	}
	.file-item-row.active .file-item {
		color: #fff;
	}
	.file-item-row.active::before {
		content: "";
		position: absolute;
		left: 0;
		top: 3px;
		bottom: 3px;
		width: 2px;
		background: #6b7280;
		border-radius: 999px;
	}
	.file-item-actions {
		display: flex;
		align-items: center;
		gap: 0.2em;
		opacity: 0;
		transition: opacity 120ms ease;
	}
	.file-item-actions:hover,
	.file-item-actions:focus-within {
		opacity: 1;
	}
	.file-item-action {
		border: 0;
		background: transparent;
		color: #9ca3af;
		padding: 0.16em;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.file-item-action.rename {
		color: #78b879;
	}
	.file-item-action.delete {
		color: #c87b7b;
	}
	.file-item-action .material-symbols-outlined {
		font-size: 14px;
	}
	.file-item-action:hover {
		background: #2a2a2a;
		filter: brightness(1.1);
	}
	.file-item.file-new {
		flex: 0 0 auto;
		margin-top: 0.25em;
		color: #d1d5db;
		width: 100%;
	}
	.editor-pane {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		border: 0;
		border-radius: 0;
		padding: 0;
		background: #111;
		gap: 0;
	}
	.editor-header {
		color: #9ca3af;
		font-size: 0.8em;
		font-family: inherit;
		padding: 0.6em 0.8em;
		border-bottom: 1px solid #222;
		background: #111;
	}
	.origin-bar {
		display: flex;
		align-items: center;
		gap: 0.45em;
		padding: 0.45em 0.5em;
		border-top: 1px solid #222;
		background: #0f0f0f;
	}
	.origin-shell {
		display: flex;
		align-items: center;
		gap: 0.45em;
		flex: 1;
		min-width: 0;
		border: 1px solid #2a2a2a;
		background: #121212;
		border-radius: 3px;
		padding: 0.22em 0.42em;
	}
	.origin-prefix {
		color: #8f8f8f;
		font-size: 0.74em;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.origin-bar input {
		min-width: 0;
		width: 100%;
		padding: 0.2em 0.15em;
		border: 1px solid transparent;
		border-radius: 1px;
		background: transparent;
		color: #e5e7eb;
		font-size: 0.82em;
		font-family:
			"JetBrains Mono", "SF Mono", "Fira Code", Consolas, "Liberation Mono",
			monospace;
	}
	.origin-bar input:focus {
		outline: none;
		border-color: #7a7a7a;
		box-shadow: inset 0 0 0 1px #7a7a7a;
	}
	.preview-omnibox {
		display: flex;
		align-items: center;
		gap: 0;
		padding: 0.4em 0.5em;
		border-bottom: 1px solid #222;
		background: #0f0f0f;
	}
	.omnibox-shell {
		display: flex;
		align-items: center;
		gap: 0.35em;
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		border-radius: 0;
		padding: 0;
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
		width: 1.45em;
		height: 1.45em;
		padding: 0;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.nav-btn .material-symbols-outlined {
		font-size: 15px;
	}
	.nav-btn:hover {
		background: #1f1f1f;
		color: #d0d0d0;
	}
	.preview-omnibox input {
		min-width: 0;
		width: 100%;
		padding: 0.22em 0.18em;
		border: 1px solid transparent;
		border-radius: 1px;
		background: transparent;
		color: #e5e7eb;
	}
	.preview-omnibox input:focus {
		outline: none;
		border-color: #7a7a7a;
		box-shadow: inset 0 0 0 1px #7a7a7a;
	}
	.preview-tab-strip {
		display: flex;
		gap: 0;
		border-bottom: 1px solid #222;
		background: #111;
		padding: 0;
	}
	.device-select { margin-left: auto; border: 0; border-left: 1px solid #222; background: #151515; color: #bbb; padding: 0 8px; font: inherit; font-size: 0.72em; }
	.preview-tab {
		border: 0;
		background: transparent;
		color: #aaa;
		font-size: 0.72em;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-weight: 600;
		padding: 0.7em 0.9em;
		cursor: pointer;
		border-right: 1px solid #222;
		font-family: inherit;
	}
	.preview-tab:hover {
		background: #181818;
		color: #d0d0d0;
	}
	.preview-tab.active {
		background: #1f1f1f;
		color: #fff;
	}
	.run-project-button {
		margin-left: 0;
		border: 0;
		border-left: 1px solid #2c3d52;
		background: #132033;
		color: #dbeafe;
		padding: 0.65em 1em;
		font: inherit;
		font-size: 0.78em;
		font-weight: 700;
		cursor: pointer;
	}
	.run-project-button:hover { background: #1b304d; }
	.run-panel { position: relative; z-index: 5; display: grid; gap: 8px; padding: 10px; border-bottom: 1px solid #334155; background: #0d121a; color: #e5e7eb; }
	.run-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; border: 1px solid #2b3442; background: #141a23; }
	.run-option > div { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
	.run-option span { color: #9ca3af; font-size: 0.78em; line-height: 1.4; }
	.run-option button { flex: 0 0 auto; min-height: 36px; border: 1px solid #3b82f6; background: #172a45; color: #fff; padding: 7px 10px; cursor: pointer; }
	.network-steps { padding: 11px; border: 1px solid #31553e; background: #102218; color: #d1fae5; font-size: 0.78em; line-height: 1.45; }
	.network-steps ol { margin: 7px 0; padding-left: 20px; }
	.network-steps p { margin: 7px 0 0; color: #9fd6b4; }
	.network-steps code { overflow-wrap: anywhere; color: #bfdbfe; }
	.project-console { flex: 0 0 auto; max-height: 180px; overflow: auto; border-bottom: 1px solid #2b3442; background: #090b0f; color: #cbd5e1; font-size: 0.75em; }
	.project-console summary { cursor: pointer; padding: 6px 9px; background: #11151c; }
	.project-console pre { margin: 0; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; color: #a7f3d0; font: 11px/1.45 "SFMono-Regular", Consolas, monospace; }
	.console-toolbar { display: flex; justify-content: flex-end; padding: 4px 8px 0; }
	.console-toolbar button { border: 1px solid #343b47; background: #181c24; color: #bbb; cursor: pointer; font-size: 11px; }
	.rewrite-meta {
		display: flex;
		align-items: center;
		gap: 0.7em;
		padding: 0.45em 0.6em;
		border-bottom: 1px solid #222;
		background: #0f0f0f;
		color: #9ca3af;
		font-size: 0.76em;
	}
	.rewrite-meta-file {
		color: #d1d5db;
		font-family:
			"JetBrains Mono", "SF Mono", "Fira Code", Consolas, "Liberation Mono",
			monospace;
		font-size: 0.92em;
	}
	.rewrite-meta-status {
		color: #8f8f8f;
	}
	.rewrite-meta-ct {
		color: #6b7280;
		margin-left: auto;
		font-family:
			"JetBrains Mono", "SF Mono", "Fira Code", Consolas, "Liberation Mono",
			monospace;
		font-size: 0.92em;
	}
	.rewrite-refresh {
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
	.rewrite-refresh:hover {
		background: #1f1f1f;
		color: #d0d0d0;
	}
	.rewrite-refresh .material-symbols-outlined {
		font-size: 14px;
	}
	.preview-body {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		position: relative;
		overflow: auto;
	}
	.rewrite-pane {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		background: #111;
	}
	.rewrite-pane.hidden {
		display: none;
	}
	.preview-frame {
		flex: 1;
		min-width: 0;
		min-height: 0;
		border: 0;
		border-radius: 0;
		overflow: hidden;
		background: #fff;
		display: flex;
	}
	.preview-frame.hidden {
		display: none;
	}
	.preview-frame.device-phone { flex: 0 0 min(390px, 100%); width: min(390px, 100%); margin: 12px auto; min-height: 700px; box-shadow: 0 0 0 1px #374151; }
	.preview-frame.device-ipad { flex: 0 0 min(820px, 100%); width: min(820px, 100%); margin: 12px auto; min-height: 900px; box-shadow: 0 0 0 1px #374151; }
	.preview-frame.device-desktop { flex: 0 0 min(1280px, 100%); width: min(1280px, 100%); margin: 12px auto; min-height: 720px; box-shadow: 0 0 0 1px #374151; }
	iframe {
		border: 0;
		width: 100%;
		height: 100%;
	}
	@media (max-width: 1120px) {
		.playground-view {
			flex-direction: column;
		}
		.split-handle {
			display: none;
		}
		.preview-frame {
			min-height: 320px;
		}
	}
	@media (max-width: 760px) {
		:scope {
			padding: 0;
		}
		.editor-layout {
			grid-template-columns: 1fr;
		}
		.file-tree {
			min-height: 320px;
		}
		.tree-sections {
			grid-template-rows: minmax(180px, 1fr) 9px minmax(180px, 1fr);
			min-height: 0;
		}
		.preview-omnibox {
			padding: 0.4em;
		}
		.origin-bar {
			flex-direction: column;
			align-items: stretch;
		}
		.run-option { align-items: stretch; flex-direction: column; }
		.run-option button { min-height: 44px; font-size: 16px; }
	}
`;
export default PlaygroundView;
