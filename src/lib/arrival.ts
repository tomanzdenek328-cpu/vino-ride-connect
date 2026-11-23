export interface ArrivalOrder {
  id: string;
  source?: string | null;
  status: string;
  released: boolean;
  assigned_driver_id: string | null;
  assigned_driver_ids: string[] | null;
  driver_arrived_at?: string | null;
}

export function ownsArrival(order: ArrivalOrder, driverId: string) {
  return order.assigned_driver_id === driverId || !!order.assigned_driver_ids?.includes(driverId);
}

export function canManageArrival(order: ArrivalOrder, driverId: string) {
  return order.source === 'customer' && order.released && ownsArrival(order, driverId)
    && ['assigned', 'accepted'].includes(order.status) && !order.driver_arrived_at;
}

export function hasPreviousRide(orders: ArrivalOrder[], orderId: string, driverId: string) {
  return orders.some(order => order.id !== orderId && order.status === 'in_progress' && ownsArrival(order, driverId));
}

export function manualArrivalMinutes(at: string | null | undefined, now = Date.now()) {
  const timestamp = at ? Date.parse(at) : NaN;
  return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - now) / 60000)) : null;
}

export function freshArrivalLocation(updatedAt: string | null | undefined, now = Date.now()) {
  const time = updatedAt ? Date.parse(updatedAt) : NaN;
  return Number.isFinite(time) && now - time <= 120000 && time <= now + 10000;
}

export function customerArrivalEta(order: {
  pickup_departed_at: string | null;
  manual_arrival_at: string | null;
  assigned_driver_id: string | null;
  arrival_eta_driver_id: string | null;
  arrival_eta_updated_at: string | null;
  arrival_eta_minutes: number | null;
}, locationUpdatedAt: string | null | undefined, now = Date.now()): { minutes: number | null; mode: 'manual' | 'route' | 'waiting' } {
  if (!order.pickup_departed_at) {
    return { minutes: manualArrivalMinutes(order.manual_arrival_at, now), mode: order.manual_arrival_at ? 'manual' : 'waiting' };
  }
  // Departure always supersedes the manual estimate, including while GPS is unavailable.
  if (order.assigned_driver_id && order.arrival_eta_driver_id === order.assigned_driver_id
    && freshArrivalLocation(locationUpdatedAt, now) && freshArrivalLocation(order.arrival_eta_updated_at, now)
    && order.arrival_eta_minutes != null) {
    return { minutes: order.arrival_eta_minutes, mode: 'route' };
  }
  return { minutes: null, mode: 'waiting' };
}