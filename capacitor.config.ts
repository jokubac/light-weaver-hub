import type { CapacitorConfig } from "@capacitor/cli";

// The installed app bundles the published NOX app (scripts/offline-bundle.mjs → offline-app/)
// so it opens and runs DMX without internet. Rebuild the APK/IPA after publishing to update it.
const config: CapacitorConfig = {
  appId: "com.kroma.console",
  appName: "NOX",
  webDir: "offline-app",
  // capacitor-midi is Android-only; keep it out of the iOS project.
  ios: { contentInset: "always", backgroundColor: "#17131c", includePlugins: ["@capacitor-community/bluetooth-le", "capacitor-udp-socket"] },
};

export default config;
