"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PollinationsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  apiKey: "",
  textModel: "community/MarcosFRG/deepseek-v4-flash-0731",
  imageModel: "",
  clientId: "obsidian-pollinations",
  imageFolder: "attachments"
};
var PollinationsSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Pollinations" });
    new import_obsidian.Setting(containerEl).setName("API key").setDesc(
      "Your Pollinations key (sk_\u2026 from the device flow, or pk_\u2026 from enter.pollinations.ai/keys). Leave empty to use the anonymous free tier for text."
    ).addText(
      (text) => text.setPlaceholder("sk_\u2026 or pk_\u2026").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
        this.plugin.updateStatusBar();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Text model").setDesc("Pollinations text model. Defaults to a free community model.").addText(
      (text) => text.setPlaceholder("community/MarcosFRG/deepseek-v4-flash-0731").setValue(this.plugin.settings.textModel).onChange(async (value) => {
        this.plugin.settings.textModel = value.trim() || "community/MarcosFRG/deepseek-v4-flash-0731";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Image model").setDesc("Pollinations image model (optional). Leave empty for the gateway default.").addText(
      (text) => text.setPlaceholder("e.g. flux").setValue(this.plugin.settings.imageModel).onChange(async (value) => {
        this.plugin.settings.imageModel = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Image folder").setDesc("Vault folder where generated images are saved.").addText(
      (text) => text.setPlaceholder("attachments").setValue(this.plugin.settings.imageFolder).onChange(async (value) => {
        this.plugin.settings.imageFolder = value.trim() || "attachments";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Device flow").setDesc("Sign in with your Pollinations account to generate with your own Pollen balance.").addButton(
      (btn) => btn.setButtonText("Sign in").onClick(async () => {
        await this.plugin.startDeviceFlow();
        this.display();
      })
    ).addButton(
      (btn) => btn.setButtonText("Clear key").onClick(async () => {
        this.plugin.settings.apiKey = "";
        await this.plugin.saveSettings();
        this.plugin.updateStatusBar();
        this.display();
      })
    );
  }
};

// src/api.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_TEXT_MODEL = "community/MarcosFRG/deepseek-v4-flash-0731";
async function generateText(prompt, apiKey, opts = {}) {
  const res = await (0, import_obsidian2.requestUrl)({
    url: "https://gen.pollinations.ai/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_TEXT_MODEL,
      messages: [
        ...opts.system ? [{ role: "system", content: opts.system }] : [],
        { role: "user", content: prompt }
      ],
      ...opts.temperature !== void 0 ? { temperature: opts.temperature } : {}
    })
  });
  if (res.status !== 200) {
    throw new Error(
      `Pollinations text request failed (HTTP ${res.status}): ${res.text.slice(0, 300)}`
    );
  }
  const content = res.json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Unexpected response shape from Pollinations text API");
  }
  return content;
}
async function generateImage(prompt, apiKey, model = "") {
  const params = new URLSearchParams();
  if (model)
    params.set("model", model);
  if (apiKey)
    params.set("token", apiKey);
  const qs = params.toString();
  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}${qs ? `?${qs}` : ""}`;
  const res = await (0, import_obsidian2.requestUrl)({
    url,
    method: "GET",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
  });
  if (res.status !== 200) {
    throw new Error(
      `Pollinations image request failed (HTTP ${res.status}): ${String(res.text).slice(0, 300)}`
    );
  }
  return res.arrayBuffer;
}

// src/deviceFlow.ts
var import_obsidian3 = require("obsidian");
var DEVICE_BASE = "https://enter.pollinations.ai";
async function requestDeviceCode(clientId) {
  const res = await (0, import_obsidian3.requestUrl)({
    url: `${DEVICE_BASE}/api/device/code`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId })
  });
  if (res.status !== 200) {
    throw new Error(`Device code request failed (HTTP ${res.status})`);
  }
  return res.json;
}
async function pollDeviceToken(deviceCode) {
  const res = await (0, import_obsidian3.requestUrl)({
    url: `${DEVICE_BASE}/api/device/token`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_code: deviceCode })
  });
  if (res.status !== 200) {
    throw new Error(`Device token request failed (HTTP ${res.status})`);
  }
  const data = res.json;
  if (data.error === "authorization_pending")
    return "";
  if (data.error === "expired_token")
    throw new Error("Device code expired, please try again");
  if (data.access_token)
    return data.access_token;
  throw new Error("Unexpected device flow response");
}
function verificationUrl(code) {
  const uri = code.verification_uri.startsWith("/") ? code.verification_uri : `/${code.verification_uri}`;
  return `${DEVICE_BASE}${uri}`;
}

// src/main.ts
var PromptModal = class extends import_obsidian4.Modal {
  constructor(app, placeholder) {
    super(app);
    this.result = null;
    this.placeholder = placeholder;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: this.placeholder.includes("image") ? "Generate image" : "Generate text" });
    this.inputEl = contentEl.createEl("input", {
      type: "text",
      attr: { placeholder: this.placeholder }
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
        cls: "mod-cta"
      });
      go.addEventListener("click", () => this.submit());
    });
  }
  submit() {
    const v = this.inputEl.value.trim();
    if (!v) {
      new import_obsidian4.Notice("Please enter a prompt");
      return;
    }
    this.result = v;
    this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var DeviceFlowModal = class extends import_obsidian4.Modal {
  constructor(app, plugin, userCode, verifyUrl, deviceCode) {
    super(app);
    this.polling = false;
    this.plugin = plugin;
    this.deviceCode = deviceCode;
    this.setTitle("Sign in to Pollinations");
    this.contentEl.empty();
    this.contentEl.createEl("p", {
      text: `Open the Pollinations device page and enter this code:`
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
  onOpen() {
    this.polling = true;
    void this.poll();
  }
  async poll() {
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
          new import_obsidian4.Notice("Signed in to Pollinations");
          this.close();
        }
      } catch (e) {
        clearInterval(interval);
        this.polling = false;
        new import_obsidian4.Notice(`Device flow error: ${e.message}`);
        this.close();
      }
    }, 5e3);
  }
  onClose() {
    this.polling = false;
  }
};
var PollinationsPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.statusBarItem = null;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new PollinationsSettingTab(this.app, this));
    this.addRibbonIcon("wand", "Pollinations: generate image", () => {
      void this.generateImageCommand();
    });
    this.addCommand({
      id: "pollinations-generate-text",
      name: "Generate text at cursor",
      editorCallback: (editor) => {
        void this.generateTextCommand(editor, false);
      }
    });
    this.addCommand({
      id: "pollinations-generate-text-from-selection",
      name: "Generate text from selection",
      editorCallback: (editor) => {
        void this.generateTextCommand(editor, true);
      }
    });
    this.addCommand({
      id: "pollinations-generate-image",
      name: "Generate image and embed in note",
      editorCallback: (editor) => {
        void this.generateImageCommand(editor);
      }
    });
    this.addCommand({
      id: "pollinations-sign-in",
      name: "Sign in with device flow",
      callback: () => {
        void this.startDeviceFlow();
      }
    });
    this.updateStatusBar();
  }
  onunload() {
    this.statusBarItem?.remove();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  updateStatusBar() {
    if (!this.statusBarItem) {
      this.statusBarItem = this.addStatusBarItem();
    }
    if (this.statusBarItem) {
      this.statusBarItem.setText(
        this.settings.apiKey ? "Pollinations: signed in" : "Pollinations: free tier"
      );
    }
  }
  async startDeviceFlow() {
    try {
      const code = await requestDeviceCode(this.settings.clientId || "obsidian-pollinations");
      const modal = new DeviceFlowModal(
        this.app,
        this,
        code.user_code,
        verificationUrl(code),
        code.device_code
      );
      modal.open();
    } catch (e) {
      new import_obsidian4.Notice(`Device flow failed: ${e.message}`);
    }
  }
  async generateTextCommand(editor, fromSelection) {
    const selection = fromSelection ? editor.getSelection().trim() : "";
    const modal = new PromptModal(
      this.app,
      selection || "Describe what to generate, or select text first\u2026"
    );
    modal.open();
    const result = await new Promise((resolve) => {
      const orig = modal.onClose.bind(modal);
      modal.onClose = () => {
        orig();
        resolve(modal.result);
      };
    });
    if (result === null)
      return;
    new import_obsidian4.Notice("Generating text\u2026");
    try {
      const output = await generateText(result, this.settings.apiKey, {
        model: this.settings.textModel || DEFAULT_TEXT_MODEL
      });
      editor.replaceSelection(selection ? `> ${result}

${output}
` : output);
    } catch (e) {
      new import_obsidian4.Notice(`Text generation failed: ${e.message}`);
    }
  }
  async generateImageCommand(editor) {
    const modal = new PromptModal(this.app, "Describe the image to generate\u2026");
    modal.open();
    const result = await new Promise((resolve) => {
      const orig = modal.onClose.bind(modal);
      modal.onClose = () => {
        orig();
        resolve(modal.result);
      };
    });
    if (result === null)
      return;
    new import_obsidian4.Notice("Generating image\u2026");
    try {
      const buffer = await generateImage(result, this.settings.apiKey, this.settings.imageModel);
      const folder = (0, import_obsidian4.normalizePath)(this.settings.imageFolder || "attachments");
      if (!await this.app.vault.adapter.exists(folder)) {
        await this.app.vault.createFolder(folder);
      }
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const fileName = `${folder}/${slugify(result).slice(0, 40) || "pollinations"}-${stamp}.png`;
      const file = await this.app.vault.createBinary(
        (0, import_obsidian4.normalizePath)(fileName),
        buffer
      );
      new import_obsidian4.Notice("Image saved");
      const mdView = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
      if (mdView && editor) {
        const embed = `![[${file.path}]]`;
        editor.replaceSelection(embed);
      }
    } catch (e) {
      new import_obsidian4.Notice(`Image generation failed: ${e.message}`);
    }
  }
};
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
