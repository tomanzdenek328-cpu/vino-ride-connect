import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAddOrders, canManageDriverRoles, canSeeOtherDrivers } from "./dispatch-access";

describe("dispatch permissions", () => {
  test("self-registration always assigns driver, ignoring requested privileged role", () => {
    const sql = readFileSync("drizzle/migrations/0002_dispatcher_access_permissions.sql", "utf8");
    const signup = sql.split("CREATE OR REPLACE FUNCTION public.handle_new_user()")[1]?.split("CREATE POLICY")[0];
    assert.ok(signup);
    assert.match(signup, /INSERT INTO public\.user_roles\(user_id,role\) VALUES\(NEW\.id,'driver'\)/);
    assert.doesNotMatch(signup, /raw_user_meta_data\s*->>\s*'role'/);
  });
  test("helper read restrictions require own driver identity for both locations and rides", () => {
    const sql = readFileSync("drizzle/migrations/0002_dispatcher_access_permissions.sql", "utf8");
    for (const table of ["driver_locations", "rides"]) {
      assert.match(sql, new RegExp(`ON public\\.${table} AS RESTRICTIVE FOR SELECT TO authenticated USING\\(NOT public\\.is_helper_dispatcher\\(auth\\.uid\\(\\)\\) OR driver_id=auth\\.uid\\(\\)\\)`));
    }
  });
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