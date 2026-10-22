// Runs from `npm version <x.y.z>` (the "version" lifecycle script), after npm has set the
// new version in package.json: adds 1 to versionCode, the Android build number.
// android/app/build.gradle reads both values from package.json.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.versionCode += 1;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`${pkg.version} (build ${pkg.versionCode})`);
