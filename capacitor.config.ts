import type { CapacitorConfig } from "@capacitor/cli";

// The installed app bundles the published NOX app (scripts/offline-bundle.mjs → offline-app/)
// so it opens and runs DMX without internet. Rebuild the APK/IPA after publishing to update it.
const config: CapacitorConfig = {
  appId: "com.kroma.console",
  appName: "NOX",
  webDir: "offline-app",
  // capacitor-midi is Android-only; iPad MIDI uses NOX's own CoreMIDI plugin (ios-native/). Bluetooth needs Xcode 16+.
  ios: { contentInset: "never", backgroundColor: "#17131c", includePlugins: ["capacitor-udp-socket", "@capacitor-community/bluetooth-le"] },
  android: { backgroundColor: "#17131c" },
};

export default config;
