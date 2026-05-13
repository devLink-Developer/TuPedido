const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const appJsonPath = path.join(projectRoot, "app.json");
const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const versionName = appJson.expo?.version;
const versionCode = appJson.expo?.android?.versionCode;

if (!versionName || !Number.isInteger(versionCode)) {
  throw new Error("app.json must define expo.version and expo.android.versionCode");
}

if (!fs.existsSync(buildGradlePath)) {
  console.warn("android/app/build.gradle not found; skipping native Android version sync.");
  process.exit(0);
}

const source = fs.readFileSync(buildGradlePath, "utf8");
const next = source
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

if (next === source) {
  console.log(`Android native version already synced: ${versionName} (${versionCode})`);
} else {
  fs.writeFileSync(buildGradlePath, next);
  console.log(`Synced Android native version: ${versionName} (${versionCode})`);
}
