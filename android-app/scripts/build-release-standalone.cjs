const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const appJsonPath = path.join(projectRoot, "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const versionName = appJson.expo?.version;

if (!versionName) {
  throw new Error("app.json must define expo.version");
}

const copyOnly = process.argv.includes("--copy-only");
const androidDir = path.join(projectRoot, "android");
const sourceApk = path.join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk");
const versionedApk = path.join(projectRoot, `KePedimos-${versionName}-release-standalone.apk`);
const latestApk = path.join(projectRoot, "KePedimos-release-standalone.apk");

if (!copyOnly) {
  execFileSync("node", [path.join(projectRoot, "scripts", "sync-android-version.cjs")], {
    cwd: projectRoot,
    stdio: "inherit"
  });
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/d", "/s", "/c", ".\\gradlew.bat assembleRelease"], {
      cwd: androidDir,
      stdio: "inherit"
    });
  } else {
    execFileSync("./gradlew", ["assembleRelease"], {
      cwd: androidDir,
      stdio: "inherit"
    });
  }
}

if (!fs.existsSync(sourceApk)) {
  throw new Error(`Release APK not found: ${sourceApk}`);
}

fs.copyFileSync(sourceApk, versionedApk);
fs.copyFileSync(sourceApk, latestApk);

const sizeMb = (fs.statSync(versionedApk).size / 1024 / 1024).toFixed(2);
console.log(`Standalone APK ready: ${versionedApk} (${sizeMb} MB)`);
console.log(`Latest APK updated: ${latestApk}`);
