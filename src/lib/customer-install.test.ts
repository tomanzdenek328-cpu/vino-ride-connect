import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appManifestForPath, CUSTOMER_MANIFEST } from "./customer-install";

test("customer home-screen app opens ride-code entry, not login or registration", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../public/customer-manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.start_url, "/sledovat");
  assert.equal(manifest.display, "standalone");
  assert.notEqual(manifest.id, "/");
});

test("all customer screens offer the customer app rather than the driver app", () => {
  for (const path of ["/objednat", "/sledovat", "/jizda/ABCD", "/qr", "/zakaznik-instalace"]) {
    assert.equal(appManifestForPath(path), CUSTOMER_MANIFEST);
  }
});

test("driver and dispatcher installation keeps its existing manifest", () => {
  for (const path of ["/", "/login", "/signup", "/driver", "/dispatcher", "/install"]) {
    assert.equal(appManifestForPath(path), "/manifest.json");
  }
});