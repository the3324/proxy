import { css, type Component } from "dreamland/core";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.main.js";

if (!(globalThis as any).MonacoEnvironment) {
	(globalThis as any).MonacoEnvironment = {
		getWorkerUrl() {
			return "data:application/javascript,";
		},
	};
}

const completionMarker = "__scramjetPlaygroundCompletions";
if (!(globalThis as any)[completionMarker]) {
	(globalThis as any)[completionMarker] = true;
	const register = (
		languages: string[],
		items: Array<{ label: string; detail: string; insertText: string }>
	) => {
		for (const language of languages) {
			monaco.languages.registerCompletionItemProvider(language, {
				triggerCharacters: ["."],
				provideCompletionItems(model, position) {
					const word = model.getWordUntilPosition(position);
					const range = {
						startLineNumber: position.lineNumber,
						endLineNumber: position.lineNumber,
						startColumn: word.startColumn,
						endColumn: word.endColumn,
					};
					return {
						suggestions: items.map((item) => ({
							label: item.label,
							kind: monaco.languages.CompletionItemKind.Snippet,
							detail: item.detail,
							insertText: item.insertText,
							insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
							range,
						})),
					};
				},
			});
		}
	};

	register(["javascript", "typescript"], [
		{ label: "console.log", detail: "Log a value to the Playground console", insertText: "console.log(${1:value});" },
		{ label: "console.error", detail: "Log an error", insertText: "console.error(${1:error});" },
		{ label: "const", detail: "Create a constant", insertText: "const ${1:name} = ${2:value};" },
		{ label: "function", detail: "Create a function", insertText: "function ${1:name}(${2:args}) {\n\t${0}\n}" },
		{ label: "arrow function", detail: "Create an arrow function", insertText: "const ${1:name} = (${2:args}) => {\n\t${0}\n};" },
		{ label: "addEventListener", detail: "Add an event listener", insertText: "${1:element}.addEventListener(\"${2:click}\", (${3:event}) => {\n\t${0}\n});" },
		{ label: "querySelector", detail: "Find an element", insertText: "document.querySelector(\"${1:selector}\")" },
		{ label: "fetch", detail: "Fetch JSON data", insertText: "const response = await fetch(\"${1:url}\");\nconst data = await response.json();\n${0}" },
		{ label: "try/catch", detail: "Handle errors", insertText: "try {\n\t${1}\n} catch (error) {\n\tconsole.error(error);\n}" },
	]);

	register(["html"], [
		{ label: "html document", detail: "Complete responsive HTML page", insertText: "<!doctype html>\n<html lang=\"en\">\n<head>\n\t<meta charset=\"utf-8\">\n\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\t<title>${1:Page title}</title>\n</head>\n<body>\n\t${0}\n</body>\n</html>" },
		{ label: "div", detail: "Division element", insertText: "<div class=\"${1:container}\">\n\t${0}\n</div>" },
		{ label: "button", detail: "Accessible button", insertText: "<button type=\"button\">${1:Button}</button>" },
		{ label: "img", detail: "Responsive image", insertText: "<img src=\"${1:image.png}\" alt=\"${2:Description}\">" },
		{ label: "stylesheet", detail: "Link a stylesheet", insertText: "<link rel=\"stylesheet\" href=\"${1:style.css}\">" },
		{ label: "script", detail: "Load a JavaScript module", insertText: "<script type=\"module\" src=\"${1:main.js}\"><\/script>" },
	]);

	register(["css"], [
		{ label: "display flex", detail: "Flexible row/column layout", insertText: "display: flex;\nalign-items: ${1:center};\njustify-content: ${2:center};\ngap: ${3:1rem};" },
		{ label: "display grid", detail: "Responsive grid layout", insertText: "display: grid;\ngrid-template-columns: repeat(auto-fit, minmax(${1:220px}, 1fr));\ngap: ${2:1rem};" },
		{ label: "media query", detail: "Responsive breakpoint", insertText: "@media (max-width: ${1:768px}) {\n\t${0}\n}" },
		{ label: "center page", detail: "Center content in the viewport", insertText: "min-height: 100vh;\ndisplay: grid;\nplace-items: center;" },
		{ label: "custom property", detail: "CSS variable", insertText: "--${1:name}: ${2:value};" },
	]);
}

type MonacoProps = {
	value: string;
	language?: string;
	readOnly?: boolean;
	minHeight?: number;
	fill?: boolean;
	onChange?: (value: string) => void;
	onSave?: () => void;
};

const Monaco: Component<MonacoProps, {}, { instance?: any }> = function (cx) {
	cx.mount = () => {
		this.instance = monaco.editor.create(cx.root, {
			value: this.value ?? "",
			language: this.language ?? "plaintext",
			readOnly: this.readOnly ?? true,
			automaticLayout: true,
			minimap: { enabled: false },
			scrollBeyondLastLine: false,
			lineNumbers: "on",
			renderLineHighlight: "none",
			theme: "vs-dark",
			quickSuggestions: { other: true, comments: false, strings: true },
			suggestOnTriggerCharacters: true,
			acceptSuggestionOnEnter: "on",
			tabCompletion: "on",
			snippetSuggestions: "top",
		});

		this.instance.onDidChangeModelContent(() => {
			this.onChange?.(this.instance.getValue());
		});

		this.instance.addCommand(
			monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
			() => {
				this.onSave?.();
			}
		);

		use(this.value).listen((next) => {
			if (!this.instance) return;
			const current = this.instance.getValue();
			if (current !== next) {
				this.instance.setValue(next ?? "");
			}
		});

		use(this.language).listen((next) => {
			if (!this.instance || !this.instance.getModel()) return;
			monaco.editor.setModelLanguage(
				this.instance.getModel(),
				next ?? "plaintext"
			);
		});

		use(this.readOnly).listen((next) => {
			if (!this.instance) return;
			this.instance.updateOptions({ readOnly: next ?? true });
		});
	};

	return (
		<div
			class={`monaco-host ${this.fill ? "fill" : ""}`}
			style={
				this.fill
					? "min-height: 0; height: 100%;"
					: `min-height: ${this.minHeight ?? 260}px; height: ${this.minHeight ?? 260}px;`
			}
		/>
	);
};

Monaco.style = css`
	:scope {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		min-height: 200px;
		height: auto;
		flex: 0 0 auto;
		border-radius: 0;
		overflow: hidden;
		border: 0;
		background: #111;
	}
	:scope.fill {
		flex: 1;
		height: 100%;
		min-height: 0;
	}
	.monaco-host {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		min-height: 200px;
		height: 100%;
	}
	.monaco-host.fill {
		min-height: 0;
	}
`;
export default Monaco;
