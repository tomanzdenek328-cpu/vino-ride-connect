export const ORDER_REFRESH_MS = 1_000;

/** Keep unchanged results stable so second-by-second reads do not redraw forms. */
export function stableRows<T>(previous: T[], next: T[]): T[] {
  return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}

interface AlertOrder {
  id: string;
  status: string;
  released: boolean;
  assigned_driver_id: string | null;
  assigned_driver_ids: string[] | null;
  partner_direction?: string | null;
}

/** Compare confirmed reads, not realtime old rows (which can omit assignment). */
export function createOrderAlertTracker(userId: string) {
  let seen: Map<string, boolean> | null = null;
  return <T extends AlertOrder>(orders: T[]): T[] => {
    const current = new Map(orders.map(order => [order.id,
      order.partner_direction !== 'out' && order.released &&
      ['pending', 'assigned'].includes(order.status) &&
      (order.status === 'pending' || order.assigned_driver_id === userId || !!order.assigned_driver_ids?.includes(userId)),
    ]));
    const alerts = seen === null ? [] : orders.filter(order => current.get(order.id) && !seen?.get(order.id));
    seen = current;
    return alerts;
  };
}