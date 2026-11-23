import { test } from "node:test";
import assert from "node:assert/strict";
import { partnerProgressStatus, PartnerStatusResponse } from "./partner-progress";

test("driver acceptance is distinct from partner dispatcher acceptance", () => {
  assert.equal(partnerProgressStatus({ status: "pending" }), "pending");
  assert.equal(partnerProgressStatus({ status: "accepted" }), "accepted");
});
test("arrival is transmitted separately while passenger trip has not started", () => {
  assert.equal(partnerProgressStatus({ status: "accepted", driver_arrived_at: "2026-11-23T20:45:00Z" }), "arrived");
  assert.equal(partnerProgressStatus({ status: "accepted", driver_arrived_at: null }), "accepted");
});
test("passenger trip takes precedence over the earlier arrival", () => {
  assert.equal(partnerProgressStatus({ status: "in_progress", driver_arrived_at: "2026-11-23T20:45:00Z" }), "in_progress");
});
test("completion and cancellation are not replaced by arrival", () => {
  for (const status of ["completed", "cancelled"]) {
    assert.equal(partnerProgressStatus({ status, driver_arrived_at: "2026-11-23T20:45:00Z" }), status);
  }
});
test("older partner response without arrival remains compatible; invalid status is rejected", () => {
  const item = { id: "11111111-1111-4111-8111-111111111111", state: "accepted", status: "accepted" };
  assert.equal(PartnerStatusResponse.safeParse({ items: [item] }).success, true);
  assert.equal(PartnerStatusResponse.safeParse({ items: [{ ...item, status: "invented" }] }).success, false);
});