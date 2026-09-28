import { App, PluginSettingTab, Setting } from "obsidian";
import type PollinationsPlugin from "./main";

export interface PollinationsSettings {
	apiKey: string;
	textModel: string;
	imageModel: string;
	clientId: string;
	imageFolder: string;
}

export const DEFAULT_SETTINGS: PollinationsSettings = {
	apiKey: "",
	textModel: "community/MarcosFRG/deepseek-v4-flash-0731",
	imageModel: "",
	clientId: "obsidian-pollinations",
	imageFolder: "attachments",
};

export class PollinationsSettingTab extends PluginSettingTab {
	plugin: PollinationsPlugin;

	constructor(app: App, plugin: PollinationsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Pollinations" });

		new Setting(containerEl)
			.setName("API key")
			.setDesc(
				"Your Pollinations key (sk_… from the device flow, or pk_… from enter.pollinations.ai/keys). Leave empty to use the anonymous free tier for text.",
			)
			.addText((text) =>
				text
					.setPlaceholder("sk_… or pk_…")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
						this.plugin.updateStatusBar();
					}),
			);

		new Setting(containerEl)
			.setName("Text model")
			.setDesc("Pollinations text model. Defaults to a free community model.")
			.addText((text) =>
				text
					.setPlaceholder("community/MarcosFRG/deepseek-v4-flash-0731")
					.setValue(this.plugin.settings.textModel)
					.onChange(async (value) => {
						this.plugin.settings.textModel = value.trim() || "community/MarcosFRG/deepseek-v4-flash-0731";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Image model")
			.setDesc("Pollinations image model (optional). Leave empty for the gateway default.")
			.addText((text) =>
				text
					.setPlaceholder("e.g. flux")
					.setValue(this.plugin.settings.imageModel)
					.onChange(async (value) => {
						this.plugin.settings.imageModel = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Image folder")
			.setDesc("Vault folder where generated images are saved.")
			.addText((text) =>
				text
					.setPlaceholder("attachments")
					.setValue(this.plugin.settings.imageFolder)
					.onChange(async (value) => {
						this.plugin.settings.imageFolder = value.trim() || "attachments";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Device flow")
			.setDesc("Sign in with your Pollinations account to generate with your own Pollen balance.")
			.addButton((btn) =>
				btn.setButtonText("Sign in").onClick(async () => {
					await this.plugin.startDeviceFlow();
					this.display();
				}),
			)
			.addButton((btn) =>
				btn
					.setButtonText("Clear key")
					.onClick(async () => {
						this.plugin.settings.apiKey = "";
						await this.plugin.saveSettings();
						this.plugin.updateStatusBar();
						this.display();
					}),
			);
	}
}
