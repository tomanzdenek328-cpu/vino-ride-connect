import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const translateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { text: string; targetLang: string; sourceLang?: string }) => {
    if (!input || !input.text || !input.text.trim()) throw new Error("Chybí text k překladu.");
    return input;
  })
  .handler(async ({ data }) => {
    const { translateWithAi } = await import("./ai/translate.server");
    try {
      const translated = await translateWithAi(data);
      return { translated };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("402") || /credit/i.test(message)) {
        throw new Error("AI kredity jsou vyčerpané. Zkuste to později.");
      }
      if (message.includes("429")) {
        throw new Error("AI je přetížená, chvíli počkejte a zkuste to znovu.");
      }
      throw new Error(`Překlad se nezdařil: ${message}`);
    }
  });
