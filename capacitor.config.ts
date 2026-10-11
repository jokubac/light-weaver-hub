import type { CapacitorConfig } from "@capacitor/cli";

// Native shell loads the published app so iPad/Android always run the latest version.
const config: CapacitorConfig = {
  appId: "com.kroma.console",
  appName: "KROMA",
  webDir: "ios-shell",
  server: {
    url: "https://light-weaver-hub.lovable.app",
    cleartext: false,
  },
  ios: { contentInset: "always", backgroundColor: "#17131c" },
};

export default config;
