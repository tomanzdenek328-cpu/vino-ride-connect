import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertDispatcher(supabase: any, userId: string) {
  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (roleErr) throw new Error(roleErr.message);
  if (roleRow?.role !== "dispatcher") {
    throw new Error("Pouze dispečer může provádět tuto akci.");
  }
}

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
    await assertDispatcher(context.supabase, context.userId);

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

const UpdateDriverSchema = z.object({
  driver_id: z.string().uuid(),
  full_name: z.string().min(1).max(120).optional(),
  call_sign: z.string().min(1).max(40).optional(),
  password: z.string().min(6).max(72).optional(),
});

export const updateDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateDriverSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);

    if (data.full_name || data.call_sign) {
      const patch: { full_name?: string; call_sign?: string } = {};
      if (data.full_name) patch.full_name = data.full_name;
      if (data.call_sign) patch.call_sign = data.call_sign;
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.driver_id);
      if (error) throw new Error(error.message);
    }

    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.driver_id, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

const DriverIdSchema = z.object({ driver_id: z.string().uuid() });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DriverIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);

    // Clean dependent rows first (no FK cascade defined).
    await supabaseAdmin.from("rides").delete().eq("driver_id", data.driver_id);
    await supabaseAdmin.from("orders").update({ assigned_driver_id: null }).eq("assigned_driver_id", data.driver_id);
    await supabaseAdmin.from("driver_locations").delete().eq("driver_id", data.driver_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.driver_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.driver_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.driver_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const resetDriverRides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DriverIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);

    // Remove all rides for this driver (resets cash/card totals).
    const { error: ridesErr } = await supabaseAdmin.from("rides").delete().eq("driver_id", data.driver_id);
    if (ridesErr) throw new Error(ridesErr.message);

    // Archive completed orders by detaching them from driver so future stats start clean.
    const { error: ordersErr } = await supabaseAdmin
      .from("orders")
      .update({ assigned_driver_id: null })
      .eq("assigned_driver_id", data.driver_id)
      .in("status", ["completed", "cancelled"]);
    if (ordersErr) throw new Error(ordersErr.message);

    return { ok: true };
  });
