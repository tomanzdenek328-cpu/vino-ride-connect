import { z } from "zod";

export const PartnerStatusResponse = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    state: z.enum(["pending", "accepted", "rejected", "cancelled"]).nullable(),
    status: z.enum(["pending", "assigned", "accepted", "in_progress", "completed", "cancelled"]),
    driver_arrived_at: z.string().nullable().optional(),
  })).max(100),
});

export function partnerProgressStatus(remote: { status: string; driver_arrived_at?: string | null }): string {
  if (remote.status === "accepted" && remote.driver_arrived_at) return "arrived";
  return remote.status;
}

export function partnerProgressLabel(state: string | null | undefined, status: string | null | undefined): string {
  if (state === "pending") return "ČEKÁ NA PŘIJETÍ PARTNEREM";
  if (state === "rejected") return "ODMÍTNUTO – ZAKÁZKA JE ZPĚT U VÁS";
  if (state === "cancelled" || status === "cancelled") return "JÍZDA ZRUŠENA";
  switch (status) {
    case "accepted": return "ŘIDIČ JÍZDU PŘIJAL";
    case "arrived": return "ŘIDIČ JE U ZÁKAZNÍKA";
    case "in_progress": return "ŘIDIČ JEDE SE ZÁKAZNÍKEM";
    case "completed": return "JÍZDA DOKONČENA";
    case "assigned": return "ŘIDIČ PŘIDĚLEN – ČEKÁ NA JEHO PŘIJETÍ";
    default: return "PARTNER PŘIJAL – ČEKÁ NA ŘIDIČE";
  }
}