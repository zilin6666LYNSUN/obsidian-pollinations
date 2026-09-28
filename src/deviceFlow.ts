import { requestUrl } from "obsidian";

export const DEVICE_BASE = "https://enter.pollinations.ai";

export interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in?: number;
}

/** Step 1 of the device flow: ask the server for a device code. */
export async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
	const res = await requestUrl({
		url: `${DEVICE_BASE}/api/device/code`,
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ client_id: clientId }),
	});
	if (res.status !== 200) {
		throw new Error(`Device code request failed (HTTP ${res.status})`);
	}
	return res.json as DeviceCodeResponse;
}

/**
 * Step 3 of the device flow: poll for the access token.
 * Returns "" while still pending, the `sk_` token when approved.
 */
export async function pollDeviceToken(deviceCode: string): Promise<string> {
	const res = await requestUrl({
		url: `${DEVICE_BASE}/api/device/token`,
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ device_code: deviceCode }),
	});
	if (res.status !== 200) {
		throw new Error(`Device token request failed (HTTP ${res.status})`);
	}
	const data = res.json as { error?: string; access_token?: string };
	if (data.error === "authorization_pending") return "";
	if (data.error === "expired_token") throw new Error("Device code expired, please try again");
	if (data.access_token) return data.access_token;
	throw new Error("Unexpected device flow response");
}

/** Full verification URL for the user to open in a browser. */
export function verificationUrl(code: DeviceCodeResponse): string {
	const uri = code.verification_uri.startsWith("/")
		? code.verification_uri
		: `/${code.verification_uri}`;
	return `${DEVICE_BASE}${uri}`;
}
