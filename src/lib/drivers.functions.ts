import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateDriverSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(72),
  full_name: z.string().min(1).max(120),
  call_sign: z.string().min(1).max(40),
});

export const createDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateDriverSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Only dispatchers may create drivers
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (roleRow?.role !== "dispatcher") {
      throw new Error("Pouze dispečer může zakládat řidiče.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        call_sign: data.call_sign,
        role: "driver",
      },
    });
    if (error) throw new Error(error.message);

    return { ok: true, user_id: created.user?.id };
  });
