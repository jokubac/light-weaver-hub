import type { CapacitorConfig } from "@capacitor/cli";

// The installed app bundles the published NOX app (scripts/offline-bundle.mjs → offline-app/)
// so it opens and runs DMX without internet. Rebuild the APK/IPA after publishing to update it.
const config: CapacitorConfig = {
  appId: "com.kroma.console",
  appName: "NOX",
  webDir: "offline-app",
  ios: { contentInset: "always", backgroundColor: "#17131c" },
};

export default config;
