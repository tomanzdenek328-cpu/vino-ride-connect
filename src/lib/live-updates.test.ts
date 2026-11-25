import { it } from 'node:test';
import { strict as assert } from 'node:assert';
import { ORDER_REFRESH_MS, createOrderAlertTracker, stableRows } from './live-updates';
import { ANDROID_ALERT_CHANNEL, ANDROID_FCM_ALERT, BACKGROUND_LOCATION_OPTIONS } from './native-settings';

const order = { id: 'ride', status: 'pending', released: true, assigned_driver_id: null, assigned_driver_ids: [] as string[] };
it('checks active orders every second', () => { assert.equal(ORDER_REFRESH_MS, 1000); });
it('alerts on a new order once even when it is polled every second', () => {
  const read = createOrderAlertTracker('driver');
  assert.deepEqual(read([]), []);
  assert.deepEqual(read([order]), [order]);
  assert.deepEqual(read([order]), []);
});
it('alerts when a locked ride is released, not on every locked read', () => {
  const read = createOrderAlertTracker('driver');
  read([{ ...order, released: false }]);
  assert.deepEqual(read([order]), [order]);
  assert.deepEqual(read([order]), []);
});
it('alerts on assignment to this driver, not to somebody else', () => {
  const read = createOrderAlertTracker('driver');
  read([]);
  assert.deepEqual(read([{ ...order, status: 'assigned', assigned_driver_id: 'other' }]), []);
  const assigned = { ...order, status: 'assigned', assigned_driver_id: 'driver' };
  assert.deepEqual(read([assigned]), [assigned]);
  assert.deepEqual(read([assigned]), []);
});
it('does not alert on partner-forwarded orders', () => {
  const read = createOrderAlertTracker('driver');
  read([]);
  assert.deepEqual(read([{ ...order, partner_direction: 'out' }]), []);
});
it('unchanged polling results do not redraw the screen', () => {
  const previous = [order];
  assert.equal(stableRows(previous, [{ ...order }]), previous);
  assert.notEqual(stableRows(previous, [{ ...order, status: 'accepted' }]), previous);
});
it('local and background pushes use the same high-importance sound channel', () => {
  assert.equal(ANDROID_ALERT_CHANNEL.importance, 5);
  assert.equal(ANDROID_ALERT_CHANNEL.vibration, true);
  assert.equal(ANDROID_FCM_ALERT.channel_id, ANDROID_ALERT_CHANNEL.id);
  assert.equal(ANDROID_FCM_ALERT.sound, 'default');
});
it('GPS keeps a background service notification and reports without a distance filter', () => {
  assert.ok(BACKGROUND_LOCATION_OPTIONS.backgroundMessage);
  assert.equal(BACKGROUND_LOCATION_OPTIONS.requestPermissions, true);
  assert.equal(BACKGROUND_LOCATION_OPTIONS.distanceFilter, 0);
  assert.equal(BACKGROUND_LOCATION_OPTIONS.stale, false);
});