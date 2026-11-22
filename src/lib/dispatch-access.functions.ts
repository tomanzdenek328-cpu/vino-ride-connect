import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const setDriverDispatchAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ driverId: z.string().uuid(), helper: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    // The atomic database function verifies the caller and protects full dispatchers.
    const { error } = await context.supabase.rpc("set_driver_dispatch_access", {
      _driver_id: data.driverId, _helper: data.helper,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });