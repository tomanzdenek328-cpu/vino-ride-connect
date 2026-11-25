import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function applyAndroidVersion(gradle, release) {
  if (!/^\d+\.\d+\.\d+$/.test(release.versionName) || !Number.isSafeInteger(release.versionCode) || release.versionCode < 2) {
    throw new Error('Invalid Android release version');
  }
  if (!/\bversionCode\s+\d+/.test(gradle) || !/\bversionName\s+["'][^"']+["']/.test(gradle)) {
    throw new Error('Android Gradle version fields are missing');
  }
  return gradle
    .replace(/\bversionCode\s+\d+/, `versionCode ${release.versionCode}`)
    .replace(/\bversionName\s+["'][^"']+["']/, `versionName "${release.versionName}"`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const release = JSON.parse(readFileSync('android-release.json', 'utf8'));
  const path = 'android/app/build.gradle';
  writeFileSync(path, applyAndroidVersion(readFileSync(path, 'utf8'), release));
  console.log(`Android version: ${release.versionName} (${release.versionCode})`);
}