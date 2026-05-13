const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const appJsonPath = path.join(projectRoot, "app.json");
const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");
const androidManifestPath = path.join(projectRoot, "android", "app", "src", "main", "AndroidManifest.xml");

const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const versionName = appJson.expo?.version;
const versionCode = appJson.expo?.android?.versionCode;
const blockedPermissions = appJson.expo?.android?.blockedPermissions ?? [];

if (!versionName || !Number.isInteger(versionCode)) {
  throw new Error("app.json must define expo.version and expo.android.versionCode");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function syncBuildGradle() {
  if (!fs.existsSync(buildGradlePath)) {
    console.warn("android/app/build.gradle not found; skipping native Android build.gradle sync.");
    return false;
  }

  const source = fs.readFileSync(buildGradlePath, "utf8");
  let next = source
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

  const releaseSigningVariables = `
def releaseSigningValue = { name ->
    def value = findProperty(name)
    if (value == null || value.toString().trim().isEmpty()) {
        value = System.getenv(name)
    }
    return value == null ? null : value.toString()
}

def releaseStoreFile = releaseSigningValue('KEPEDIMOS_UPLOAD_STORE_FILE')
def releaseStorePassword = releaseSigningValue('KEPEDIMOS_UPLOAD_STORE_PASSWORD')
def releaseKeyAlias = releaseSigningValue('KEPEDIMOS_UPLOAD_KEY_ALIAS')
def releaseKeyPassword = releaseSigningValue('KEPEDIMOS_UPLOAD_KEY_PASSWORD')
def hasReleaseSigning = [releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword].every {
    it != null && !it.trim().isEmpty()
}
`;

  if (!next.includes("def releaseSigningValue = { name ->")) {
    next = next.replace(
      /def enableMinifyInReleaseBuilds = \([^\n]+\)\.toBoolean\(\)\r?\n/,
      (match) => `${match}${releaseSigningVariables}`
    );
  }

  if (!next.includes("KEPEDIMOS_UPLOAD_STORE_FILE") || !next.includes("signingConfigs.release")) {
    next = next.replace(
      /        debug \{\r?\n            storeFile file\('debug\.keystore'\)\r?\n            storePassword 'android'\r?\n            keyAlias 'androiddebugkey'\r?\n            keyPassword 'android'\r?\n        \}/,
      `$&\n        release {\n            if (hasReleaseSigning) {\n                storeFile file(releaseStoreFile)\n                storePassword releaseStorePassword\n                keyAlias releaseKeyAlias\n                keyPassword releaseKeyPassword\n            }\n        }`
    );
  }

  next = next.replace(
    /        release \{\r?\n            \/\/ Caution![\s\S]*?            signingConfig signingConfigs\.debug\r?\n/,
    "        release {\n            if (hasReleaseSigning) {\n                signingConfig signingConfigs.release\n            }\n"
  );

  const validateReleaseSigningTask = `
tasks.register("validatePlayReleaseSigning") {
    doLast {
        if (!hasReleaseSigning) {
            throw new GradleException("Play release signing is not configured. Set KEPEDIMOS_UPLOAD_STORE_FILE, KEPEDIMOS_UPLOAD_STORE_PASSWORD, KEPEDIMOS_UPLOAD_KEY_ALIAS, and KEPEDIMOS_UPLOAD_KEY_PASSWORD as environment variables or Gradle properties.")
        }
        if (!file(releaseStoreFile).exists()) {
            throw new GradleException("Play release keystore not found: \${releaseStoreFile}")
        }
    }
}
`;

  if (!next.includes('tasks.register("validatePlayReleaseSigning")')) {
    next = next.replace(/\r?\n\/\/ Apply static values from `gradle\.properties`/, `${validateReleaseSigningTask}\n// Apply static values from \`gradle.properties\``);
  }

  if (next === source) {
    console.log(`Android native version already synced: ${versionName} (${versionCode})`);
    return false;
  }

  fs.writeFileSync(buildGradlePath, next);
  console.log(`Synced Android native build.gradle: ${versionName} (${versionCode})`);
  return true;
}

function syncAndroidManifest() {
  if (!fs.existsSync(androidManifestPath)) {
    console.warn("android/app/src/main/AndroidManifest.xml not found; skipping native Android manifest sync.");
    return false;
  }

  const source = fs.readFileSync(androidManifestPath, "utf8");
  let next = source.replace(/<manifest\b([^>]*)>/, (match, attrs) => {
    return attrs.includes("xmlns:tools")
      ? match
      : `<manifest${attrs} xmlns:tools="http://schemas.android.com/tools">`;
  });

  for (const permission of blockedPermissions) {
    const permissionRegex = new RegExp(`\\r?\\n?\\s*<uses-permission\\s+android:name="${escapeRegex(permission)}"[^>]*/>`, "g");
    next = next.replace(permissionRegex, "");
    const removalDeclaration = `  <uses-permission android:name="${permission}" tools:node="remove"/>`;
    const insertionPoint = next.lastIndexOf("  <uses-permission ");
    if (insertionPoint >= 0) {
      const lineEnd = next.indexOf("\n", insertionPoint);
      next = `${next.slice(0, lineEnd + 1)}${removalDeclaration}\n${next.slice(lineEnd + 1)}`;
    } else {
      next = next.replace(/(<manifest[^>]*>\r?\n)/, `$1${removalDeclaration}\n`);
    }
  }

  if (next === source) {
    console.log("Android native manifest already synced.");
    return false;
  }

  fs.writeFileSync(androidManifestPath, next);
  console.log("Synced Android native manifest blocked permissions.");
  return true;
}

syncBuildGradle();
syncAndroidManifest();
