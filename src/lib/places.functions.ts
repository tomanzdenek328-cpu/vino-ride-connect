import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function headers() {
  const lk = process.env.LOVABLE_API_KEY;
  const gk = process.env.GOOGLE_MAPS_API_KEY;
  if (!lk || !gk) throw new Error("Google Maps connector not configured");
  return {
    Authorization: `Bearer ${lk}`,
    "X-Connection-Api-Key": gk,
    "Content-Type": "application/json",
  };
}

export const autocompleteAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { input: string; sessionToken?: string }) => d)
  .handler(async ({ data }) => {
    const input = (data.input ?? "").trim();
    if (input.length < 2) return { suggestions: [] as { placeId: string; text: string }[] };
    const r = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        input,
        languageCode: "cs",
        regionCode: "CZ",
        sessionToken: data.sessionToken,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`autocomplete ${r.status}: ${t}`);
    }
    const j = await r.json();
    const suggestions = (j.suggestions ?? [])
      .map((s: any) => s.placePrediction)
      .filter(Boolean)
      .map((p: any) => ({ placeId: p.placeId, text: p.text?.text ?? "" }));
    return { suggestions };
  });

export const resolvePlace = createServerFn({ method: "POST" })
  .inputValidator((d: { placeId: string; sessionToken?: string }) => d)
  .handler(async ({ data }) => {
    const r = await fetch(`${GATEWAY}/places/v1/places/${encodeURIComponent(data.placeId)}?languageCode=cs${data.sessionToken ? `&sessionToken=${encodeURIComponent(data.sessionToken)}` : ""}`, {
      headers: {
        ...headers(),
        "X-Goog-FieldMask": "id,formattedAddress,location",
      },
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`place details ${r.status}: ${t}`);
    }
    const j = await r.json();
    return {
      formattedAddress: j.formattedAddress as string,
      lat: j.location?.latitude as number | undefined,
      lng: j.location?.longitude as number | undefined,
    };
  });
