import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	TFile,
	normalizePath,
} from "obsidian";
import { DEFAULT_SETTINGS, PollinationsSettingTab, type PollinationsSettings } from "./settings";
import {
	DEFAULT_TEXT_MODEL,
	generateImage,
	generateText,
} from "./api";
import {
	pollDeviceToken,
	requestDeviceCode,
	verificationUrl,
} from "./deviceFlow";

declare global {
	interface Window {
		require?: (id: string) => { shell?: { openExternal(url: string): void } };
	}
}

class PromptModal extends Modal {
	result: string | null = null;
	private inputEl!: HTMLInputElement;
	private placeholder: string;

	constructor(app: App, placeholder: string) {
		super(app);
		this.placeholder = placeholder;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: this.placeholder.includes("image") ? "Generate image" : "Generate text" });

		this.inputEl = contentEl.createEl("input", {
			type: "text",
			attr: { placeholder: this.placeholder },
		});
		this.inputEl.addClass("pollinations-prompt-input");
		this.inputEl.focus();
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.submit();
			}
		});

		contentEl.createEl("div", { cls: "pollinations-modal-actions" }, (div) => {
			const cancel = div.createEl("button", { text: "Cancel" });
			cancel.addEventListener("click", () => this.close());
			const go = div.createEl("button", {
				text: "Generate",
				cls: "mod-cta",
			});
			go.addEventListener("click", () => this.submit());
		});
	}

	private submit(): void {
		const v = this.inputEl.value.trim();
		if (!v) {
			new Notice("Please enter a prompt");
			return;
		}
		this.result = v;
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

class DeviceFlowModal extends Modal {
	private plugin: PollinationsPlugin;
	private deviceCode: string;
	private polling = false;

	constructor(app: App, plugin: PollinationsPlugin, userCode: string, verifyUrl: string, deviceCode: string) {
		super(app);
		this.plugin = plugin;
		this.deviceCode = deviceCode;
		this.setTitle("Sign in to Pollinations");
		this.contentEl.empty();
		this.contentEl.createEl("p", {
			text: `Open the Pollinations device page and enter this code:`,
		});
		this.contentEl.createEl("div", { cls: "pollinations-code", text: userCode });
		const btnRow = this.contentEl.createEl("div", { cls: "pollinations-modal-actions" });
		const openBtn = btnRow.createEl("button", { text: "Open browser", cls: "mod-cta" });
		openBtn.addEventListener("click", () => {
			window.require?.("electron")?.shell?.openExternal(verifyUrl);
		});
		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());
	}

	onOpen(): void {
		this.polling = true;
		void this.poll();
	}

	private async poll(): Promise<void> {
		const interval = setInterval(async () => {
			if (!this.polling) {
				clearInterval(interval);
				return;
			}
			try {
				const token = await pollDeviceToken(this.deviceCode);
				if (token) {
					clearInterval(interval);
					this.polling = false;
					this.plugin.settings.apiKey = token;
					await this.plugin.saveSettings();
					this.plugin.updateStatusBar();
					new Notice("Signed in to Pollinations");
					this.close();
				}
			} catch (e) {
				clearInterval(interval);
				this.polling = false;
				new Notice(`Device flow error: ${(e as Error).message}`);
				this.close();
			}
		}, 5000);
	}

	onClose(): void {
		this.polling = false;
	}
}

export default class PollinationsPlugin extends Plugin {
	settings!: PollinationsSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new PollinationsSettingTab(this.app, this));

		this.addRibbonIcon("wand", "Pollinations: generate image", () => {
			void this.generateImageCommand();
		});

		this.addCommand({
			id: "pollinations-generate-text",
			name: "Generate text at cursor",
			editorCallback: (editor: Editor) => {
				void this.generateTextCommand(editor, false);
			},
		});

		this.addCommand({
			id: "pollinations-generate-text-from-selection",
			name: "Generate text from selection",
			editorCallback: (editor: Editor) => {
				void this.generateTextCommand(editor, true);
			},
		});

		this.addCommand({
			id: "pollinations-generate-image",
			name: "Generate image and embed in note",
			editorCallback: (editor: Editor) => {
				void this.generateImageCommand(editor);
			},
		});

		this.addCommand({
			id: "pollinations-sign-in",
			name: "Sign in with device flow",
			callback: () => {
				void this.startDeviceFlow();
			},
		});

		this.updateStatusBar();
	}

	onunload(): void {
		this.statusBarItem?.remove();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private statusBarItem: HTMLElement | null = null;

	updateStatusBar(): void {
		if (!this.statusBarItem) {
			this.statusBarItem = this.addStatusBarItem();
		}
		if (this.statusBarItem) {
			this.statusBarItem.setText(
				this.settings.apiKey ? "Pollinations: signed in" : "Pollinations: free tier",
			);
		}
	}

	async startDeviceFlow(): Promise<void> {
		try {
			const code = await requestDeviceCode(this.settings.clientId || "obsidian-pollinations");
			const modal = new DeviceFlowModal(
				this.app,
				this,
				code.user_code,
				verificationUrl(code),
				code.device_code,
			);
			modal.open();
		} catch (e) {
			new Notice(`Device flow failed: ${(e as Error).message}`);
		}
	}

	private async generateTextCommand(editor: Editor, fromSelection: boolean): Promise<void> {
		const selection = fromSelection ? editor.getSelection().trim() : "";
		const modal = new PromptModal(
			this.app,
			selection || "Describe what to generate, or select text first…",
		);
		modal.open();
		const result = await new Promise<string | null>((resolve) => {
			const orig = modal.onClose.bind(modal);
			modal.onClose = () => {
				orig();
				resolve(modal.result);
			};
		});
		if (result === null) return;

		new Notice("Generating text…");
		try {
			const output = await generateText(result, this.settings.apiKey, {
				model: this.settings.textModel || DEFAULT_TEXT_MODEL,
			});
			editor.replaceSelection(selection ? `> ${result}\n\n${output}\n` : output);
		} catch (e) {
			new Notice(`Text generation failed: ${(e as Error).message}`);
		}
	}

	private async generateImageCommand(editor?: Editor): Promise<void> {
		const modal = new PromptModal(this.app, "Describe the image to generate…");
		modal.open();
		const result = await new Promise<string | null>((resolve) => {
			const orig = modal.onClose.bind(modal);
			modal.onClose = () => {
				orig();
				resolve(modal.result);
			};
		});
		if (result === null) return;

		new Notice("Generating image…");
		try {
			const buffer = await generateImage(result, this.settings.apiKey, this.settings.imageModel);
			const folder = normalizePath(this.settings.imageFolder || "attachments");
			if (!(await this.app.vault.adapter.exists(folder))) {
				await this.app.vault.createFolder(folder);
			}
			const stamp = new Date().toISOString().replace(/[:.]/g, "-");
			const fileName = `${folder}/${slugify(result).slice(0, 40) || "pollinations"}-${stamp}.png`;
			const file = await this.app.vault.createBinary(
				normalizePath(fileName),
				buffer,
			);
			new Notice("Image saved");

			const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (mdView && editor) {
				const embed = `![[${file.path}]]`;
				editor.replaceSelection(embed);
			}
			void file;
		} catch (e) {
			new Notice(`Image generation failed: ${(e as Error).message}`);
		}
	}
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}
