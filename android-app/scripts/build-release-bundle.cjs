const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const androidDir = path.join(projectRoot, "android");
const appJsonPath = path.join(projectRoot, "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const versionName = appJson.expo?.version;

if (!versionName) {
  throw new Error("app.json must define expo.version");
}

const sourceBundle = path.join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const versionedBundle = path.join(projectRoot, `KePedimos-${versionName}-release.aab`);
const latestBundle = path.join(projectRoot, "KePedimos-release.aab");

function runGradle(args) {
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/d", "/s", "/c", `.\\gradlew.bat ${args.join(" ")}`], {
      cwd: androidDir,
      stdio: "inherit"
    });
    return;
  }

  execFileSync("./gradlew", args, {
    cwd: androidDir,
    stdio: "inherit"
  });
}

execFileSync("node", [path.join(projectRoot, "scripts", "sync-android-version.cjs")], {
  cwd: projectRoot,
  stdio: "inherit"
});

runGradle([":app:validatePlayReleaseSigning", ":app:bundleRelease"]);

if (!fs.existsSync(sourceBundle)) {
  throw new Error(`Release AAB not found: ${sourceBundle}`);
}

fs.copyFileSync(sourceBundle, versionedBundle);
fs.copyFileSync(sourceBundle, latestBundle);

const sizeMb = (fs.statSync(versionedBundle).size / 1024 / 1024).toFixed(2);
console.log(`Play release AAB ready: ${versionedBundle} (${sizeMb} MB)`);
console.log(`Latest AAB updated: ${latestBundle}`);
