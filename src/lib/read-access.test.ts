import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('drizzle/migrations/0003_scope_taxi_read_access.sql', 'utf8');
test('ordinary driver locations are own-only except for active SOS or full dispatcher', () => {
  const policy = sql.split('CREATE POLICY "dispatch own or emergency locations"')[1]?.split(';')[0];
  assert.ok(policy);
  assert.match(policy, /driver_id=auth.uid\(\)/);
  assert.match(policy, /public.has_role\(auth.uid\(\),'dispatcher'\)/);
  assert.match(policy, /s.driver_id=driver_locations.driver_id AND s.resolved_at IS NULL/);
});
test('SOS history is restricted to its driver and full dispatcher', () => {
  const policy = sql.split('CREATE POLICY "taxi members read active or own sos"')[1]?.split(';')[0];
  assert.ok(policy);
  assert.match(policy, /driver_id=auth.uid\(\)/);
  assert.match(policy, /public.has_role\(auth.uid\(\),'driver'\) AND resolved_at IS NULL/);
});
test('unrestricted photo download policy is removed without removing dispatcher management', () => {
  assert.match(sql, /DROP POLICY IF EXISTS "authenticated read vehicle photos" ON storage.objects/);
  assert.doesNotMatch(sql, /DROP POLICY[^;]*"dispatchers manage vehicle photos"/);
});
test('helper privacy policies remain in effect', () => {
  assert.doesNotMatch(sql, /DROP POLICY[^;]*"helper/);
  const privacy = readFileSync('drizzle/migrations/0002_dispatcher_access_permissions.sql', 'utf8');
  assert.match(privacy, /"helper locations privacy".*AS RESTRICTIVE/);
  assert.match(privacy, /"helper profiles privacy".*AS RESTRICTIVE/);
});