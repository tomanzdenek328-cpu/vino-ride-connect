import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertDispatcher(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role !== "dispatcher") {
    throw new Error("Pouze dispečer může spravovat auta.");
  }
}

const CreateSchema = z.object({
  plate: z.string().min(1).max(20),
  car_type: z.string().max(80).default(""),
  notes: z.string().max(255).optional().nullable(),
});

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("vehicles").insert({
      plate: data.plate.trim(),
      car_type: data.car_type?.trim() ?? "",
      notes: data.notes?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  plate: z.string().min(1).max(20).optional(),
  car_type: z.string().max(80).optional(),
  notes: z.string().max(255).optional().nullable(),
  active: z.boolean().optional(),
  photo_url: z.string().max(500).optional().nullable(),
});

export const updateVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);
    const patch: { plate?: string; car_type?: string; notes?: string | null; active?: boolean; photo_url?: string | null } = {};
    if (data.plate !== undefined) patch.plate = data.plate.trim();
    if (data.car_type !== undefined) patch.car_type = data.car_type.trim();
    if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
    if (data.active !== undefined) patch.active = data.active;
    if (data.photo_url !== undefined) patch.photo_url = data.photo_url || null;
    const { error } = await supabaseAdmin.from("vehicles").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


const IdSchema = z.object({ id: z.string().uuid() });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => IdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertDispatcher(context.supabase, context.userId);
    await supabaseAdmin.from("driver_locations").update({ vehicle_id: null }).eq("vehicle_id", data.id);
    const { error } = await supabaseAdmin.from("vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
