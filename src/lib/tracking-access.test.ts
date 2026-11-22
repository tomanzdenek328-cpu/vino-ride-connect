import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canShareDriverLocation } from './tracking-access';

test('closed ride codes cannot expose current driver GPS', () => {
  assert.equal(canShareDriverLocation('completed'), false);
  assert.equal(canShareDriverLocation('cancelled'), false);
});
test('only assigned active rides share driver GPS', () => {
  assert.equal(canShareDriverLocation('pending'), false);
  for (const status of ['assigned', 'accepted', 'in_progress']) assert.equal(canShareDriverLocation(status), true);
});