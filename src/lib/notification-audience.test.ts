import { it } from 'node:test';
import { strict as assert } from 'node:assert';
import { activityRecipients } from './notification-audience';

const members = [
  { user_id: 'sender', role: 'driver' }, { user_id: 'driver', role: 'driver' },
  { user_id: 'helper', role: 'driver' }, { user_id: 'dispatcher', role: 'dispatcher' },
  { user_id: 'outsider', role: 'other' },
];
it('SOS goes to taxi members but not the sender or restricted helpers', () => {
  assert.deepEqual(activityRecipients(members, ['helper'], { kind: 'sos', senderId: 'sender' }), ['driver', 'dispatcher']);
});
it('private chat notifications go only to participants', () => {
  assert.deepEqual(activityRecipients(members, ['helper'], { kind: 'chat', senderId: 'sender', participants: ['sender', 'driver'], threadKey: 'direct:sender:driver' }), ['driver']);
});
it('dispatch chat goes to its participant and full dispatchers, not unrelated drivers', () => {
  assert.deepEqual(activityRecipients(members, ['helper'], { kind: 'chat', senderId: 'sender', participants: ['sender'], threadKey: 'dispatch:sender' }), ['dispatcher']);
});
it('group chat reaches members including helpers but not non-members', () => {
  assert.deepEqual(activityRecipients(members, ['helper'], { kind: 'chat', senderId: 'sender', participants: null, threadKey: 'group' }), ['driver', 'helper', 'dispatcher']);
});