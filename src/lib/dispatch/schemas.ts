import { z } from 'zod';
export const orderDraftSchema = z.object({
  pickup: z.string().nullable(), destination: z.string().nullable(),
  scheduledTime: z.string().nullable(), passengers: z.number().nullable(),
  vehicleType: z.enum(['car','van','limo']).nullable(), phone: z.string().nullable(),
  notes: z.string().nullable(), warnings: z.array(z.string()),
}).strict();
export type OrderDraft = z.infer<typeof orderDraftSchema>;
export function normalizeDraft(draft: OrderDraft): OrderDraft {
  return { ...draft, passengers: draft.passengers == null ? null : Math.min(30, Math.max(1, Math.round(draft.passengers))), scheduledTime: draft.scheduledTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.scheduledTime) ? draft.scheduledTime : null };
}
export type Candidate = { id: string; name: string; vehicleType: string; plate: string; capacity: number; lat: number | null; lng: number | null; updatedAt: string; online: boolean; busy: boolean };
export function vehicleKey(value: string) {
  const v = value.toLowerCase();
  if (/limo|limuz/.test(v)) return 'limo';
  if (/tesla/.test(v)) return 'tesla';
  if (/van|dod[aá]v|bus/.test(v)) return 'van';
  if (/car|osob|sedan|kombi/.test(v)) return 'car';
  return null;
}
export function rankDrivers(candidates: Candidate[], pickup: { lat: number; lng: number } | null, type: string | null, now = Date.now()) {
  return candidates.filter(c => c.online && !c.busy && c.capacity > 0 && (!type || vehicleKey(c.vehicleType) === vehicleKey(type))).map(c => {
    const fresh = now - Date.parse(c.updatedAt) <= 5 * 60 * 1000 && now >= Date.parse(c.updatedAt);
    let distance: number | null = null;
    if (pickup && fresh && c.lat != null && c.lng != null) {
      const rad = Math.PI / 180;
      const a = Math.sin((c.lat-pickup.lat)*rad/2)**2 + Math.cos(pickup.lat*rad)*Math.cos(c.lat*rad)*Math.sin((c.lng-pickup.lng)*rad/2)**2;
      distance = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1,a)));
    }
    return { ...c, distance };
  }).sort((a,b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || b.capacity-a.capacity || a.name.localeCompare(b.name));
}
