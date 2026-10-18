/**
 * Server-only module — volání Lovable AI Gateway (Responses API).
 * Nikdy neimportovat na straně klienta; funkcionalita se volá přes *.functions.ts.
 */
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const SYSTEM_PROMPT =
  "Jsi profesionální překladatel pro taxislužbu Vinné Taxi v Brně. " +
  "Překládej krátce, přirozeně a zdvořile. " +
  "Zachovej přesně čísla, ceny, časy, adresy a názvy ulic (ty nepřekládej, jen ponech). " +
  "Vrať VÝHRADNĚ samotný překlad, bez poznámek, bez uvozovek a bez vysvětlení.";

export async function translateWithAi(opts: {
  text: string;
  targetLang: string;
  sourceLang?: string;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI není nakonfigurováno (chybí klíč).");

  const from = opts.sourceLang && opts.sourceLang.length > 0 ? opts.sourceLang : "češtiny";
  const instructions = `${SYSTEM_PROMPT} Překládej z jazyka "${from}" do jazyka "${opts.targetLang}".`;

  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const messages: ModelMessage[] = [{ role: "user", content: opts.text }];

  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = (await result.text).trim();
  if (!text) throw new Error("AI nevrátila překlad, zkuste to prosím znovu.");
  return text;
}
