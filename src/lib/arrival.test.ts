import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { canManageArrival, hasPreviousRide, manualArrivalMinutes, freshArrivalLocation, type ArrivalOrder } from './arrival';
const order: ArrivalOrder = { id: 'next', source: 'customer', status: 'accepted', released: true, assigned_driver_id: 'driver', assigned_driver_ids: [] };
describe('Customer arrival', () => {
  it('customer orders only', () => { assert.equal(canManageArrival(order, 'driver'), true); assert.equal(canManageArrival({ ...order, source: 'dispatcher' }, 'driver'), false); });
  it('only assigned drivers on released pre-pickup orders', () => { assert.equal(canManageArrival(order, 'other'), false); assert.equal(canManageArrival({ ...order, released: false }, 'driver'), false); assert.equal(canManageArrival({ ...order, status: 'in_progress' }, 'driver'), false); });
  it('25 minute manual estimate counts down without becoming a false arrival', () => { const now = Date.parse('2026-11-16T02:00:00Z'); assert.equal(manualArrivalMinutes('2026-11-16T02:25:00Z', now), 25); assert.equal(manualArrivalMinutes('2026-11-16T02:25:00Z', now + 60000), 24); assert.equal(manualArrivalMinutes('2026-11-16T02:25:00Z', now + 26 * 60000), 0); });
  it('previous ride must be completed before departure', () => { const previous = { ...order, id: 'previous', status: 'in_progress' }; assert.equal(hasPreviousRide([previous, order], order.id, 'driver'), true); assert.equal(hasPreviousRide([{ ...previous, status: 'completed' }, order], order.id, 'driver'), false); });
  it('stale GPS does not calculate arrival', () => { const now = Date.parse('2026-11-16T02:00:00Z'); assert.equal(freshArrivalLocation('2026-11-16T01:59:30Z', now), true); assert.equal(freshArrivalLocation('2026-11-16T01:55:00Z', now), false); });
});