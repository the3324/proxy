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

	register(["scss", "less"], [
		{ label: "variable", detail: "Style variable", insertText: "${1:\\$}${2:name}: ${3:value};" },
		{ label: "nested rule", detail: "Nested selector", insertText: "${1:.parent} {\n\t${2:&:hover} {\n\t\t${0}\n\t}\n}" },
		{ label: "media query", detail: "Responsive breakpoint", insertText: "@media (max-width: ${1:768px}) {\n\t${0}\n}" },
	]);

	register(["python"], [
		{ label: "print", detail: "Print a value", insertText: "print(${1:value})" },
		{ label: "def", detail: "Define a function", insertText: "def ${1:name}(${2:args}):\n\t${0:pass}" },
		{ label: "class", detail: "Define a class", insertText: "class ${1:Name}:\n\tdef __init__(self, ${2:args}):\n\t\t${0:pass}" },
		{ label: "for", detail: "For loop", insertText: "for ${1:item} in ${2:items}:\n\t${0}" },
		{ label: "try", detail: "Handle an exception", insertText: "try:\n\t${1}\nexcept ${2:Exception} as error:\n\tprint(error)" },
		{ label: "main", detail: "Python entry point", insertText: "if __name__ == \"__main__\":\n\t${0:main()}" },
	]);

	register(["java", "csharp", "kotlin", "swift", "dart"], [
		{ label: "class", detail: "Create a class", insertText: "class ${1:Name} {\n\t${0}\n}" },
		{ label: "if", detail: "Conditional block", insertText: "if (${1:condition}) {\n\t${0}\n}" },
		{ label: "for", detail: "For loop", insertText: "for (${1:item} in ${2:items}) {\n\t${0}\n}" },
		{ label: "try", detail: "Try/catch block", insertText: "try {\n\t${1}\n} catch (${2:error}) {\n\t${0}\n}" },
	]);

	register(["c", "cpp"], [
		{ label: "include", detail: "Include a header", insertText: "#include <${1:stdio.h}>" },
		{ label: "main", detail: "Program entry point", insertText: "int main(${1:void}) {\n\t${0}\n\treturn 0;\n}" },
		{ label: "printf", detail: "Print formatted output", insertText: "printf(\"${1:%s}\\n\", ${2:value});" },
		{ label: "for", detail: "Counting loop", insertText: "for (int ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n\t${0}\n}" },
	]);

	register(["go"], [
		{ label: "package main", detail: "Go program", insertText: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t${0}\n}" },
		{ label: "func", detail: "Define a function", insertText: "func ${1:name}(${2:args}) ${3:returnType} {\n\t${0}\n}" },
		{ label: "if err", detail: "Handle an error", insertText: "if err != nil {\n\t${0:return err}\n}" },
		{ label: "for range", detail: "Range loop", insertText: "for ${1:index}, ${2:value} := range ${3:items} {\n\t${0}\n}" },
	]);

	register(["rust"], [
		{ label: "fn", detail: "Define a function", insertText: "fn ${1:name}(${2:args}) ${3:-> ReturnType }{\n\t${0}\n}" },
		{ label: "main", detail: "Rust entry point", insertText: "fn main() {\n\t${0}\n}" },
		{ label: "println", detail: "Print a line", insertText: "println!(\"${1:{}}\", ${2:value});" },
		{ label: "match", detail: "Pattern match", insertText: "match ${1:value} {\n\t${2:pattern} => ${3:result},\n\t_ => ${0},\n}" },
	]);

	register(["php"], [
		{ label: "php", detail: "PHP document", insertText: "<?php\n\n${0}\n" },
		{ label: "echo", detail: "Output a value", insertText: "echo ${1:value};" },
		{ label: "function", detail: "Define a function", insertText: "function ${1:name}(${2:args}) {\n\t${0}\n}" },
		{ label: "foreach", detail: "Foreach loop", insertText: "foreach (${1:items} as ${2:item}) {\n\t${0}\n}" },
	]);

	register(["ruby", "lua", "r"], [
		{ label: "function", detail: "Define a function", insertText: "function ${1:name}(${2:args})\n\t${0}\nend" },
		{ label: "if", detail: "Conditional block", insertText: "if ${1:condition} then\n\t${0}\nend" },
		{ label: "for", detail: "Loop over values", insertText: "for ${1:item} in ${2:items} do\n\t${0}\nend" },
	]);

	register(["shell"], [
		{ label: "shebang", detail: "Portable Bash script", insertText: "#!/usr/bin/env bash\nset -euo pipefail\n\n${0}" },
		{ label: "if", detail: "Shell conditional", insertText: "if [[ ${1:condition} ]]; then\n\t${0}\nfi" },
		{ label: "for", detail: "Shell loop", insertText: "for ${1:item} in ${2:items}; do\n\t${0}\ndone" },
		{ label: "function", detail: "Shell function", insertText: "${1:name}() {\n\t${0}\n}" },
	]);

	register(["sql"], [
		{ label: "select", detail: "SELECT query", insertText: "SELECT ${1:*}\nFROM ${2:table}\nWHERE ${3:condition};" },
		{ label: "insert", detail: "INSERT statement", insertText: "INSERT INTO ${1:table} (${2:columns})\nVALUES (${3:values});" },
		{ label: "update", detail: "UPDATE statement", insertText: "UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};" },
		{ label: "create table", detail: "CREATE TABLE statement", insertText: "CREATE TABLE ${1:name} (\n\t${2:id} INTEGER PRIMARY KEY,\n\t${0}\n);" },
		{ label: "join", detail: "JOIN clause", insertText: "JOIN ${1:table} ON ${2:left_id} = ${3:right_id}" },
	]);

	register(["yaml"], [
		{ label: "list", detail: "YAML list", insertText: "${1:items}:\n\t- ${2:first}\n\t- ${0:second}" },
		{ label: "mapping", detail: "YAML mapping", insertText: "${1:name}:\n\t${2:key}: ${3:value}" },
	]);

	register(["markdown"], [
		{ label: "link", detail: "Markdown link", insertText: "[${1:text}](${2:url})" },
		{ label: "image", detail: "Markdown image", insertText: "![${1:description}](${2:image.png})" },
		{ label: "code block", detail: "Fenced code block", insertText: "```${1:javascript}\n${0}\n```" },
		{ label: "table", detail: "Markdown table", insertText: "| ${1:Column 1} | ${2:Column 2} |\n| --- | --- |\n| ${3:value} | ${0:value} |" },
	]);

	register(["dockerfile"], [
		{ label: "from", detail: "Base image", insertText: "FROM ${1:node:22-alpine}" },
		{ label: "workdir", detail: "Working directory", insertText: "WORKDIR ${1:/app}" },
		{ label: "copy", detail: "Copy files", insertText: "COPY ${1:.} ${2:.}" },
		{ label: "run", detail: "Build command", insertText: "RUN ${1:command}" },
		{ label: "cmd", detail: "Container command", insertText: "CMD [\"${1:command}\"]" },
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
			wordBasedSuggestions: "allDocuments",
			wordBasedSuggestionsOnlySameLanguage: true,
			suggestOnTriggerCharacters: true,
			inlineSuggest: { enabled: true },
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
