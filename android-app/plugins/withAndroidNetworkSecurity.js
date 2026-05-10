const { AndroidConfig, withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">200.58.107.187</domain>
  </domain-config>
</network-security-config>
`;

module.exports = function withAndroidNetworkSecurity(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(modConfig.modResults);
    mainApplication.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    mainApplication.$["android:usesCleartextTraffic"] = "false";
    return modConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const xmlDir = path.join(modConfig.modRequest.platformProjectRoot, "app", "src", "main", "res", "xml");
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, "network_security_config.xml"), NETWORK_SECURITY_CONFIG);
      return modConfig;
    }
  ]);
};
