import { requestUrl } from "obsidian";

/** Default free community text model (cheap / free tier). */
export const DEFAULT_TEXT_MODEL = "community/MarcosFRG/deepseek-v4-flash-0731";

export interface GenerateTextOptions {
	model?: string;
	system?: string;
	temperature?: number;
}

/**
 * Generate text via the Pollinations unified gateway.
 * Pass an empty apiKey to use the free tier without authentication.
 */
export async function generateText(
	prompt: string,
	apiKey: string,
	opts: GenerateTextOptions = {},
): Promise<string> {
	const res = await requestUrl({
		url: "https://gen.pollinations.ai/v1/chat/completions",
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
		},
		body: JSON.stringify({
			model: opts.model || DEFAULT_TEXT_MODEL,
			messages: [
				...(opts.system
					? [{ role: "system" as const, content: opts.system }]
					: []),
				{ role: "user" as const, content: prompt },
			],
			...(opts.temperature !== undefined
				? { temperature: opts.temperature }
				: {}),
		}),
	});

	if (res.status !== 200) {
		throw new Error(
			`Pollinations text request failed (HTTP ${res.status}): ${res.text.slice(0, 300)}`,
		);
	}

	const content = res.json?.choices?.[0]?.message?.content;
	if (typeof content !== "string") {
		throw new Error("Unexpected response shape from Pollinations text API");
	}
	return content;
}

/**
 * Generate an image via the Pollinations image endpoint.
 * Returns the raw image bytes as an ArrayBuffer.
 */
export async function generateImage(
	prompt: string,
	apiKey: string,
	model = "",
): Promise<ArrayBuffer> {
	const params = new URLSearchParams();
	if (model) params.set("model", model);
	if (apiKey) params.set("token", apiKey);
	const qs = params.toString();
	const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}${qs ? `?${qs}` : ""}`;

	const res = await requestUrl({
		url,
		method: "GET",
		headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
	});

	if (res.status !== 200) {
		throw new Error(
			`Pollinations image request failed (HTTP ${res.status}): ${String(res.text).slice(0, 300)}`,
		);
	}
	return res.arrayBuffer;
}

/** Fetch the live text model list from the gateway. */
export async function fetchTextModels(): Promise<string[]> {
	try {
		const res = await requestUrl({
			url: "https://gen.pollinations.ai/text/models",
			method: "GET",
		});
		if (res.status !== 200) return [DEFAULT_TEXT_MODEL];
		const arr = res.json as Array<{ name?: string }>;
		if (!Array.isArray(arr)) return [DEFAULT_TEXT_MODEL];
		const names = arr.map((m) => m.name).filter((n): n is string => !!n);
		return names.length ? names : [DEFAULT_TEXT_MODEL];
	} catch {
		return [DEFAULT_TEXT_MODEL];
	}
}
