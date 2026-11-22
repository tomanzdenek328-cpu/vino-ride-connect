import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { canAddOrders, canManageDriverRoles, canSeeOtherDrivers } from "./dispatch-access";

describe("dispatch permissions", () => {
  test("only a full dispatcher with main access can assign helper roles", () => {
    assert.equal(canManageDriverRoles("dispatcher", "main"), true);
    assert.equal(canManageDriverRoles("dispatcher", null), false);
    assert.equal(canManageDriverRoles("driver", "helper"), false);
    assert.equal(canManageDriverRoles("driver", "main"), false);
  });
  test("helper dispatcher can add orders, ordinary driver cannot", () => {
    assert.equal(canAddOrders("driver", "helper"), true);
    assert.equal(canAddOrders("driver", null), false);
  });
  test("helper dispatcher cannot see other drivers", () => {
    assert.equal(canSeeOtherDrivers("driver", "helper"), false);
    assert.equal(canSeeOtherDrivers("dispatcher", "helper"), false);
    assert.equal(canSeeOtherDrivers("dispatcher", "main"), true);
  });
});