// Same offline Ed25519 license check as siyuan-db-reports / siyuan-habit-heatmap. Key = BR1.<payload b64url>.<signature b64url>, bound to the plugin id.
const nacl = require("tweetnacl");
const PUBLIC_KEY_HEX = "4064ebb98f0440c233dae402f23337c0119a4e0035c68dbdc3dcbd27c6f6759c";
function b64uDec(s) {
	const t = s.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function hex(h) { const out = new Uint8Array(h.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16); return out; }
function verifyLicense(key, pluginId, publicKeyHex) {
	try {
		const parts = String(key || "").trim().split(".");
		if (parts.length !== 3 || parts[0] !== "BR1") return null;
		const payloadBytes = b64uDec(parts[1]);
		const sig = b64uDec(parts[2]);
		const msg = new TextEncoder().encode("BR1." + parts[1]);
		if (!nacl.sign.detached.verify(msg, sig, hex(publicKeyHex || PUBLIC_KEY_HEX))) return null;
		const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
		if (payload.p !== pluginId) return null;
		return payload;
	} catch (e) { return null; }
}
module.exports = { verifyLicense, PUBLIC_KEY_HEX };
