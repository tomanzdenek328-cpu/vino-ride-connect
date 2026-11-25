import { it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { applyAndroidVersion } from './android-version.mjs';

const release = JSON.parse(readFileSync(new URL('../android-release.json', import.meta.url), 'utf8'));
const gradle = `android {
  defaultConfig {
    applicationId "app.lovable.vinnetaxi"
    versionCode 1
    versionName "1.0"
  }
}`;

it('sets the new APK to version 1.1.1 with a higher version code', () => {
  const updated = applyAndroidVersion(gradle, release);
  assert.match(updated, /versionName "1\.1\.1"/);
  assert.match(updated, /versionCode 3\b/);
  assert.equal(applyAndroidVersion(updated, release), updated);
});

it('preserves the installed application identity', () => {
  assert.match(applyAndroidVersion(gradle, release), /applicationId "app\.lovable\.vinnetaxi"/);
});

it('rejects missing Gradle version fields rather than producing version 1.0 again', () => {
  assert.throws(() => applyAndroidVersion('android {}', release), /fields are missing/);
});

it('rejects invalid Android versions', () => {
  assert.throws(() => applyAndroidVersion(gradle, { versionName: '1.1.0', versionCode: 1 }), /Invalid/);
  assert.throws(() => applyAndroidVersion(gradle, { versionName: 'invalid', versionCode: 2 }), /Invalid/);
});