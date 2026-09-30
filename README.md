# Pollinations for Obsidian

Generate **text and images** with [Pollinations](https://pollinations.ai) inside your Obsidian notes — paying with your own Pollen when you sign in, or the anonymous free tier for text.

## Features

- **Generate text at the cursor** — describe what you want, the reply is inserted into your note.
- **Generate text from selection** — select a prompt in your note, and the reply is appended as a blockquote below the selection.
- **Generate an image** — describe the image, it is saved into your vault (`attachments/` by default) and embedded in the current note.
- **Sign in with the device flow** — get an `sk_…` key tied to your Pollinations account, so generations are paid from your own Pollen balance. No key needed for the anonymous free text tier.
- **Pick any text / image model** from the [live model lists](https://gen.pollinations.ai/docs) in the plugin settings.
- **Status bar indicator** — shows whether you are signed in or on the free tier.

## Install

1. **Community plugins (once listed)** — Settings → Community plugins → Browse → search "Pollinations" → Install → Enable.
2. **Manual install (now)** — download the latest release, unzip `obsidian-pollinations/` into your vault's `.obsidian/plugins/` folder, then enable it in Settings → Community plugins.

## Sign in (optional)

Run the command **"Pollinations: Sign in with device flow"** (or use the button in the plugin settings):

1. The plugin asks Pollinations for a device code.
2. Click **Open browser** — the Pollinations device page opens.
3. Enter the 8-character code shown in the dialog and approve.
4. The plugin stores the `sk_…` key in your plugin data and switches the status bar to "signed in".

Your key never leaves your vault.

## Demo

Create a note, run **"Pollinations: Generate text at cursor"**, type `Write a haiku about a quiet library`, and the reply is inserted:

```
Old paper whispers,
dust motes drift through amber light,
silence holds its breath.
```

Select any prompt in a note and run **"Pollinations: Generate text from selection"** to get a quoted reply appended below it.

Run **"Pollinations: Generate image and embed in note"**, type `a red fox in a snowy forest, studio lighting` — the PNG is saved into `attachments/` and embedded in the current note:

```
![[attachments/a-red-fox-in-a-snowy-forest-2026-09-28-....png]]
```

You can pick a different text or image model in Settings → Pollinations, e.g. any model from <https://gen.pollinations.ai/text/models> or <https://gen.pollinations.ai/image/models>.

## How it works

- Text: `POST https://gen.pollinations.ai/v1/chat/completions`
- Image: `GET https://gen.pollinations.ai/image/{prompt}`
- Auth: [device flow](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md) (`enter.pollinations.ai/api/device/*`) for user-authorized `sk_…` keys, or an `pk_…` key from [enter.pollinations.ai/keys](https://enter.pollinations.ai/keys).

## Build from source

```bash
npm install
npm run build   # tsc --noEmit + esbuild → main.js
```

## License

MIT

## How the plugin calls the Pollinations API

Text generation posts to the unified chat completions endpoint with the visitor's key (or the free tier):

``ts
// src/api.ts
const res = await requestUrl({
  url: "https://gen.pollinations.ai/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: Bearer  } : {}),
  },
  body: JSON.stringify({
    model: opts.model || "community/MarcosFRG/deepseek-v4-flash-0731",
    messages: [{ role: "user", content: prompt }],
  }),
});
``

Image generation calls the image endpoint and saves the PNG into the vault:

``ts
// src/api.ts
const res = await requestUrl({
  url: "https://gen.pollinations.ai/image/{prompt}?model={model}&nologo=true",
  method: "GET",
  headers: apiKey ? { Authorization: Bearer  } : {},
});
``

Sign-in uses the Pollinations device flow (`src/deviceFlow.ts`): request a device code from `https://enter.pollinations.ai/api/device/code`, then poll `/api/device/token` until the `sk_…` key is issued.