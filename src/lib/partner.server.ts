// Propojení s partnerskou taxislužbou: podepsané zprávy mezi dvěma aplikacemi.
const enc = new TextEncoder();

async function hmac(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function cfg() {
  const secret = process.env["PARTNER_SECRET"];
  const url = process.env["PARTNER_URL"];
  if (!secret || !url) throw new Error("Propojení s partnerem není nastavené.");
  return { secret, url: url.replace(/\/+$/, "") };
}

export function myName() {
  return process.env["PARTNER_SELF_NAME"] || "Vinné Taxi";
}

export async function callPartner<T = any>(path: string, payload: unknown): Promise<T> {
  const { secret, url } = cfg();
  const body = JSON.stringify({ ts: Date.now(), from: myName(), payload });
  const res = await fetch(`${url}/api/public/partner/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-partner-signature": await hmac(body, secret) },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Partner neodpověděl (${res.status}).`);
  return JSON.parse(text) as T;
}

export async function verifyPartnerRequest(request: Request): Promise<{ from: string; payload: any } | null> {
  const secret = process.env["PARTNER_SECRET"];
  if (!secret) return null;
  const body = await request.text();
  if (body.length > 20_000) return null;
  const sig = request.headers.get("x-partner-signature") ?? "";
  if (!safeEqual(sig, await hmac(body, secret))) return null;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.ts !== "number" || Math.abs(Date.now() - parsed.ts) > 5 * 60_000) return null;
    return { from: String(parsed.from ?? "Partner").slice(0, 60), payload: parsed.payload };
  } catch {
    return null;
  }
}
