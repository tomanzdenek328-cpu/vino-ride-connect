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